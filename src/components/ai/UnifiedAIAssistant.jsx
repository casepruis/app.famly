// (ReviewAndConfirmPanel removed, now using ActionReviewPanel)
// UnifiedAIAssistant.jsx (CLEANED)
import React, { useState, useRef, useEffect } from 'react';
import ActionReviewPanel from '../common/ActionReviewPanel';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Mic, Send, Bot, Loader2, MessageCircle, Check, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/components/common/LanguageProvider";
import { InvokeLLM } from '@/api/integrations';
import { Task, ScheduleEvent, WishlistItem, ChatMessage, Conversation } from '@/api/entities';
import TasksReviewer from '../chat/TasksReviewer';
import VacationEventsReview from '../chat/VacationEventsReview';

/** ===================== Helpers & Constants ===================== */

const EVENT_CATEGORIES = [
  "school", "work", "sports", "medical", "social", "family", "other", "holiday", "studyday", "outing"
];

const isCompleteTask = (p) => p && p.title && p.family_id && p.status && p.due_date;
const isCompleteEvent = (p) => p && p.title && p.family_id && p.start_time && p.end_time;
const isCompleteWishlistItem = (p) => p && p.name; // url optional

const isoLocal = (d) => {
  if (!d) return '';
  try {
    return new Date(d).toISOString();
  } catch {
    return '';
  }
};

function toLocalInputValue(isoOrLocalString) {
  if (!isoOrLocalString) return "";
  const d = new Date(isoOrLocalString);
  if (isNaN(d.getTime())) {
    const m = isoOrLocalString.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/);
    return m ? m[1] : "";
  }
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromLocalInputValue(localValue) {
  if (!localValue) return "";
  return localValue.length === 16 ? `${localValue}:00` : localValue;
}

function formatDateTimeEU(value, localeHint) {
  const locale = localeHint || "en-GB";
  try {
    return new Intl.DateTimeFormat(locale, {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    }).format(new Date(value));
  } catch { return value; }
}

const summarizeList = (items, kind, locale) => {
  if (!Array.isArray(items) || !items.length) return 'Nothing found.';
  if (kind === 'wishlist') {
    return items.map(i => `• ${i.name}${i.url ? ` — ${i.url}` : ''}`).join('\n');
  }
  if (kind === 'events') {
    return items.map(e => {
      const st = formatDateTimeEU(e.start_time, locale);
      const en = e.end_time ? ` → ${formatDateTimeEU(e.end_time, locale)}` : '';
      return `• ${e.title} — ${st}${en}${e.location ? ` @ ${e.location}` : ''}`;
    }).join('\n');
  }
  if (kind === 'tasks') {
    return items.map(tk => `• [${tk.status}] ${tk.title}${tk.due_date ? ` (due ${formatDateTimeEU(tk.due_date, locale)})` : ''}`).join('\n');
  }
  return '';
};

function resolveTargetMember(messageText, familyMembers, currentUserMember) {
  const text = (messageText || "").toLowerCase();
  const mentionsSelf = /\b(my|mijn|me|ik|mijn lijst|my wishlist)\b/i.test(messageText || "");
  if (mentionsSelf && currentUserMember?.id) return currentUserMember;

  const candidates = (familyMembers || [])
    .filter(Boolean)
    .map(m => ({ ...m, _score: m.name ? (text.includes(m.name.toLowerCase()) ? m.name.length : 0) : 0 }))
    .filter(m => m._score > 0)
    .sort((a, b) => b._score - a._score);
  if (candidates.length > 0) return candidates[0];
  if (currentUserMember?.id) return currentUserMember;
  return Array.isArray(familyMembers) && familyMembers.length ? familyMembers[0] : null;
}

/** ===================== Component ===================== */

