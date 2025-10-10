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

// ===== Helpers =====

// ---- date helpers (robust to missing/legacy fields) ----
const getMessageISO = (m) =>
  (m && (m.created_date || m.created_at || m.created_time)) || null;

const getMessageDate = (m) => {
  const iso = getMessageISO(m);
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
};

// Oldest → newest (so newest appears at the bottom naturally)
const sortMessages = (arr) => {
  const next = [...arr];
  next.sort((a, b) => {
    const da = getMessageDate(a);
    const db = getMessageDate(b);
    if (!da && !db) return 0;
    if (!da) return -1;   // undated → float to top
    if (!db) return 1;
    return da - db;       // oldest first
  });
  return next;
};

// Returns epoch ms or null
const ts = (msg) => {
  const d = getMessageDate(msg);
  return d ? d.getTime() : null;
};

// Treat messages as "same" if same sender+content and within 10s
const isSameMessage = (a, b) => {
  if (!a || !b) return false;
  if (a.sender_id !== b.sender_id) return false;
  if ((a.content || "").trim() !== (b.content || "").trim()) return false;
  const ta = ts(a), tb = ts(b);
  if (!ta || !tb) return false;
  return Math.abs(ta - tb) <= 10_000;
};


export default function ChatWindow({ conversationId, participants }) {
  const [messages, setMessages] = useState([]);
  const [familyMembers, setFamilyMembers] = useState([]);
  const [currentUserMember, setCurrentUserMember] = useState(null);
  const [aiAssistant, setAiAssistant] = useState(null);

  const [isLoading, setIsLoading] = useState(true);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isAiProcessing, setIsAiProcessing] = useState(false);

  const [pendingAction, setPendingAction] = useState(null); // {tasks, events, wishlist_items, messageId}
  const messagesEndRef = useRef(null);
  const hasSentIntroRef = useRef(false);
  const { toast } = useToast();

  // WS refs
  const wsRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const retryRef = useRef(0);

  // ---- AI helper: ensure AI member exists (frontend best effort; server is authoritative anyway) ----
  const ensureAIAssistant = async (familyId) => {
    const all = await FamilyMember.list();
    let ai = all.find(m => m.role === 'ai_assistant' && m.family_id === familyId);
    if (!ai) {
      try {
        ai = await FamilyMember.create({
          name: "AI Assistent",
          role: "ai_assistant",
          family_id: familyId,
          color: "#10b981",
          language: "nl"
        });
      } catch {
        // server may already create/own it; swallow
      }
    }
    return ai || (await FamilyMember.list()).find(m => m.role === 'ai_assistant' && m.family_id === familyId) || null;
  };

  // ---- AI intro message (idempotent) ----
  const introduceAI = async (aiMember, convoId) => {
    const welcome = "🤖 Hoi! Ik ben jullie AI-assistent. Klik op ✨ rechts om suggesties te krijgen voor taken en afspraken.";
    try {
      const created = await ChatMessage.create({
        conversation_id: convoId,
        sender_id: aiMember.id,           // server will override to AI if needed
        content: welcome,
        message_type: 'ai_introduction',
        read_by: [aiMember.id],
      });
      setMessages(prev =>
        sortMessages(prev.some(m => m.id === created.id) ? prev : [...prev, created])
      );
      await Conversation.update(convoId, {
        last_message_preview: "AI assistent heeft zich aangesloten.",
        last_message_timestamp: new Date().toISOString()
      });
      return true;
    } catch (e) {
      // If backend returns the existing intro, your fetch wrapper will already parse JSON correctly.
      return false;
    }
  };

  // ---- Initial load ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!conversationId) return;
      setIsLoading(true);
      setPendingAction(null);
      try {
        const meUser = await User.me();
        const meMember = await FamilyMember.me();
        if (cancelled) return;
        setCurrentUserMember(meMember);

        const ai = await ensureAIAssistant(meUser.family_id);
        if (cancelled) return;
        setAiAssistant(ai);

        const members = await FamilyMember.list();
        if (cancelled) return;
        setFamilyMembers(members);

        let initial = await ChatMessage.filter({ conversation_id: conversationId }, 'created_date');
        if (cancelled) return;

        // Ensure intro exists (server idempotent)
        if (ai && !hasSentIntroRef.current) {
          const hasIntro = initial.some(m => m.message_type === 'ai_introduction');
          if (!hasIntro) {
            const ok = await introduceAI(ai, conversationId);
            if (ok) {
              hasSentIntroRef.current = true;
              initial = await ChatMessage.filter({ conversation_id: conversationId }, 'created_date');
            } else {
              hasSentIntroRef.current = true;
            }
          } else {
            hasSentIntroRef.current = true;
          }
        }

        // Deduplicate AI intros (keep the first one only)
        const seenIntro = false;
        const unique = [];
        for (const m of sortMessages(initial)) {
          if (m.message_type === 'ai_introduction') {
            if (unique.find(x => x.message_type === 'ai_introduction')) continue;
          }
          unique.push(m);
        }

        setMessages(sortMessages(unique));
        window.dispatchEvent(new CustomEvent('famly-chat-opened', { detail: { conversationId } }));
      } catch (err) {
        console.error("Chat initialization error:", err);
  toast({ duration: 5000,
          title: "Chat Error",
          description: "Kon chat niet initialiseren.",
          variant: "destructive",
          duration: 5000
        });
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [conversationId, toast]);

  // ---- WebSocket live updates with reconnect ----
  useEffect(() => {
    if (!conversationId || !currentUserMember) return;

    const token = localStorage.getItem("famlyai_token");
    if (!token) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const WS_BASE = (import.meta)?.env?.VITE_WS_BASE || `${protocol}//${host}`;

    const connect = () => {
      const ws = new WebSocket(`${WS_BASE}/ws?token=${encodeURIComponent(token)}`);
      wsRef.current = ws;

      ws.onopen = () => {
        retryRef.current = 0;
        pingIntervalRef.current = window.setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send("ping");
        }, 30000);
      };

      ws.onmessage = (event) => {
        try {
          if (typeof event.data !== "string" || !event.data.startsWith("{")) return;
          const { type, payload } = JSON.parse(event.data);

          if (type === "chat_cleared" && payload.conversation_id === conversationId) {
            setMessages([]);
          }

          if (type === "chat_message_created" && payload.conversation_id === conversationId) {
            setMessages(prev => {
              // 1) if id already present, nothing to do
              if (prev.some(m => m.id === payload.id)) return prev;

              // 2) if we have a pending optimistic with the same sender+content near in time, drop the temp
              const withoutTemps = prev.filter(m => !(m.__pending && isSameMessage(m, payload)));

              // 3) also block duplicates without ids (just in case)
              if (withoutTemps.some(m => isSameMessage(m, payload))) return withoutTemps;

              // 4) finally append and sort (oldest → newest = newest ends up at bottom)
              return sortMessages([...withoutTemps, payload]);
            });
          }

        } catch (err) {
          console.warn("WS parse error:", err);
        }
      };

      ws.onerror = (e) => console.warn("WS error:", e);

      ws.onclose = () => {
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }
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

  // ---- autoscroll ----
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAiProcessing, pendingAction]);

  // ---- mark read ----
  useEffect(() => {
    (async () => {
      if (!conversationId || !currentUserMember || messages.length === 0) return;
      try {
        await Conversation.markAsRead(conversationId);
        window.dispatchEvent(new CustomEvent('famly-chat-read', { detail: { conversationId } }));
      } catch (e) {
        // don't block UI
      }
    })();
  }, [conversationId, currentUserMember, messages.length]);

  // ---- Send message (optimistic + reconcile) ----
  const handleSendMessage = async () => {
  if (!inputValue.trim()) return;
  if (isSending || !currentUserMember) return;

  setIsSending(true);
  const content = inputValue.trim();
  setInputValue('');

  const nowIso = new Date().toISOString();
  const tempId = `temp-${Date.now()}`;
  const pendingMsg = {
    id: tempId,
    conversation_id: conversationId,
    sender_id: currentUserMember.id,
    content,
    message_type: 'user_message',
    read_by: [currentUserMember.id],
    created_date: nowIso,
    __pending: true,
  };

  setMessages(prev => sortMessages([...prev, pendingMsg]));

  try {
    const created = await ChatMessage.create({
      conversation_id: conversationId,
      sender_id: currentUserMember.id,
      content,
      message_type: 'user_message',
      read_by: [currentUserMember.id],
      // let backend stamp its own time; we’ll reconcile on WS too
    });

    // Reconcile temp → created (by replacing the temp)
    setMessages(prev => {
      // If WS already delivered the same message, drop the temp
      const already = prev.find(m => m.id === created.id) ||
                      prev.find(m => !m.id && isSameMessage(m, created));
      if (already) {
        return sortMessages(prev.filter(m => m.id !== tempId));
      }
      // Otherwise replace the temp with server-created
      const next = prev.map(m => (m.id === tempId ? created : m));
      return sortMessages(next);
    });

    await Conversation.update(conversationId, {
      last_message_preview: content,
      last_message_timestamp: new Date().toISOString()
    });
  } catch (e) {
    console.error("Send failed:", e);
    setMessages(prev => prev.map(m => (m.id === tempId ? { ...m, __pending: false, __failed: true } : m)));
    setInputValue(content);
    toast({ title: "Versturen mislukt", variant: "destructive", duration: 5000 });
  } finally {
    setIsSending(false);
  }
};


  // ---- AI button: call LLM, create AI message anchor, open reviewers ----
  const handleAiAction = async () => {
    if (isAiProcessing || !aiAssistant) return;
    setIsAiProcessing(true);
    setPendingAction(null);

    try {
      // Build conversation history
      const history = messages.map(msg => {
        const sender = familyMembers.find(m => m.id === msg.sender_id);
        return `${sender?.name || 'Onbekend'}: ${msg.content}`;
      }).join('\n');

      const currentFamilyId = currentUserMember?.family_id;
      const safeMembers = familyMembers
        .filter(m => m.family_id === currentFamilyId && m.role !== 'ai_assistant')
        .map(m => ({ id: m.id, name: m.name }));

      const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const tz = currentUserMember?.timezone || browserTz || "UTC";
      const nowIso = new Date().toISOString();

      const response = await InvokeLLM({
        prompt: `You are famly.ai, a helpful Dutch family assistant.

Analyseer het HELE gesprek en lever:
- een KORTE Nederlandse samenvatting
- concrete TAKEN en AFSPRAKEN die nu aangemaakt moeten worden
- optioneel WISHLIST-items

Regels:
- Antwoord ALLEEN met JSON (geen markdown).
- Schrijf alle menselijke velden in het Nederlands.
- Gebruik ALLEEN bestaande family member IDs uit de lijst.
- Kies bij voorkeur nabije datums/tijden (7–14 dagen) en geen verleden.
- 24u notatie, ISO zonder tijdzone (YYYY-MM-DDTHH:MM:SS).
- Als het vaag is: geef kleine, zekere acties.

Heden (lokale tijd): ${nowIso} (${tz}).

Context:
CHAT LOG:
---
${history}
---

Family Members (IDs bruikbaar): ${JSON.stringify(safeMembers, null, 2)}
Current User ID: ${currentUserMember?.id}
Family ID: ${currentFamilyId}

Return exact JSON:
{
  "summary": "korte NL samenvatting",
  "tasks": [
    {
      "title": "string",
      "description": "string (optioneel)",
      "assigned_to": ["<family_member_id>", "..."],
      "family_id": "${currentFamilyId}",
      "due_time": "YYYY-MM-DDTHH:MM:SS (optioneel)"
    }
  ],
  "events": [
    {
      "title": "string",
      "start_time": "YYYY-MM-DDTHH:MM:SS",
      "end_time": "YYYY-MM-DDTHH:MM:SS",
      "family_member_ids": ["<family_member_id>", "..."],
      "family_id": "${currentFamilyId}",
      "location": "string (optioneel)"
    }
  ],
  "wishlist_items": [
    { "name": "string", "url": "string (optioneel)", "family_member_id": "<family_member_id>" }
  ]
}`,
        response_json_schema: {
          type: "object",
          properties: {
            summary: { type: "string" },
            tasks: { type: "array", items: { type: "object" } },
            events: { type: "array", items: { type: "object" } },
            wishlist_items: { type: "array", items: { type: "object" } },
          },
          required: ["summary", "tasks", "events", "wishlist_items"],
        },
        strict: true,
      });

      const data = response?.data || {};
      const summary = response?.summary ?? data.summary ?? "AI suggesties";
      const tasks = response?.tasks ?? data.tasks ?? [];
      const events = response?.events ?? data.events ?? [];
      const wishlist = response?.wishlist_items ?? data.wishlist_items ?? [];

      // Create the AI suggestion anchor message (so it appears in the thread)
      const aiMsg = await ChatMessage.create({
        conversation_id: conversationId,
        sender_id: aiAssistant.id, // server will coerce to AI member
        content: summary,
        message_type: 'ai_suggestion',
        read_by: [aiAssistant.id],
      });

      const eventsWithSelection = (events || []).map((e, idx) => ({
        id: e.id || `event-${Date.now()}-${idx}`,
        selected: true,
        ...e,
      }));

      if ((tasks && tasks.length) || (events && events.length) || (wishlist && wishlist.length)) {
        setPendingAction({
          tasks,
          events: eventsWithSelection,
          wishlist_items: wishlist,
          messageId: aiMsg.id,
        });
      } else {
        toast({ title: "Geen acties", description: "De AI vond geen duidelijke acties op basis van dit gesprek.", duration: 5000 });
      }
    } catch (e) {
      console.error("AI action error:", e);
      toast({ title: "AI Error", description: "Kon geen suggesties ophalen.", variant: "destructive", duration: 5000 });
    } finally {
      setIsAiProcessing(false);
    }
  };

  const handleConfirmActions = async (confirmedTasks, confirmedEvents, confirmedWishlistItems = []) => {
    try {
      if (confirmedTasks && confirmedTasks.length) await Task.bulkCreate(confirmedTasks);
      if (confirmedEvents && confirmedEvents.length) await ScheduleEvent.bulkCreate(confirmedEvents);
      if (confirmedWishlistItems && confirmedWishlistItems.length) await WishlistItem.bulkCreate(confirmedWishlistItems);

      if ((confirmedTasks && confirmedTasks.length) || (confirmedEvents && confirmedEvents.length) || (confirmedWishlistItems && confirmedWishlistItems.length)) {
        toast({ title: "Toegevoegd", description: "Taken, events en wishlist items zijn toegevoegd.", duration: 5000 });
      }
    } catch (e) {
      console.error("Confirm actions error:", e);
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
                                <span key={member.id} title={`Gezien door ${member.name}`} className="relative z-10">
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
                                <span key={member.id} title={`Nog niet gezien door ${member.name}`} className="relative z-0">
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

                {/* Anchor-mode: render reviewers under the AI suggestion message */}
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
                          <Button variant="ghost" size="sm" onClick={() => setPendingAction(null)}>Annuleren</Button>
                          <Button
                            size="sm"
                            onClick={() => handleConfirmActions([], [], pendingAction.wishlist_items)}
                            className="bg-purple-600 hover:bg-purple-700"
                          >
                            Toevoegen
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

        {/* Fallback-mode (if WS delay) */}
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
                  <Button variant="ghost" size="sm" onClick={() => setPendingAction(null)}>Annuleren</Button>
                  <Button
                    size="sm"
                    onClick={() => handleConfirmActions([], [], pendingAction.wishlist_items)}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    Toevoegen
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
