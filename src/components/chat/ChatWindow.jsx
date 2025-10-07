import React, { useState, useEffect, useRef } from 'react';
import { User, FamilyMember, ChatMessage, Conversation, Task, ScheduleEvent, WishlistItem } from '@/api/entities';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2, Bot, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from "@/components/ui/use-toast";
import { InvokeLLM } from '@/api/integrations';
import TasksReviewer from './TasksReviewer';
import VacationEventsReview from './VacationEventsReview';
import { Check } from "lucide-react";

// ---- date helpers (robust to missing/legacy fields) ----
const getMessageISO = (msg) =>
  (msg && (msg.created_time || msg.created_at || msg.created_date)) || null;

const getMessageDate = (msg) => {
  const iso = getMessageISO(msg);
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
};

// stable oldest→newest sort everywhere
const sortMessages = (arr) => {
  const next = [...arr];
  next.sort((a, b) => {
    const da = getMessageDate(a);
    const db = getMessageDate(b);
    if (!da && !db) return 0;
    if (!da) return -1;
    if (!db) return 1;
    return da - db; // oldest → newest
  });
  return next;
};

// If your backend creates suggestion messages, keep this true so we don't create them here.
const BACKEND_CREATES_AI_SUGGESTION_MESSAGE = true;

export default function ChatWindow({ conversationId, participants }) {
  const [messages, setMessages] = useState([]);
  const [familyMembers, setFamilyMembers] = useState([]);
  const [currentUserMember, setCurrentUserMember] = useState(null);
  const [aiAssistant, setAiAssistant] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const messagesEndRef = useRef(null);
  const { toast } = useToast();
  const hasSentIntroRef = useRef(false);

  // WS refs for reconnection
  const wsRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const retryRef = useRef(0);

  const createAIAssistant = async (familyId) => {
    try {
      const aiMember = await FamilyMember.create({
        name: "AI Assistent", role: "ai_assistant", family_id: familyId, color: "#10b981", language: "nl"
      });
      return aiMember;
    } catch (error) {
      console.error("Failed to create AI assistant:", error);
      return null;
    }
  };

  const introduceAI = async (aiMember, convoId) => {
    const welcomeMessage = "🤖 Hoi! Ik ben jullie AI-assistent. Klik op de ✨ knop rechtsonder als je wilt dat ik meedenk of een actie voorstel op basis van het gesprek!";
    try {
      const created = await ChatMessage.create({
        conversation_id: convoId,
        sender_id: aiMember.id,
        content: welcomeMessage,
        message_type: 'ai_introduction',
        read_by: [aiMember.id],
      });

      // Optimistically show intro even if WS is down
      setMessages(prev => sortMessages(
        prev.some(m => m.id === created.id) ? prev : [...prev, created]
      ));

      await Conversation.update(convoId, {
        last_message_preview: "AI assistent heeft zich aangesloten.",
        last_message_timestamp: new Date().toISOString()
      });
      return true;
    } catch (error) {
      console.error("Failed to introduce AI:", error);
      return false;
    }
  };

  // Load initial data
  useEffect(() => {
    const loadChatData = async () => {
      if (!conversationId) return;
      setIsLoading(true);
      setPendingAction(null);

      try {
        const user = await User.me();
        let members = await FamilyMember.list();

        // authoritative current FamilyMember from backend
        const meAsMember = await FamilyMember.me();
        setCurrentUserMember(meAsMember);

        // Ensure AI member exists
        let aiMember = members.find(m => m.role === 'ai_assistant');
        if (!aiMember && user.family_id) {
          aiMember = await createAIAssistant(user.family_id);
          if (aiMember) {
            members = await FamilyMember.list(); // refresh
          }
        }
        setAiAssistant(aiMember);
        setFamilyMembers(members);

        // Messages & AI intro
        let initialMessages = await ChatMessage.filter({ conversation_id: conversationId }, 'created_date');

        if (aiMember && !hasSentIntroRef.current) {
          // detect by message_type only (legacy rows may have human sender_id)
          const hasIntro = initialMessages.some(m => m.message_type === 'ai_introduction');
          if (!hasIntro) {
            const introduced = await introduceAI(aiMember, conversationId);
            if (introduced) {
              hasSentIntroRef.current = true;
              initialMessages = await ChatMessage.filter({ conversation_id: conversationId }, 'created_date');
            }
          } else {
            hasSentIntroRef.current = true;
          }
        }

        // de-dupe AI intro (keep first)
        const unique = [];
        const seenIntro = new Set();
        for (const msg of initialMessages) {
          const isIntro = msg.message_type === 'ai_introduction';
          const key = isIntro ? 'ai_introduction' : msg.id;
          if (!seenIntro.has(key)) {
            seenIntro.add(key);
            unique.push(msg);
          }
        }

        setMessages(sortMessages(unique));
        window.dispatchEvent(new CustomEvent('famly-chat-opened', { detail: { conversationId } }));
      } catch (error) {
        console.error("Chat initialization error:", error);
        toast({ title: "Chat Error", description: "Could not initialize chat", variant: "destructive", duration: 5000  });
      } finally {
        setIsLoading(false);
      }
    };

    loadChatData();
  }, [conversationId, toast]);

  // WebSocket live updates with reconnect
  useEffect(() => {
    if (!conversationId || !currentUserMember) return;

    const token = localStorage.getItem("famlyai_token");
    if (!token) {
      console.warn("❌ No access token found, not opening WebSocket.");
      return;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host; // same host the SPA is served from
    const WS_BASE = (import.meta)?.env?.VITE_WS_BASE || `${protocol}//${host}`;

    const connect = () => {
      const ws = new WebSocket(`${WS_BASE}/ws?token=${encodeURIComponent(token)}`);
      wsRef.current = ws;

      ws.onopen = () => {
        retryRef.current = 0;
        // keepalive ping
        pingIntervalRef.current = window.setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send("ping");
        }, 30000);
      };

      ws.onmessage = (event) => {
        try {
          if (typeof event.data !== "string" || !event.data.startsWith("{")) return; // "pong" etc.

          const { type, payload } = JSON.parse(event.data);

          if (type === "chat_cleared" && payload.conversation_id === conversationId) {
            setMessages([]);
          }

          if (type === "chat_message_created" && payload.conversation_id === conversationId) {
            setMessages(prev => {
              const ids = new Set(prev.map(msg => msg.id));
              if (ids.has(payload.id)) {
                // Already present (maybe from optimistic insert)
                return prev;
              }
              return sortMessages([...prev, payload]);
            });
          }
        } catch (err) {
          console.error("❌ WebSocket parse error:", err);
        }
      };

      ws.onerror = (err) => console.warn("⚠️ WebSocket error:", err);

      ws.onclose = () => {
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }
        // exponential backoff up to 30s
        const delay = Math.min(30000, 1000 * Math.pow(2, retryRef.current++));
        setTimeout(connect, delay);
      };
    };

    connect();
    return () => {
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      wsRef.current?.close();
    };
  }, [conversationId, currentUserMember]);

  // autoscroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAiProcessing, pendingAction]);

  // mark read
  useEffect(() => {
    const markMessagesAsRead = async () => {
      if (!conversationId || !currentUserMember || messages.length === 0) return;
      try {
        await Conversation.markAsRead(conversationId);
        window.dispatchEvent(new CustomEvent('famly-chat-read', { detail: { conversationId } }));
      } catch (error) {
        console.error("Failed to mark messages as read:", error);
      }
    };
    markMessagesAsRead();
  }, [conversationId, currentUserMember, messages.length]);

  // ---- Send message: optimistic insert + reconcile
  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;
    if (isSending || !currentUserMember) {
      console.warn("Blocked send: isSending or missing user");
      return;
    }

    setIsSending(true);
    const content = inputValue.trim();
    setInputValue('');

    // optimistic local message
    const tempId = `temp-${Date.now()}`;
    const pendingMsg = {
      id: tempId,
      conversation_id: conversationId,
      sender_id: currentUserMember.id,
      content,
      message_type: 'user_message',
      read_by: [currentUserMember.id],
      created_date: new Date().toISOString(),
      __pending: true,
    };
    setMessages(prev => sortMessages([...prev, pendingMsg]));

    try {
      const created = await ChatMessage.create({
        conversation_id: conversationId,
        sender_id: currentUserMember.id, // backend may override; ok
        content,
        message_type: 'user_message',
        read_by: [currentUserMember.id]
      });

      // reconcile
      setMessages(prev => {
        const next = prev.map(m => (m.id === tempId ? created : m));
        return sortMessages(next);
      });

      await Conversation.update(conversationId, {
        last_message_preview: content,
        last_message_timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error sending message:", error);
      // mark failed and restore input
      setMessages(prev => prev.map(m => (m.id === tempId ? { ...m, __pending: false, __failed: true } : m)));
      setInputValue(content); // restore
      toast({ title: "Send Failed", variant: "destructive" , duration: 5000 });
    } finally {
      setIsSending(false);
    }
  };

  // ---- AI action: backend creates the AI message; we only show review UI locally
  const handleAiAction = async () => {
    if (isAiProcessing || !aiAssistant) return;
    setIsAiProcessing(true);
    setPendingAction(null);

    try {
      // Build conversation history for the LLM (local call for suggestions UI)
      const conversationHistory = messages.map(msg => {
        const sender = familyMembers.find(m => m.id === msg.sender_id);
        return `${sender?.name || 'Unknown'}: ${msg.content}`;
      }).join('\n');

      const currentUserFamilyId = currentUserMember?.family_id;
      const safeFamilyMemberInfo = familyMembers
        .filter(m => m.family_id === currentUserFamilyId && m.role !== 'ai_assistant')
        .map(m => ({ id: m.id, name: m.name }));

      const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const userTz = currentUserMember?.timezone || browserTz || "UTC";
      const nowIso = new Date().toISOString();
      const tzHint = userTz;

      const response = await InvokeLLM({
        prompt: `You are famly.ai, a helpful Dutch family assistant.

Analyseer het HELE gesprek en lever:
- een KORTE Nederlandse samenvatting
- concrete TAKEN en AFSPRAKEN die nu aangemaakt moeten worden
- optioneel WISHLIST-items

Regels:
- Antwoord ALLEEN met JSON (geen markdown of extra tekst).
- Schrijf alle menselijke velden in het Nederlands (samenvatting, titels, beschrijvingen).
- Gebruik ALLEEN bestaande family member IDs uit de lijst.
- Kies bij voorkeur nabije datums/tijden (7–14 dagen) en geen verleden.
- 24u notatie, ISO zonder tijdzone (YYYY-MM-DDTHH:MM:SS). Geen mm/dd formaat.
- Als het vaag is: geef kleine, zekere acties. Liever weinig en goed.

Heden (lokale tijd): ${nowIso} (${tzHint}).
Interpreteer relatieve datums t.o.v. deze tijdzone en dit moment.

Context:
CHAT LOG:
---
${conversationHistory}
---

Family Members (IDs bruikbaar): ${JSON.stringify(safeFamilyMemberInfo, null, 2)}
Current User ID: ${currentUserMember?.id}
Family ID: ${currentUserFamilyId}

Return exact JSON:
{
  "summary": "korte NL samenvatting",
  "tasks": [
    {
      "title": "string (NL, kort)",
      "description": "string (NL, optioneel)",
      "assigned_to": ["<family_member_id>", "..."],
      "family_id": "${currentUserFamilyId}",
      "due_time": "YYYY-MM-DDTHH:MM:SS (optioneel)"
    }
  ],
  "events": [
    {
      "title": "string (NL, kort)",
      "start_time": "YYYY-MM-DDTHH:MM:SS",
      "end_time": "YYYY-MM-DDTHH:MM:SS",
      "family_member_ids": ["<family_member_id>", "..."],
      "family_id": "${currentUserFamilyId}",
      "location": "string (optioneel)"
    }
  ],
  "wishlist_items": [
    {
      "name": "string",
      "url": "string (optioneel)",
      "family_member_id": "<family_member_id>"
    }
  ]
}`,
        response_json_schema: {
          type: "object",
          properties: {
            summary: { type: "string" },
            tasks: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  assigned_to: { type: "array", items: { type: "string" } },
                  family_id: { type: "string" },
                  due_time: { type: "string" }
                },
                required: ["title", "assigned_to", "family_id"]
              }
            },
            events: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  start_time: { type: "string" },
                  end_time: { type: "string" },
                  family_member_ids: { type: "array", items: { type: "string" } },
                  family_id: { type: "string" },
                  location: { type: "string" }
                },
                required: ["title", "start_time", "end_time", "family_member_ids", "family_id"]
              }
            },
            wishlist_items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  url: { type: "string" },
                  family_member_id: { type: "string" }
                },
                required: ["name", "family_member_id"]
              }
            }
          },
          required: ["summary", "tasks", "events", "wishlist_items"],
          anyOf: [
            { properties: { tasks: { minItems: 1 } } },
            { properties: { events: { minItems: 1 } } },
            { properties: { wishlist_items: { minItems: 1 } } }
          ]
        },
        strict: true,
      });

      const data = response?.data || {};
      const tasks = response?.tasks ?? data.tasks ?? [];
      const events = response?.events ?? data.events ?? [];
      const wishlist = response?.wishlist_items ?? data.wishlist_items ?? [];

      if ((tasks && tasks.length) || (events && events.length) || (wishlist && wishlist.length)) {
        // Backend will create the AI summary message; we just show the reviewer.
        // Without an anchor message, render at bottom (fallback panel).
        setPendingAction({
          tasks,
          events: (events || []).map((e, idx) => ({
            id: e.id || `event-${Date.now()}-${idx}`,
            selected: true,
            ...e,
          })),
          wishlist_items: wishlist,
          messageId: null, // <-- no anchor; show fallback panel below
        });
      } else {
        toast({ title: "Geen acties", description: "De AI vond geen duidelijke acties op basis van dit gesprek.", duration: 5000 });
      }

      // NOTE: If your backend needs a trigger endpoint to create its AI message,
      // call it here (e.g., await fetch(`/api/conversations/${conversationId}/ai/suggest`, { method: 'POST' }))
      // and rely on WS or polling (below) to pick it up.

    } catch (error) {
      console.error("AI action error:", error);
      toast({ title: "AI Error", description: "Kon geen suggesties ophalen.", variant: "destructive", duration: 5000 });
    } finally {
      setIsAiProcessing(false);
    }
  };

  const handleConfirmActions = async (confirmedTasks, confirmedEvents, confirmedWishlistItems = []) => {
    try {
      if (confirmedTasks.length > 0) await Task.bulkCreate(confirmedTasks);
      if (confirmedEvents.length > 0) await ScheduleEvent.bulkCreate(confirmedEvents);
      if (confirmedWishlistItems.length > 0) await WishlistItem.bulkCreate(confirmedWishlistItems);

      if (confirmedTasks.length > 0 || confirmedEvents.length > 0 || confirmedWishlistItems.length > 0) {
        toast({ title: "AI Suggestions Added", description: "Taken, events en wishlist items zijn toegevoegd.", duration: 5000 });
      }
    } catch (error) {
      console.error("Error confirming AI actions:", error);
      toast({ title: "Error", description: "Niet alles kon worden opgeslagen.", variant: "destructive", duration: 5000 });
    } finally {
      setPendingAction(null);
    }
  };

  const getMember = (memberId) => familyMembers.find(m => m.id === memberId);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50 relative">
      <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ scrollBehavior: 'smooth' }}>
        <AnimatePresence>
          {messages.map((msg, index) => {
            const sender = getMember(msg.sender_id);

            const isCurrentUser =
              (currentUserMember?.id && msg.sender_id === currentUserMember.id) ||
              (sender?.id && currentUserMember?.id && sender.id === currentUserMember.id);

            const isAI = sender?.role === 'ai_assistant';
            const isAiIntroduction = msg.message_type === 'ai_introduction';

            if (isAiIntroduction) {
              return (
                <motion.div
                  key={msg.id || index}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex justify-center my-6"
                >
                  <div className="bg-gradient-to-r from-green-100 to-emerald-100 border-2 border-green-300 rounded-xl px-6 py-4 max-w-md text-center shadow-lg">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <Bot className="w-5 h-5 text-green-600" />
                      <span className="font-semibold text-green-800">AI Assistent</span>
                    </div>
                    <p className="text-sm text-green-700">{msg.content}</p>
                    <p className="text-xs text-green-600 mt-2">
                      {(() => {
                        const d = getMessageDate(msg);
                        return d ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                      })()}
                    </p>
                  </div>
                </motion.div>
              );
            }

            return (
              <motion.div key={msg.id || index} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <div className={`flex items-end gap-3 ${isCurrentUser ? 'justify-end' : ''}`}>
                  {!isCurrentUser && sender ? (
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-xs shrink-0 ${isAI ? 'bg-gradient-to-r from-green-500 to-emerald-500' : ''}`}
                      style={{ backgroundColor: isAI ? undefined : (sender.color || '#6b7280') }}
                    >
                      {isAI ? <Bot className="w-4 h-4" /> : (sender?.name || '?').charAt(0)}
                    </div>
                  ) : null}

                  <div
                    className={`max-w-[80%] px-4 py-2 rounded-2xl ${
                      isCurrentUser
                        ? 'bg-blue-500 text-white rounded-br-md'
                        : isAI
                          ? 'bg-gradient-to-r from-green-50 to-emerald-50 text-gray-800 rounded-bl-md shadow-sm border border-green-200'
                          : 'bg-white text-gray-800 rounded-bl-md shadow-sm border'
                    }`}
                  >
                    {!isCurrentUser && sender ? (
                      <p
                        className={`font-semibold text-xs mb-1 ${isAI ? 'text-green-600' : ''}`}
                        style={{ color: isAI ? undefined : (sender.color || '#6b7280') }}
                      >
                        {sender.name}
                      </p>
                    ) : null}

                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>

                    {(() => {
                      const d = getMessageDate(msg);
                      const timeString = d
                        ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : null;

                      const seenBy = familyMembers.filter(
                        (m) =>
                          m.id !== msg.sender_id &&
                          (participants || []).includes(m.id) &&
                          (msg.read_by || []).includes(m.id)
                      );

                      const notSeenBy = familyMembers.filter(
                        (m) =>
                          m.id !== msg.sender_id &&
                          (participants || []).includes(m.id) &&
                          !(msg.read_by || []).includes(m.id)
                      );

                      return (
                        <div className="flex justify-end gap-1 mt-1 items-end">
                          {timeString ? (
                            <p className={`text-xs ${isCurrentUser ? 'text-blue-100' : 'text-gray-500'}`}>
                              {timeString}
                            </p>
                          ) : null}

                          {seenBy.length > 0 ? (
                            <div className="flex -space-x-1 ml-2">
                              {seenBy.map((member) => (
                                <span key={member.id} title={`Seen by ${member.name}`} className="relative z-10">
                                  <svg className="w-3.5 h-3.5 -ml-1.5" viewBox="0 0 24 24" fill={member.color || '#6b7280'}>
                                    <path d="M1 12l5 5L20 4" stroke="currentColor" strokeWidth="2" fill="none" />
                                  </svg>
                                </span>
                              ))}
                            </div>
                          ) : null}

                          {notSeenBy.length > 0 ? (
                            <div className="flex -space-x-1 ml-1 opacity-50">
                              {notSeenBy.map((member) => (
                                <span key={member.id} title={`Not yet seen by ${member.name}`} className="relative z-0">
                                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#d1d5db">
                                    <path d="M1 12l5 5L20 4" stroke="currentColor" strokeWidth="2" fill="none" />
                                  </svg>
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Anchor-mode: render under the AI message that created them */}
                {pendingAction && pendingAction.messageId && msg.id === pendingAction.messageId ? (
                  <div className={`mt-2 ${isCurrentUser ? 'ml-auto' : 'ml-11'}`}>
                    {pendingAction.tasks && pendingAction.tasks.length > 0 ? (
                      <TasksReviewer
                        tasks={pendingAction.tasks}
                        familyMembers={familyMembers}
                        onConfirm={(confirmed) => handleConfirmActions(confirmed, [], [])}
                        onCancel={() => setPendingAction(null)}
                      />
                    ) : null}

                    {pendingAction.events && pendingAction.events.length > 0 && (
                      <VacationEventsReview
                        events={pendingAction.events}
                        onEventsUpdate={(updated) =>
                          setPendingAction(prev => (prev ? { ...prev, events: updated } : prev))
                        }
                        onConfirm={(confirmed) => handleConfirmActions([], confirmed, [])}
                        onCancel={() => setPendingAction(null)}
                      />
                    )}

                    {pendingAction.wishlist_items && pendingAction.wishlist_items.length > 0 ? (
                      <div className="p-3 bg-purple-50/50 border border-purple-200 rounded-lg shadow-sm space-y-2">
                        <h4 className="font-semibold text-sm text-purple-800">Wishlist Items:</h4>
                        {pendingAction.wishlist_items.map((item, i) => {
                          const member = familyMembers.find(m => m.id === item.family_member_id);
                          return (
                            <div key={i} className="text-sm bg-white p-2 rounded border">
                              <strong>{item.name}</strong> voor {member?.name}
                            </div>
                          );
                        })}
                        <div className="flex justify-end gap-2 pt-2">
                          <Button variant="ghost" size="sm" onClick={() => setPendingAction(null)}>Cancel</Button>
                          <Button
                            size="sm"
                            onClick={() => handleConfirmActions([], [], pendingAction.wishlist_items)}
                            className="bg-purple-600 hover:bg-purple-700"
                          >
                            Add to Wishlist
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Fallback-mode: if backend created the AI message and we don't have its id yet,
            still show the reviewer at the bottom so nothing feels "lost". */}
        {pendingAction && !pendingAction.messageId && (
          <div className="mt-4">
            {pendingAction.tasks?.length > 0 && (
              <TasksReviewer
                tasks={pendingAction.tasks}
                familyMembers={familyMembers}
                onConfirm={(confirmed) => handleConfirmActions(confirmed, [], [])}
                onCancel={() => setPendingAction(null)}
              />
            )}

            {pendingAction.events?.length > 0 && (
              <div className="mt-3">
                <VacationEventsReview
                  events={pendingAction.events}
                  onEventsUpdate={(updated) =>
                    setPendingAction(prev => (prev ? { ...prev, events: updated } : prev))
                  }
                  onConfirm={(confirmed) => handleConfirmActions([], confirmed, [])}
                  onCancel={() => setPendingAction(null)}
                />
              </div>
            )}

            {pendingAction.wishlist_items?.length > 0 && (
              <div className="p-3 bg-purple-50/50 border border-purple-200 rounded-lg shadow-sm space-y-2 mt-3">
                <h4 className="font-semibold text-sm text-purple-800">Wishlist Items:</h4>
                {pendingAction.wishlist_items.map((item, i) => {
                  const member = familyMembers.find(m => m.id === item.family_member_id);
                  return (
                    <div key={i} className="text-sm bg-white p-2 rounded border">
                      <strong>{item.name}</strong> voor {member?.name}
                    </div>
                  );
                })}
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="ghost" size="sm" onClick={() => setPendingAction(null)}>Cancel</Button>
                  <Button
                    size="sm"
                    onClick={() => handleConfirmActions([], [], pendingAction.wishlist_items)}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    Add to Wishlist
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {isAiProcessing && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-end gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 text-gray-800 rounded-2xl rounded-bl-md shadow-sm border border-green-200 px-4 py-2">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-green-600" />
                <span className="text-sm text-green-600">AI analyseert het gesprek...</span>
              </div>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {aiAssistant && (
        <div className="absolute bottom-24 right-6 z-10">
          <Button
            onClick={handleAiAction}
            disabled={isAiProcessing || isSending}
            className="rounded-full h-14 w-14 p-0 bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-lg hover:opacity-90 transition-all duration-300 transform hover:scale-110"
            aria-label="AI Action"
          >
            {isAiProcessing ? <Loader2 className="h-6 w-6 animate-spin" /> : <Sparkles className="h-6 w-6" />}
          </Button>
        </div>
      )}

      <div className="flex-shrink-0 p-4 bg-white border-t border-gray-200">
        <div className="flex items-center gap-3">
          <Textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Typ een bericht..."
            className="flex-1 resize-none min-h-[40px] max-h-[100px]"
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
            disabled={isSending || isAiProcessing}
          />
          <Button onClick={handleSendMessage} disabled={!inputValue.trim() || isSending || isAiProcessing} className="bg-blue-500 hover:bg-blue-600">
            {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}


// import React, { useState, useEffect, useRef } from 'react';
// import { User, FamilyMember, ChatMessage, Conversation, Task, ScheduleEvent, WishlistItem } from '@/api/entities';
// import { Button } from "@/components/ui/button";
// import { Textarea } from "@/components/ui/textarea";
// import { Send, Loader2, Bot, Sparkles } from "lucide-react";
// import { motion, AnimatePresence } from 'framer-motion';
// import { useToast } from "@/components/ui/use-toast";
// import { InvokeLLM } from '@/api/integrations';
// import TasksReviewer from './TasksReviewer';
// import VacationEventsReview from './VacationEventsReview';
// import { Check } from "lucide-react";

// // ---- date helpers (robust to missing/legacy fields) ----
// const getMessageISO = (msg) =>
//   (msg && (msg.created_time || msg.created_at || msg.created_date)) || null;

// const getMessageDate = (msg) => {
//   const iso = getMessageISO(msg);
//   if (!iso) return null;
//   const d = new Date(iso);
//   return Number.isNaN(d.getTime()) ? null : d;
// };

// export default function ChatWindow({ conversationId, participants }) {
//   const [messages, setMessages] = useState([]);
//   const [familyMembers, setFamilyMembers] = useState([]);
//   const [currentUserMember, setCurrentUserMember] = useState(null);
//   const [aiAssistant, setAiAssistant] = useState(null);
//   const [isLoading, setIsLoading] = useState(true);
//   const [inputValue, setInputValue] = useState('');
//   const [isSending, setIsSending] = useState(false);
//   const [isAiProcessing, setIsAiProcessing] = useState(false);
//   const [pendingAction, setPendingAction] = useState(null);
//   const messagesEndRef = useRef(null);
//   const { toast } = useToast();
//   const hasSentIntroRef = useRef(false);

//   const createAIAssistant = async (familyId) => {
//     try {
//       const aiMember = await FamilyMember.create({
//         name: "AI Assistent", role: "ai_assistant", family_id: familyId, color: "#10b981", language: "nl"
//       });
//       return aiMember;
//     } catch (error) {
//       console.error("Failed to create AI assistant:", error);
//       return null;
//     }
//   };

//   const introduceAI = async (aiMember, convoId) => {
//     const welcomeMessage = "🤖 Hoi! Ik ben jullie AI-assistent. Klik op de ✨ knop rechtsonder als je wilt dat ik meedenk of een actie voorstel op basis van het gesprek!";
//     try {
//       await ChatMessage.create({
//         conversation_id: convoId,
//         sender_id: aiMember.id,
//         content: welcomeMessage,
//         message_type: 'ai_introduction',
//         read_by: [aiMember.id],
//       });
//       await Conversation.update(convoId, {
//         last_message_preview: "AI assistent heeft zich aangesloten.",
//         last_message_timestamp: new Date().toISOString()
//       });
//       return true;
//     } catch (error) {
//       console.error("Failed to introduce AI:", error);
//       return false;
//     }
//   };

//   // Load initial data
//   useEffect(() => {
//     const loadChatData = async () => {
//       if (!conversationId) return;
//       setIsLoading(true);
//       setPendingAction(null);

//       try {
//         const user = await User.me();
//         let members = await FamilyMember.list();

//         // authoritative current FamilyMember from backend
//         const meAsMember = await FamilyMember.me();
//         setCurrentUserMember(meAsMember);

//         // Ensure AI member exists
//         let aiMember = members.find(m => m.role === 'ai_assistant');
//         if (!aiMember && user.family_id) {
//           aiMember = await createAIAssistant(user.family_id);
//           if (aiMember) {
//             members = await FamilyMember.list(); // refresh
//           }
//         }
//         setAiAssistant(aiMember);
//         setFamilyMembers(members);

//         // Messages & AI intro
//         let initialMessages = await ChatMessage.filter({ conversation_id: conversationId }, 'created_date');

//         if (aiMember && !hasSentIntroRef.current) {
//           const hasIntro = initialMessages.some(m => m.sender_id === aiMember.id && m.message_type === 'ai_introduction');
//           if (!hasIntro) {
//             const introduced = await introduceAI(aiMember, conversationId);
//             if (introduced) {
//               hasSentIntroRef.current = true;
//               initialMessages = await ChatMessage.filter({ conversation_id: conversationId }, 'created_date');
//             }
//           } else {
//             hasSentIntroRef.current = true;
//           }
//         }

//         // de-dupe AI intro
//         const unique = [];
//         const seenIntro = new Set();
//         for (const msg of initialMessages) {
//           const isIntro = msg.message_type === 'ai_introduction';
//           const key = isIntro ? `${msg.sender_id}-${msg.message_type}` : msg.id;
//           if (!seenIntro.has(key)) {
//             seenIntro.add(key);
//             unique.push(msg);
//           }
//         }

//         // keep stable order (oldest→newest)
//         unique.sort((a, b) => {
//           const da = getMessageDate(a);
//           const db = getMessageDate(b);
//           if (!da && !db) return 0;
//           if (!da) return -1;
//           if (!db) return 1;
//           return db - da;
//         });

//         setMessages(unique);
//         window.dispatchEvent(new CustomEvent('famly-chat-opened', { detail: { conversationId } }));
//       } catch (error) {
//         console.error("Chat initialization error:", error);
//         toast({ title: "Chat Error", description: "Could not initialize chat", variant: "destructive", duration: 5000  });
//       } finally {
//         setIsLoading(false);
//       }
//     };

//     loadChatData();
//   }, [conversationId, toast]);

//   // WebSocket live updates
//   useEffect(() => {
//     if (!conversationId || !currentUserMember) return;

//     const token = localStorage.getItem("famlyai_token");
//     if (!token) {
//       console.warn("❌ No access token found, not opening WebSocket.");
//       return;
//     }

//     // Derive base WS URL dynamically (secure if site is https)
//     const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
//     const host = window.location.host; // same host the SPA is served from
//     const WS_BASE = (import.meta)?.env?.VITE_WS_BASE || `${protocol}//${host}`;
//     const ws = new WebSocket(`${WS_BASE}/ws?token=${encodeURIComponent(token)}`);

//     ws.onopen = () => {
//       const pingInterval = setInterval(() => {
//         if (ws.readyState === WebSocket.OPEN) ws.send("ping");
//       }, 30000);
//       // @ts-ignore
//       ws.pingInterval = pingInterval;
//     };

//     ws.onmessage = (event) => {
//       try {
//         if (typeof event.data !== "string" || !event.data.startsWith("{")) return; // "pong" etc.

//         const { type, payload } = JSON.parse(event.data);

//         if (type === "chat_cleared" && payload.conversation_id === conversationId) {
//           setMessages([]);
//         }

//         if (type === "chat_message_created" && payload.conversation_id === conversationId) {
//           setMessages(prev => {
//             const ids = new Set(prev.map(msg => msg.id));
//             if (ids.has(payload.id)) {
//               console.warn("🟡 Duplicate message blocked from WebSocket:", payload.id);
//               return prev;
//             }
//             const out = [...prev, payload];
//             out.sort((a, b) => {
//               const da = getMessageDate(a);
//               const db = getMessageDate(b);
//               if (!da && !db) return 0;
//               if (!da) return -1;
//               if (!db) return 1;
//               return da - db;
//             });
//             return out;
//           });
//         }
//       } catch (err) {
//         console.error("❌ WebSocket parse error:", err);
//       }
//     };

//     ws.onerror = (err) => console.error("⚠️ WebSocket error:", err);

//     ws.onclose = () => {
//       // @ts-ignore
//       if (ws.pingInterval) clearInterval(ws.pingInterval);
//     };

//     return () => {
//       // @ts-ignore
//       if (ws.pingInterval) clearInterval(ws.pingInterval);
//       ws.close();
//     };
//   }, [conversationId, currentUserMember]);

//   // autoscroll
//   useEffect(() => {
//     messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
//   }, [messages, isAiProcessing, pendingAction]);

//   // mark read
//   useEffect(() => {
//     const markMessagesAsRead = async () => {
//       if (!conversationId || !currentUserMember || messages.length === 0) return;
//       try {
//         await Conversation.markAsRead(conversationId);
//         window.dispatchEvent(new CustomEvent('famly-chat-read', { detail: { conversationId } }));
//       } catch (error) {
//         console.error("Failed to mark messages as read:", error);
//       }
//     };
//     markMessagesAsRead();
//   }, [conversationId, currentUserMember, messages.length]);

//   const handleSendMessage = async () => {
//     if (!inputValue.trim()) return;
//     if (isSending || !currentUserMember) {
//       console.warn("Blocked send: isSending or missing user");
//       return;
//     }

//     setIsSending(true);
//     const content = inputValue.trim();
//     setInputValue('');

//     try {
//       await ChatMessage.create({
//         conversation_id: conversationId,
//         sender_id: currentUserMember.id,
//         content,
//         message_type: 'user_message',
//         read_by: [currentUserMember.id]
//       });

//       await Conversation.update(conversationId, {
//         last_message_preview: content,
//         last_message_timestamp: new Date().toISOString()
//       });
//     } catch (error) {
//       console.error("Error sending message:", error);
//       setInputValue(content); // restore
//       toast({ title: "Send Failed", variant: "destructive" , duration: 5000 });
//     } finally {
//       setIsSending(false);
//     }
//   };

//   const handleAiAction = async () => {
//     if (isAiProcessing || !aiAssistant) return;
//     setIsAiProcessing(true);
//     setPendingAction(null);

//     try {
//       const conversationHistory = messages.map(msg => {
//         const sender = familyMembers.find(m => m.id === msg.sender_id);
//         return `${sender?.name || 'Unknown'}: ${msg.content}`;
//       }).join('\n');

//       const currentUserFamilyId = currentUserMember?.family_id;
//       const safeFamilyMemberInfo = familyMembers
//         .filter(m => m.family_id === currentUserFamilyId && m.role !== 'ai_assistant')
//         .map(m => ({ id: m.id, name: m.name }));

//       const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone; // e.g. "Europe/Amsterdam"
//       const userTz = currentUserMember?.timezone || browserTz || "UTC";
//       const nowIso = new Date().toISOString();
//       const tzHint = userTz;

//       const response = await InvokeLLM({
//         prompt: `You are famly.ai, a helpful Dutch family assistant.

// Analyseer het HELE gesprek en lever:
// - een KORTE Nederlandse samenvatting
// - concrete TAKEN en AFSPRAKEN die nu aangemaakt moeten worden
// - optioneel WISHLIST-items

// Regels:
// - Antwoord ALLEEN met JSON (geen markdown of extra tekst).
// - Schrijf alle menselijke velden in het Nederlands (samenvatting, titels, beschrijvingen).
// - Gebruik ALLEEN bestaande family member IDs uit de lijst.
// - Kies bij voorkeur nabije datums/tijden (7–14 dagen) en geen verleden.
// - 24u notatie, ISO zonder tijdzone (YYYY-MM-DDTHH:MM:SS). Geen mm/dd formaat.
// - Als het vaag is: geef kleine, zekere acties. Liever weinig en goed.

// Heden (lokale tijd): ${nowIso} (${tzHint}).
// Interpreteer relatieve datums t.o.v. deze tijdzone en dit moment.

// Context:
// CHAT LOG:
// ---
// ${conversationHistory}
// ---

// Family Members (IDs bruikbaar): ${JSON.stringify(safeFamilyMemberInfo, null, 2)}
// Current User ID: ${currentUserMember?.id}
// Family ID: ${currentUserFamilyId}

// Return exact JSON:
// {
//   "summary": "korte NL samenvatting",
//   "tasks": [
//     {
//       "title": "string (NL, kort)",
//       "description": "string (NL, optioneel)",
//       "assigned_to": ["<family_member_id>", "..."],
//       "family_id": "${currentUserFamilyId}",
//       "due_time": "YYYY-MM-DDTHH:MM:SS (optioneel)"
//     }
//   ],
//   "events": [
//     {
//       "title": "string (NL, kort)",
//       "start_time": "YYYY-MM-DDTHH:MM:SS",
//       "end_time": "YYYY-MM-DDTHH:MM:SS",
//       "family_member_ids": ["<family_member_id>", "..."],
//       "family_id": "${currentUserFamilyId}",
//       "location": "string (optioneel)"
//     }
//   ],
//   "wishlist_items": [
//     {
//       "name": "string",
//       "url": "string (optioneel)",
//       "family_member_id": "<family_member_id>"
//     }
//   ]
// }`,
//         response_json_schema: {
//           type: "object",
//           properties: {
//             summary: { type: "string" },
//             tasks: {
//               type: "array",
//               items: {
//                 type: "object",
//                 properties: {
//                   title: { type: "string" },
//                   description: { type: "string" },
//                   assigned_to: { type: "array", items: { type: "string" } },
//                   family_id: { type: "string" },
//                   due_time: { type: "string" }
//                 },
//                 required: ["title", "assigned_to", "family_id"]
//               }
//             },
//             events: {
//               type: "array",
//               items: {
//                 type: "object",
//                 properties: {
//                   title: { type: "string" },
//                   start_time: { type: "string" },
//                   end_time: { type: "string" },
//                   family_member_ids: { type: "array", items: { type: "string" } },
//                   family_id: { type: "string" },
//                   location: { type: "string" }
//                 },
//                 required: ["title", "start_time", "end_time", "family_member_ids", "family_id"]
//               }
//             },
//             wishlist_items: {
//               type: "array",
//               items: {
//                 type: "object",
//                 properties: {
//                   name: { type: "string" },
//                   url: { type: "string" },
//                   family_member_id: { type: "string" }
//                 },
//                 required: ["name", "family_member_id"]
//               }
//             }
//           },
//           required: ["summary", "tasks", "events", "wishlist_items"],
//           anyOf: [
//             { properties: { tasks: { minItems: 1 } } },
//             { properties: { events: { minItems: 1 } } },
//             { properties: { wishlist_items: { minItems: 1 } } }
//           ]
//         },
//         strict: true,
//       });

//       const data = response?.data || {};
//       const summary = response?.summary ?? data.summary ?? "AI suggesties";
//       const tasks = response?.tasks ?? data.tasks ?? [];
//       const events = response?.events ?? data.events ?? [];
//       const wishlist = response?.wishlist_items ?? data.wishlist_items ?? [];

//       const createdAiMessage = await ChatMessage.create({
//         conversation_id: conversationId,
//         sender_id: aiAssistant.id,
//         content: summary,
//         message_type: 'ai_suggestion',
//         read_by: [aiAssistant.id],
//       });

//       if ((tasks && tasks.length) || (events && events.length) || (wishlist && wishlist.length)) {
//         const eventsWithSelection = (events || []).map((e, idx) => ({
//           id: e.id || `event-${Date.now()}-${idx}`,  // stable key for the list
//           selected: true,                             // pre-select so the checkbox is on
//           ...e,
//         }));

//         setPendingAction({
//           tasks,
//           events: eventsWithSelection,
//           wishlist_items: wishlist,
//           messageId: createdAiMessage.id
//         });
//       } else {
//         toast({ title: "Geen acties", description: "De AI vond geen duidelijke acties op basis van dit gesprek.", duration: 5000 });
//       }

//     } catch (error) {
//       console.error("AI action error:", error);
//       toast({ title: "AI Error", description: "Kon geen suggesties ophalen.", variant: "destructive", duration: 5000 });
//     } finally {
//       setIsAiProcessing(false);
//     }
//   };

//   const handleConfirmActions = async (confirmedTasks, confirmedEvents, confirmedWishlistItems = []) => {
//     try {
//       if (confirmedTasks.length > 0) await Task.bulkCreate(confirmedTasks);
//       if (confirmedEvents.length > 0) await ScheduleEvent.bulkCreate(confirmedEvents);
//       if (confirmedWishlistItems.length > 0) await WishlistItem.bulkCreate(confirmedWishlistItems);

//       if (confirmedTasks.length > 0 || confirmedEvents.length > 0 || confirmedWishlistItems.length > 0) {
//         toast({ title: "AI Suggestions Added", description: "Taken, events en wishlist items zijn toegevoegd.", duration: 5000 });
//       }
//     } catch (error) {
//       console.error("Error confirming AI actions:", error);
//       toast({ title: "Error", description: "Niet alles kon worden opgeslagen.", variant: "destructive", duration: 5000 });
//     } finally {
//       setPendingAction(null);
//     }
//   };

//   const getMember = (memberId) => familyMembers.find(m => m.id === memberId);

//   if (isLoading) {
//     return (
//       <div className="h-full flex items-center justify-center bg-gray-50">
//         <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
//       </div>
//     );
//   }

//   return (
//     <div className="h-full flex flex-col bg-gray-50 relative">
//       <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ scrollBehavior: 'smooth' }}>
//         <AnimatePresence>
//           {messages.map((msg, index) => {
//             const sender = getMember(msg.sender_id);

//             const isCurrentUser =
//               (currentUserMember?.id && msg.sender_id === currentUserMember.id) ||
//               (sender?.id && currentUserMember?.id && sender.id === currentUserMember.id);

//             const isAI = sender?.role === 'ai_assistant';
//             const isAiIntroduction = msg.message_type === 'ai_introduction';

//             if (isAiIntroduction) {
//               return (
//                 <motion.div
//                   key={msg.id || index}
//                   layout
//                   initial={{ opacity: 0, scale: 0.9 }}
//                   animate={{ opacity: 1, scale: 1 }}
//                   className="flex justify-center my-6"
//                 >
//                   <div className="bg-gradient-to-r from-green-100 to-emerald-100 border-2 border-green-300 rounded-xl px-6 py-4 max-w-md text-center shadow-lg">
//                     <div className="flex items-center justify-center gap-2 mb-2">
//                       <Bot className="w-5 h-5 text-green-600" />
//                       <span className="font-semibold text-green-800">AI Assistent</span>
//                     </div>
//                     <p className="text-sm text-green-700">{msg.content}</p>
//                     <p className="text-xs text-green-600 mt-2">
//                       {(() => {
//                         const d = getMessageDate(msg);
//                         return d ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
//                       })()}
//                     </p>
//                   </div>
//                 </motion.div>
//               );
//             }

//             return (
//               <motion.div key={msg.id || index} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
//                 <div className={`flex items-end gap-3 ${isCurrentUser ? 'justify-end' : ''}`}>
//                   {!isCurrentUser && sender ? (
//                     <div
//                       className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-xs shrink-0 ${isAI ? 'bg-gradient-to-r from-green-500 to-emerald-500' : ''}`}
//                       style={{ backgroundColor: isAI ? undefined : (sender.color || '#6b7280') }}
//                     >
//                       {isAI ? <Bot className="w-4 h-4" /> : (sender?.name || '?').charAt(0)}
//                     </div>
//                   ) : null}

//                   <div
//                     className={`max-w-[80%] px-4 py-2 rounded-2xl ${
//                       isCurrentUser
//                         ? 'bg-blue-500 text-white rounded-br-md'
//                         : isAI
//                           ? 'bg-gradient-to-r from-green-50 to-emerald-50 text-gray-800 rounded-bl-md shadow-sm border border-green-200'
//                           : 'bg-white text-gray-800 rounded-bl-md shadow-sm border'
//                     }`}
//                   >
//                     {!isCurrentUser && sender ? (
//                       <p
//                         className={`font-semibold text-xs mb-1 ${isAI ? 'text-green-600' : ''}`}
//                         style={{ color: isAI ? undefined : (sender.color || '#6b7280') }}
//                       >
//                         {sender.name}
//                       </p>
//                     ) : null}

//                     <p className="text-sm whitespace-pre-wrap">{msg.content}</p>

//                     {(() => {
//                       const d = getMessageDate(msg);
//                       const timeString = d
//                         ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
//                         : null;

//                       const seenBy = familyMembers.filter(
//                         (m) =>
//                           m.id !== msg.sender_id &&
//                           (participants || []).includes(m.id) &&
//                           (msg.read_by || []).includes(m.id)
//                       );

//                       const notSeenBy = familyMembers.filter(
//                         (m) =>
//                           m.id !== msg.sender_id &&
//                           (participants || []).includes(m.id) &&
//                           !(msg.read_by || []).includes(m.id)
//                       );

//                       return (
//                         <div className="flex justify-end gap-1 mt-1 items-end">
//                           {timeString ? (
//                             <p className={`text-xs ${isCurrentUser ? 'text-blue-100' : 'text-gray-500'}`}>
//                               {timeString}
//                             </p>
//                           ) : null}

//                           {seenBy.length > 0 ? (
//                             <div className="flex -space-x-1 ml-2">
//                               {seenBy.map((member) => (
//                                 <span key={member.id} title={`Seen by ${member.name}`} className="relative z-10">
//                                   <svg className="w-3.5 h-3.5 -ml-1.5" viewBox="0 0 24 24" fill={member.color || '#6b7280'}>
//                                     <path d="M1 12l5 5L20 4" stroke="currentColor" strokeWidth="2" fill="none" />
//                                   </svg>
//                                 </span>
//                               ))}
//                             </div>
//                           ) : null}

//                           {notSeenBy.length > 0 ? (
//                             <div className="flex -space-x-1 ml-1 opacity-50">
//                               {notSeenBy.map((member) => (
//                                 <span key={member.id} title={`Not yet seen by ${member.name}`} className="relative z-0">
//                                   <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#d1d5db">
//                                     <path d="M1 12l5 5L20 4" stroke="currentColor" strokeWidth="2" fill="none" />
//                                   </svg>
//                                 </span>
//                               ))}
//                             </div>
//                           ) : null}
//                         </div>
//                       );
//                     })()}
//                   </div>
//                 </div>

//                 {pendingAction && msg.id === pendingAction.messageId ? (
//                   <div className={`mt-2 ${isCurrentUser ? 'ml-auto' : 'ml-11'}`}>
//                     {pendingAction.tasks && pendingAction.tasks.length > 0 ? (
//                       <TasksReviewer
//                         tasks={pendingAction.tasks}
//                         familyMembers={familyMembers}
//                         onConfirm={(confirmed) => handleConfirmActions(confirmed, [], [])}
//                         onCancel={() => setPendingAction(null)}
//                       />
//                     ) : null}

//                 {pendingAction.events && pendingAction.events.length > 0 && (
//                   <VacationEventsReview
//                     events={pendingAction.events}
//                     onEventsUpdate={(updated) =>
//                       setPendingAction(prev => (prev ? { ...prev, events: updated } : prev))
//                     }
//                     onConfirm={(confirmed) => handleConfirmActions([], confirmed, [])}
//                     onCancel={() => setPendingAction(null)}
//                   />
//                 )}

//                     {pendingAction.wishlist_items && pendingAction.wishlist_items.length > 0 ? (
//                       <div className="p-3 bg-purple-50/50 border border-purple-200 rounded-lg shadow-sm space-y-2">
//                         <h4 className="font-semibold text-sm text-purple-800">Wishlist Items:</h4>
//                         {pendingAction.wishlist_items.map((item, i) => {
//                           const member = familyMembers.find(m => m.id === item.family_member_id);
//                           return (
//                             <div key={i} className="text-sm bg-white p-2 rounded border">
//                               <strong>{item.name}</strong> voor {member?.name}
//                             </div>
//                           );
//                         })}
//                         <div className="flex justify-end gap-2 pt-2">
//                           <Button variant="ghost" size="sm" onClick={() => setPendingAction(null)}>Cancel</Button>
//                           <Button
//                             size="sm"
//                             onClick={() => handleConfirmActions([], [], pendingAction.wishlist_items)}
//                             className="bg-purple-600 hover:bg-purple-700"
//                           >
//                             Add to Wishlist
//                           </Button>
//                         </div>
//                       </div>
//                     ) : null}
//                   </div>
//                 ) : null}
//               </motion.div>
//             );
//           })}
//         </AnimatePresence>

//         {isAiProcessing && (
//           <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-end gap-3">
//             <div className="w-8 h-8 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center shrink-0">
//               <Bot className="w-4 h-4 text-white" />
//             </div>
//             <div className="bg-gradient-to-r from-green-50 to-emerald-50 text-gray-800 rounded-2xl rounded-bl-md shadow-sm border border-green-200 px-4 py-2">
//               <div className="flex items-center gap-2">
//                 <Loader2 className="w-4 h-4 animate-spin text-green-600" />
//                 <span className="text-sm text-green-600">AI analyseert het gesprek...</span>
//               </div>
//             </div>
//           </motion.div>
//         )}

//         <div ref={messagesEndRef} />
//       </div>

//       {aiAssistant && (
//         <div className="absolute bottom-24 right-6 z-10">
//           <Button
//             onClick={handleAiAction}
//             disabled={isAiProcessing || isSending}
//             className="rounded-full h-14 w-14 p-0 bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-lg hover:opacity-90 transition-all duration-300 transform hover:scale-110"
//             aria-label="AI Action"
//           >
//             {isAiProcessing ? <Loader2 className="h-6 w-6 animate-spin" /> : <Sparkles className="h-6 w-6" />}
//           </Button>
//         </div>
//       )}

//       <div className="flex-shrink-0 p-4 bg-white border-t border-gray-200">
//         <div className="flex items-center gap-3">
//           <Textarea
//             value={inputValue}
//             onChange={(e) => setInputValue(e.target.value)}
//             placeholder="Typ een bericht..."
//             className="flex-1 resize-none min-h-[40px] max-h-[100px]"
//             onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
//             disabled={isSending || isAiProcessing}
//           />
//           <Button onClick={handleSendMessage} disabled={!inputValue.trim() || isSending || isAiProcessing} className="bg-blue-500 hover:bg-blue-600">
//             {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
//           </Button>
//         </div>
//       </div>
//     </div>
//   );
// }