export default function UnifiedAIAssistant({ conversationContext, allFamilyMembers = [], user, onUpdate }) {
  const { t, currentLanguage } = useLanguage();
  const [inputValue, setInputValue] = useState('');
  const STORAGE_KEY = 'famlyai_ai_conversation';
  const [conversation, setConversation] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingAction, setPendingAction] = useState(null); // {action_type, action_payload}
  const conversationEndRef = useRef(null);

  // persist + autoscroll
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(conversation)); } catch {}
    conversationEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation, pendingAction]);

  // reset on user change
  useEffect(() => {
    setConversation([]);
    setPendingAction(null);
    setInputValue('');
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }, [user?.id]);

  const handleClearChat = () => {
    setConversation([]);
    setPendingAction(null);
    setInputValue('');
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  };

  /** ----------------- Action executor ----------------- */
  const executeAction = async ({ action_type, action_payload }) => {
    try {
      switch (action_type) {
        case 'create_task': {
          const payload = { ...action_payload };
          if (!payload.family_id) payload.family_id = user?.family_id;
          await Task.create(payload);
          setConversation(prev => [...prev, { role: 'assistant', content: t('taskCreated') || 'Task created!' }]);
          break;
        }
        case 'create_event': {
          const payload = { ...action_payload };
          if (!payload.family_id) payload.family_id = user?.family_id;
          await ScheduleEvent.create(payload);
          setConversation(prev => [...prev, { role: 'assistant', content: t('eventCreated') || 'Event created!' }]);
          break;
        }
        case 'create_multiple_events': {
          const events = (action_payload?.events || []).filter(Boolean);
          for (const ev of events) {
            const payload = { ...ev };
            if (!payload.family_id) payload.family_id = user?.family_id;
            await ScheduleEvent.create(payload);
          }
          setConversation(prev => [...prev, { role: 'assistant', content: t('eventsCreated') || 'Events created!' }]);
          break;
        }
        case 'add_to_wishlist': {
          const payload = { ...action_payload };
          await WishlistItem.create(payload);
          setConversation(prev => [...prev, { role: 'assistant', content: t('wishlistItemAdded') || 'Wishlist item added!' }]);
          break;
        }
        case 'add_multiple_to_wishlist': {
          const items = (action_payload?.items || []).filter(Boolean);
          for (const it of items) await WishlistItem.create(it);
          setConversation(prev => [...prev, { role: 'assistant', content: t('wishlistItemsAdded') || 'Wishlist items added!' }]);
          break;
        }
        case 'update_task_status': {
          const { id, status } = action_payload || {};
          if (id && status) {
            await Task.update(id, { status });
            setConversation(prev => [...prev, { role: 'assistant', content: t('taskUpdated') || 'Task updated!' }]);
          } else {
            setConversation(prev => [...prev, { role: 'assistant', content: t('aiError') || 'Missing task id/status.' }]);
          }
          break;
        }
        case 'convert_event_to_task': {
          const { event_id } = action_payload || {};
          if (event_id) {
            await ScheduleEvent.toTask(event_id);
            setConversation(prev => [...prev, { role: 'assistant', content: t('eventConvertedToTask') || 'Event converted to task!' }]);
          } else {
            setConversation(prev => [...prev, { role: 'assistant', content: t('aiError') || 'Missing event id.' }]);
          }
          break;
        }
        case 'convert_task_to_event': {
          const { task_id } = action_payload || {};
          if (task_id) {
            await Task.toEvent(task_id);
            setConversation(prev => [...prev, { role: 'assistant', content: t('taskConvertedToEvent') || 'Task converted to event!' }]);
          } else {
            setConversation(prev => [...prev, { role: 'assistant', content: t('aiError') || 'Missing task id.' }]);
          }
          break;
        }
        default:
          setConversation(prev => [...prev, { role: 'assistant', content: t('aiError') || 'Unknown action.' }]);
      }

      // optional callback
      onUpdate?.();
    } catch (err) {
      console.error('executeAction error:', err);
      setConversation(prev => [...prev, { role: 'assistant', content: t('aiError') || "I couldn't complete that action. Please try again." }]);
    }
  };

  /** ----------------- Sending flow ----------------- */
  const handleSend = async (messageText) => {
    if (isProcessing || !messageText?.trim()) return;

    setPendingAction(null);
    const userMsg = { role: 'user', content: messageText };
    setConversation(prev => [...prev, userMsg]);
    setInputValue('');
    setIsProcessing(true);

    try {
      const familyMembers = Array.isArray(allFamilyMembers) ? allFamilyMembers : [];
      const currentUserMember = user ? familyMembers.find(m => m.user_id === user.id) : null;
      const familyMemberInfo = familyMembers.map(m => ({ id: m.id, name: m.name }));
      const familyId = user?.family_id || null;

      if (!familyId) {
        setConversation(prev => [
          ...prev,
          { role: 'assistant', content: t('noFamilyIdError') || "I can't do that without a family context. Please set up or join a family first." }
        ]);
        setIsProcessing(false);
        return;
      }

      // Build conversation history and context (like ChatWindow)
      const llmHistory = [...conversation, userMsg].map(msg => {
        return `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`;
      }).join('\n');

      const currentFamilyId = user?.family_id;
      const safeMembers = allFamilyMembers
        .filter(m => m.family_id === currentFamilyId)
        .map(m => ({ id: m.id, name: m.name }));
      const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const tz = browserTz || "UTC";
      const nowIso = new Date().toISOString();

      // STRONGER PROMPT: Always extract actionable items if present, never return empty arrays if user asks for something actionable
      const response = await InvokeLLM({
        prompt: `You are famly.ai, a helpful family assistant.\n\nAnalyse the conversation and ALWAYS extract actionable items (tasks, events, wishlist) from the user's last message if any requests, wishes, or to-dos are present.\n- If details are missing, make reasonable assumptions.\n- If the user asks for something actionable, NEVER return empty arrays.\n- If nothing actionable is present, return empty arrays.\n\nProvide:\n- a SHORT summary\n- concrete TASKS and EVENTS to create now\n- optional WISHLIST items\n\nRules:\n- Respond ONLY with JSON (no markdown).\n- Write all human fields in the user's language.\n- Use ONLY existing family member IDs from the list.\n- Prefer near dates/times (7–14 days), not the past.\n- 24h notation, ISO without timezone (YYYY-MM-DDTHH:MM:SS).\n- If vague: suggest small, certain actions.\n\nNow (local time): ${nowIso} (${tz}).\n\nContext:\nCHAT LOG:\n---\n${llmHistory}\n---\n\nFamily Members (IDs usable): ${JSON.stringify(safeMembers, null, 2)}\nCurrent User ID: ${user?.id}\nFamily ID: ${currentFamilyId}\n\nReturn exact JSON:\n{\n  "summary": "short summary",\n  "tasks": [\n    {\n      "title": "string",\n      "description": "string (optional)",\n      "assigned_to": ["<family_member_id>", "..."],\n      "family_id": "${currentFamilyId}",\n      "due_date": "YYYY-MM-DDTHH:MM:SS (optional)"\n    }\n  ],\n  "events": [\n    {\n      "title": "string",\n      "start_time": "YYYY-MM-DDTHH:MM:SS",\n      "end_time": "YYYY-MM-DDTHH:MM:SS",\n      "family_member_ids": ["<family_member_id>", "..."],\n      "family_id": "${currentFamilyId}",\n      "location": "string (optional)"\n    }\n  ],\n  "wishlist_items": [\n    { "name": "string", "url": "string (optional)", "family_member_id": "<family_member_id>" }\n  ]\n}`,
        response_json_schema: {
          type: "object",
          properties: {
            summary: { type: "string" },
            tasks: { type: "array", items: { type: "object", properties: { title: { type: "string" } }, required: ["title"] } },
            events: { type: "array", items: { type: "object", properties: { title: { type: "string" }, start_time: { type: "string" }, end_time: { type: "string" }, family_id: { type: "string" } }, required: ["title", "start_time", "end_time", "family_id"] } },
            wishlist_items: { type: "array", items: { type: "object", properties: { name: { type: "string" } }, required: ["name"] } },
          },
          required: ["summary", "tasks", "events", "wishlist_items"],
        },
        strict: true,
      });

      const data = response?.data || response || {};
      const summary = data.summary ?? "AI suggesties";
      const tasks = data.tasks ?? [];
      const events = data.events ?? [];
      const wishlist = data.wishlist_items ?? [];

      // Fallback: If user asked for something actionable but LLM returned nothing, show a helpful message
      const userAskedForAction = /\b(task|event|afspraak|todo|to-do|wishlist|verlanglijst|add|maak|create|plan|schedule|show|toon|add|voeg toe|wens|wish|willen|wil|moet|must|should|zou moeten|kan|could|can|please|alsjeblieft|remind|herinner|remember|buy|koop|kopen|organiseer|organize|arrange|regel|fix|done|klaar|af|finish|voltooi|complete)\b/i.test(messageText);
      const hasActions = (tasks && tasks.length) || (events && events.length) || (wishlist && wishlist.length);

      // Always show the summary message (no hasAction here)
      setConversation(prev => ([
        ...prev,
        { role: 'assistant', content: summary }
      ]));

      const eventsWithSelection = (events || []).map((e, idx) => ({
        id: e.id || `event-${Date.now()}-${idx}`,
        selected: true,
        ...e,
      }));

      if (hasActions) {
        setPendingAction({
          action_payload: {
            tasks,
            events: eventsWithSelection,
            items: wishlist,
          }
        });
      } else if (userAskedForAction) {
        setConversation(prev => ([
          ...prev,
          { role: 'assistant', content: t('noActionsFound') || "I couldn't extract any actionable items from your message. Please rephrase or add more details." }
        ]));
      }

      // For array-based flow (tasks/events/wishlist), always show review panel if actionable items exist
      // Only use the switch for legacy single-action flows (action_type)
      // This ensures the review panel appears and actions can be confirmed/applied
      if (!hasActions && data.action_type) {
        // Only fallback to legacy switch if no array-based actions
        const type = data.action_type;
        let aiResponse = null;
        let nextPending = null;
        let hasAction = false;
        const autoApply = true;
        switch (type) {
          case 'convert_event_to_task': {
            const payload = data.action_payload || {};
            if (payload.event_id) {
              await executeAction({ action_type: 'convert_event_to_task', action_payload: payload });
            } else {
              aiResponse = t('aiError') || 'Missing event id.';
            }
            break;
          }
          case 'convert_task_to_event': {
            const payload = data.action_payload || {};
            if (payload.task_id) {
              await executeAction({ action_type: 'convert_task_to_event', action_payload: payload });
            } else {
              aiResponse = t('aiError') || 'Missing task id.';
            }
            break;
          }
          case 'clarify':
            aiResponse = data.clarification_question;
            break;
          case 'chat':
          default:
            aiResponse = data.response;
            // Persist AI chat suggestion into a conversation if present
            if (conversationContext?.type === 'chat' && user?.family_id && aiResponse) {
              try {
                const aiMember = allFamilyMembers.find(m => m.role === 'ai_assistant');
                if (aiMember) {
                  await ChatMessage.create({
                    conversation_id: conversationContext.conversationId,
                    sender_id: aiMember.id,
                    content: aiResponse,
                    message_type: 'ai_suggestion'
                  });
                  await Conversation.update(conversationContext.conversationId, {
                    last_message_preview: aiResponse.substring(0, 100),
                    last_message_timestamp: new Date().toISOString()
                  });
                }
              } catch (e) {
                // non-fatal
                console.warn('Failed to persist AI message:', e);
              }
            }
            break;
        }
        setPendingAction(null);
        if (aiResponse) {
          setConversation(prev => [
            ...prev,
            { role: 'assistant', content: aiResponse, hasAction, action: nextPending || null }
          ]);
        }
      }

    } catch (error) {
      console.error("Error processing message:", error);
      setConversation(prev => [
        ...prev,
        { role: 'assistant', content: t('aiError') || "Sorry, I had trouble with that. Could you rephrase?" }
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (inputValue.trim()) handleSend(inputValue.trim());
    }
  };

  const handleConfirmAction = async () => {
    if (!pendingAction) return;
    await executeAction(pendingAction);
    setPendingAction(null);
  };
  const handleCancelAction = () => {
    setPendingAction(null);
    setConversation(prev => [
      ...prev,
      { role: 'assistant', content: t('actionCancelled') || "Okay, I won't do that." }
    ]);
  };

  /** ----------------- Inline Editable Rows ----------------- */

  const EventRow = ({ event, index, onSelect, selected }) => (
    <div className="p-3 bg-gray-50 rounded-lg space-y-2 flex items-start gap-2">
      <input type="checkbox" className="mt-2" checked={selected} onChange={e => onSelect(e.target.checked)} />
      <Input
        value={event.title || ''}
        onChange={(e) => setPendingAction(prev => ({
          ...prev,
          action_payload: {
            ...prev.action_payload,
            events: prev.action_payload.events?.map((ev, i) => i === index ? { ...ev, title: e.target.value } : ev)
          }
        }))}
        className="text-sm"
        placeholder={t('title') || 'Title'}
      />
      <div className="grid grid-cols-2 gap-2">
        <Input
          type="datetime-local"
          value={toLocalInputValue(event.start_time)}
          onChange={(e) => setPendingAction(prev => ({
            ...prev,
            action_payload: {
              ...prev.action_payload,
              events: prev.action_payload.events.map((ev, i) =>
                i === index ? { ...ev, start_time: fromLocalInputValue(e.target.value) } : ev
              )
            }
          }))}
          className="text-xs"
        />
        <Input
          type="datetime-local"
          value={toLocalInputValue(event.end_time)}
          onChange={(e) => setPendingAction(prev => ({
            ...prev,
            action_payload: {
              ...prev.action_payload,
              events: prev.action_payload.events.map((ev, i) =>
                i === index ? { ...ev, end_time: fromLocalInputValue(e.target.value) } : ev
              )
            }
          }))}
          className="text-xs"
        />
      </div>

      <div className="text-xs">{t('assignToMembers') || 'Assign to members'}</div>
      <div className="flex flex-wrap gap-2">
        <Select
          value=""
          onValueChange={(memberId) => {
            const has = (event.family_member_ids || []).includes(memberId);
            const updated = has
              ? (event.family_member_ids || []).filter(id => id !== memberId)
              : ([...(event.family_member_ids || []), memberId]);
            setPendingAction(prev => ({
              ...prev,
              action_payload: {
                ...prev.action_payload,
                events: prev.action_payload.events?.map((ev, i) =>
                  i === index ? { ...ev, family_member_ids: updated } : ev
                )
              }
            }));
          }}
        >
          <SelectTrigger className="h-7 text-xs w-48">
            <SelectValue placeholder={t('toggleAssignees') || 'Toggle assignees'} />
          </SelectTrigger>
          <SelectContent>
            {allFamilyMembers.map(m => (
              <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="text-xs opacity-70">
          {(event.family_member_ids || [])
            .map(id => allFamilyMembers.find(m => m.id === id)?.name || id)
            .join(', ') || (t('none') || 'None')}
        </div>
      </div>
    </div>
  );

  const TaskRow = ({ task, index, onSelect, selected }) => (
    <div className="p-3 bg-gray-50 rounded-lg space-y-2 flex items-start gap-2">
      <input type="checkbox" className="mt-2" checked={selected} onChange={e => onSelect(e.target.checked)} />
      <Input
        value={task.title || ''}
        onChange={(e) => setPendingAction(prev => ({
          ...prev,
          action_payload: {
            ...prev.action_payload,
            tasks: prev.action_payload.tasks?.map((tk, i) => i === index ? { ...tk, title: e.target.value } : tk)
          }
        }))}
        className="text-sm"
        placeholder={t('title') || 'Title'}
      />
      <Input
        value={task.description || ''}
        onChange={(e) => setPendingAction(prev => ({
          ...prev,
          action_payload: {
            ...prev.action_payload,
            tasks: prev.action_payload.tasks?.map((tk, i) => i === index ? { ...tk, description: e.target.value } : tk)
          }
        }))}
        className="text-sm"
        placeholder={t('addDetails') || 'Details'}
      />
      <div className="grid grid-cols-2 gap-2">
        <Input
          type="datetime-local"
          value={task.due_date ? new Date(task.due_date).toISOString().slice(0, 16) : ''}
          onChange={(e) => setPendingAction(prev => ({
            ...prev,
            action_payload: {
              ...prev.action_payload,
              tasks: prev.action_payload.tasks?.map((tk, i) =>
                i === index ? { ...tk, due_date: isoLocal(e.target.value) } : tk
              )
            }
          }))}
          className="text-xs"
        />
        <Select
          value={task.status || 'todo'}
          onValueChange={(value) => setPendingAction(prev => ({
            ...prev,
            action_payload: {
              ...prev.action_payload,
              tasks: prev.action_payload.tasks?.map((tk, i) =>
                i === index ? { ...tk, status: value } : tk
              )
            }
          }))}
        >
          <SelectTrigger className="h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todo">todo</SelectItem>
            <SelectItem value="in_progress">in_progress</SelectItem>
            <SelectItem value="done">done</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="text-xs">{t('assignToMembers') || 'Assign to members'}</div>
      <div className="flex flex-wrap gap-2">
        <Select
          value=""
          onValueChange={(memberId) => {
            const has = (task.assigned_to || []).includes(memberId);
            const updated = has
              ? (task.assigned_to || []).filter(id => id !== memberId)
              : ([...(task.assigned_to || []), memberId]);
            setPendingAction(prev => ({
              ...prev,
              action_payload: {
                ...prev.action_payload,
                tasks: prev.action_payload.tasks?.map((tk, i) =>
                  i === index ? { ...tk, assigned_to: updated } : tk
                )
              }
            }));
          }}
        >
          <SelectTrigger className="h-7 text-xs w-48">
            <SelectValue placeholder={t('toggleAssignees') || 'Toggle assignees'} />
          </SelectTrigger>
          <SelectContent>
            {allFamilyMembers.map(m => (
              <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="text-xs opacity-70">
          {(task.assigned_to || [])
            .map(id => allFamilyMembers.find(m => m.id === id)?.name || id)
            .join(', ') || (t('none') || 'None')}
        </div>
      </div>
    </div>
  );

  const WishlistRow = ({ item, index, onSelect, selected }) => (
    <div className="p-3 bg-gray-50 rounded-lg space-y-2 flex items-start gap-2">
      <input type="checkbox" className="mt-2" checked={selected} onChange={e => onSelect(e.target.checked)} />
      <Input
        value={item.name || ''}
        onChange={(e) => setPendingAction(prev => ({
          ...prev,
          action_payload: {
            ...prev.action_payload,
            items: prev.action_payload.items?.map((it, i) => i === index ? { ...it, name: e.target.value } : it)
          }
        }))}
        className="text-sm"
        placeholder="Name"
      />
      <Input
        value={item.url || ''}
        onChange={(e) => setPendingAction(prev => ({
          ...prev,
          action_payload: {
            ...prev.action_payload,
            items: prev.action_payload.items?.map((it, i) => i === index ? { ...it, url: e.target.value } : it)
          }
        }))}
        className="text-sm"
        placeholder="https://…"
      />
      <div className="flex items-center gap-2">
        <div className="text-xs">For member</div>
        <Select
          value={item.family_member_id || ''}
          onValueChange={(memberId) => setPendingAction(prev => ({
            ...prev,
            action_payload: {
              ...prev.action_payload,
              items: prev.action_payload.items?.map((it, i) => i === index ? { ...it, family_member_id: memberId } : it)
            }
          }))}
        >
          <SelectTrigger className="h-8 text-sm w-56">
            <SelectValue placeholder="Pick a member" />
          </SelectTrigger>
          <SelectContent>
            {allFamilyMembers.map(m => (
              <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  /** ----------------- Render ----------------- */

  return (
    <div className="flex-1 flex flex-col bg-gray-50 min-h-0">
      <div className="flex-1 overflow-y-auto space-y-4 p-4">
        <AnimatePresence>
          {conversation.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center text-gray-500 py-8"
            >
              <MessageCircle className="w-12 h-12 mx-auto text-gray-300 mb-2" />
              <p className="mb-1 font-medium">{t('aiAssistantTitle') || 'Your personal assistant'}</p>
              <p className="text-sm text-gray-500 mb-4">{t('aiAssistantTagline') || 'How can I simplify your family life?'}</p>
              <div className="text-sm space-y-1 text-gray-400">
                <p>"{t('scheduleMyAppointment') || "Schedule my appointment for tomorrow"}"</p>
                <p>"{t('addToMyWishlist') || "Add a new game to my wishlist"}"</p>
                <p>"{t('createMyTasks') || "Create a task to tidy my room"}"</p>
                <p>"{t('showMyWishlist') || "Show my wishlist"}"</p>
              </div>
            </motion.div>
          ) : conversation.map((msg, index) => (
            <motion.div
              key={index}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : 'items-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center shrink-0">
                  <Bot className="w-5 h-5 text-white" />
                </div>
              )}
              <div className="flex flex-col" style={{ alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div
                  className={`max-w-md p-3 rounded-2xl break-words ${
                    msg.role === 'user'
                      ? 'bg-blue-500 text-white rounded-br-lg'
                      : 'bg-white text-gray-800 border rounded-bl-lg'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>

                {/* Review panel using shared components */}

                {index === conversation.length - 1 && pendingAction && (
                  <ActionReviewPanel
                    tasks={pendingAction.action_payload?.tasks || []}
                    events={pendingAction.action_payload?.events || []}
                    wishlist={pendingAction.action_payload?.items || []}
                    familyMembers={allFamilyMembers}
                    onCancel={handleCancelAction}
                    confirmLabel="Yes, sounds good"
                    cancelLabel="Cancel"
                    onConfirm={async (confirmed) => {
                      const { tasks = [], events = [], items = [] } = confirmed;
                      try {
                        if (tasks && tasks.length) await Task.bulkCreate(tasks);
                        if (events && events.length) await ScheduleEvent.bulkCreate(events);
                        if (items && items.length) await WishlistItem.bulkCreate(items);
                        if ((tasks && tasks.length) || (events && events.length) || (items && items.length)) {
                          setConversation(prev => ([...prev, { role: 'assistant', content: 'Items added!' }]));
                        }
                      } catch (e) {
                        setConversation(prev => ([...prev, { role: 'assistant', content: 'Some items could not be saved.' }]));
                      } finally {
                        setPendingAction(null);
                      }
                    }}
                  />
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        <div ref={conversationEndRef} />

        {isProcessing && (
          <motion.div
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-end gap-2"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center shrink-0">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div className="max-w-md p-3 rounded-2xl bg-white border rounded-bl-lg">
              <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
            </div>
          </motion.div>
        )}
      </div>

      {/* Clear chat */}
      <div className="flex justify-end p-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleClearChat}
          disabled={isProcessing || !!pendingAction}
          title={t('clearChat') || 'Clear chat'}
        >
          {t('clearChat') || 'Clear chat'}
        </Button>
      </div>

      {/* Composer */}
      <div className="border-t p-2 sm:p-4 bg-white flex-shrink-0">
        <div className="relative flex items-center gap-2">
          <Textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('typeYourMessage') || "Type your message..."}
            className="w-full pr-24 rounded-lg border-gray-300 focus:ring-blue-500 focus:border-blue-500 resize-none"
            rows={1}
            disabled={isProcessing || !!pendingAction}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
            <Button variant="ghost" size="icon" className="text-gray-500 hover:text-blue-500" disabled>
              <Mic className="w-5 h-5" />
            </Button>
            <Button
              size="sm"
              onClick={() => inputValue.trim() && handleSend(inputValue.trim())}
              disabled={!inputValue.trim() || isProcessing || !!pendingAction}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
