// UnifiedAIAssistant.jsx (enhanced)
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Mic, Send, Bot, Loader2, MessageCircle, Check, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/components/common/LanguageProvider";
import { InvokeLLM } from '@/api/integrations';
import { Task, ScheduleEvent, WishlistItem, ChatMessage, Conversation } from '@/api/entities';

/** ——— Small helpers ——— */
const isCompleteTask = (p) =>
  p && p.title && p.family_id && p.status && p.due_date;

const isCompleteEvent = (p) =>
  p && p.title && p.family_id && p.start_time && p.end_time;

const isCompleteWishlistItem = (p) => p && p.name; // url optional

const isoLocal = (d) => {
  if (!d) return '';
  try {
    return new Date(d).toISOString();
  } catch {
    return '';
  }
};

// Allowed event categories (must match your FastAPI/Pydantic model)
const EVENT_CATEGORIES = [
  "school",
  "work",
  "sports",
  "medical",
  "social",
  "family",
  "other",
  "holiday",
  "studyday",
  "outing"
];

function toLocalInputValue(isoOrLocalString) {
  if (!isoOrLocalString) return "";
  const d = new Date(isoOrLocalString);
  if (isNaN(d.getTime())) {
    // If it's already a local string like "YYYY-MM-DDTHH:MM:SS", trim seconds
    const m = isoOrLocalString.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/);
    return m ? m[1] : "";
  }
  const pad = (n) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm   = pad(d.getMonth() + 1);
  const dd   = pad(d.getDate());
  const hh   = pad(d.getHours());
  const mi   = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function fromLocalInputValue(localValue) {
  // Browser gives "YYYY-MM-DDTHH:MM" → add seconds (naive, no Z)
  if (!localValue) return "";
  return localValue.length === 16 ? `${localValue}:00` : localValue;
}

function formatDateTimeEU(value, localeHint) {
  // Choose a European default if you don't have a language code
  const locale = localeHint || "en-GB";
  try {
    return new Intl.DateTimeFormat(locale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(value));
  } catch {
    return value;
  }
}

const summarizeList = (items, kind, locale) => {
  if (!Array.isArray(items) || !items.length) return 'Nothing found.';
  if (kind === 'wishlist') {
    return items.map(i => `• ${i.name}${i.url ? ` — ${i.url}` : ''}`).join('\n');
  }
  if (kind === 'events') {
    return items.map(e => {
      const st = formatDateTimeEU(e.start_time, locale);
      return `• ${e.title} — ${st}${e.location ? ` @ ${e.location}` : ''}`;
    }).join('\n');
  }
  if (kind === 'tasks') {
    return items.map(tk => `• [${tk.status}] ${tk.title}${tk.due_date ? ` (due ${formatDateTimeEU(tk.due_date, locale)})` : ''}`).join('\n');
  }
  return '';
};

function resolveTargetMember(messageText, familyMembers, currentUserMember) {
  const text = (messageText || "").toLowerCase();

  // pronouns → "my" (en), "mijn" (nl), "me", "ik"
  const mentionsSelf =
    /\b(my|mijn|me|ik|mijn lijst|my wishlist)\b/i.test(messageText || "");

  if (mentionsSelf && currentUserMember?.id) {
    return currentUserMember;
  }

  // try to match by member name mentioned in the text
  // pick the longest name match (e.g. “Max” vs “Maxine”)
  const candidates = (familyMembers || [])
    .filter(Boolean)
    .map(m => ({ ...m, _score: m.name ? (text.includes(m.name.toLowerCase()) ? m.name.length : 0) : 0 }))
    .filter(m => m._score > 0)
    .sort((a, b) => b._score - a._score);

  if (candidates.length > 0) return candidates[0];

  // fallback to current user (if present)
  if (currentUserMember?.id) return currentUserMember;

  // last resort: first family member
  return Array.isArray(familyMembers) && familyMembers.length ? familyMembers[0] : null;
}



export default function UnifiedAIAssistant({ conversationContext, allFamilyMembers = [], user, onUpdate }) {
  const { t, currentLanguage } = useLanguage();
  const [inputValue, setInputValue] = useState('');
  // Persist conversation in localStorage
  const STORAGE_KEY = 'famlyai_ai_conversation';
  const [conversation, setConversation] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingAction, setPendingAction] = useState(null); // {action_type, action_payload}
  const conversationEndRef = useRef(null);

  // Save conversation to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversation));
    } catch {}
    conversationEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation, pendingAction]);

  // Clear chat handler
  const handleClearChat = () => {
    setConversation([]);
    setPendingAction(null);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  };

  const executeAction = async (action) => {
    try {
      let successMessage = '';
      // Dynamically import Task and WishlistItem for robust code splitting
      const entities = await import('@/api/entities');
      const Task = entities.Task;
      const WishlistItem = entities.WishlistItem;
      const ScheduleEvent = entities.ScheduleEvent;

      // If both tasks and wishlist items are present, confirm both
      if (action.action_type === 'create_task' || action.action_type === 'create_multiple_tasks' || action.action_type === 'add_to_wishlist' || action.action_type === 'add_multiple_to_wishlist') {
        let taskTitles = [];
        let wishlistNames = [];
        // Handle single/multiple tasks
        if (action.action_type === 'create_task' && action.action_payload) {
          await Task.create(action.action_payload);
          taskTitles.push(action.action_payload.title);
        }
        if (action.action_type === 'create_multiple_tasks' && Array.isArray(action.action_payload?.tasks)) {
          for (const taskPayload of action.action_payload.tasks) {
            await Task.create(taskPayload);
            taskTitles.push(taskPayload.title);
          }
        }
        // Handle single/multiple wishlist items
        if (action.action_type === 'add_to_wishlist' && action.action_payload) {
          const payload = { ...action.action_payload };
          if (!payload.family_id && user?.family_id) payload.family_id = user.family_id;
          const created = await WishlistItem.create(payload);
          wishlistNames.push(created?.name || payload.name || 'item');
        }
        if (action.action_type === 'add_multiple_to_wishlist' && Array.isArray(action.action_payload?.items)) {
          for (const it of action.action_payload.items) {
            const payload = { ...it };
            if (!payload.family_id && user?.family_id) payload.family_id = user.family_id;
            const created = await WishlistItem.create(payload);
            wishlistNames.push(created?.name || payload.name || 'item');
          }
        }
        // Compose success message for both
        if (taskTitles.length && wishlistNames.length) {
          successMessage = `${t('multipleTasksCreatedConfirmation', { count: taskTitles.length, titles: taskTitles.join(', ') }) || `Created tasks: ${taskTitles.join(', ')}`}\n${t('multipleWishlistAddedConfirmation', { count: wishlistNames.length, titles: wishlistNames.join(', ') }) || `Added wishlist items: ${wishlistNames.join(', ')}`}`;
        } else if (taskTitles.length) {
          successMessage = t('multipleTasksCreatedConfirmation', { count: taskTitles.length, titles: taskTitles.join(', ') }) || `Created tasks: ${taskTitles.join(', ')}`;
        } else if (wishlistNames.length) {
          successMessage = t('multipleWishlistAddedConfirmation', { count: wishlistNames.length, titles: wishlistNames.join(', ') }) || `Added wishlist items: ${wishlistNames.join(', ')}`;
        }
      } else if (action.action_type === 'create_event') {
        await ScheduleEvent.create(action.action_payload);
        successMessage = t('eventCreatedConfirmation', { title: action.action_payload.title })
          || `Okay, I've scheduled the event: "${action.action_payload.title}".`;
      } else if (
        action.action_type === 'create_multiple_events' ||
        action.action_type === 'propose_multiple_events' ||
        action.action_type === 'propose_multiple_events_from_chat'
      ) {
        const titles = [];
        for (const eventPayload of action.action_payload.events) {
          await ScheduleEvent.create(eventPayload);
          titles.push(eventPayload.title);
        }
        successMessage =
          t('multipleEventsCreatedConfirmation', { count: titles.length, titles: titles.join(', ') }) ||
          `Okay, I've scheduled ${titles.length} events: ${titles.join(', ')}.`;
      } else if (action.action_type === 'update_task_status') {
        const { id, status } = action.action_payload;
        await Task.update(id, { status });
        successMessage = t('taskUpdatedConfirmation', { status }) || `Task updated to ${status}.`;
      } else if (action.action_type === 'convert_event_to_task') {
        const { event_id } = action.action_payload;
        await ScheduleEvent.toTask(event_id);
        successMessage = t('eventConvertedToTask') || 'Event converted to task!';
      } else if (action.action_type === 'convert_task_to_event') {
        const { task_id } = action.action_payload;
        await Task.toEvent(task_id);
        successMessage = t('taskConvertedToEvent') || 'Task converted to event!';
      } else {
        return;
      }
  // Add conversion intent detection to handleSend
  // If user says e.g. "convert this event to a task" or "make this task an event", trigger conversion
  const handleSend = async (messageText) => {
    if (isProcessing || !messageText?.trim()) return;

    // Simple intent detection for conversion
    const lower = messageText.toLowerCase();
    if (lower.includes('convert') && lower.includes('event') && lower.includes('task')) {
      // Try to get last event from context
      const lastEvent = Array.isArray(events) && events.length > 0 ? events[events.length - 1] : null;
      if (lastEvent && lastEvent.id) {
        setConversation(prev => [...prev, { role: 'user', content: messageText }]);
        setIsProcessing(true);
        try {
          await ScheduleEvent.toTask(lastEvent.id);
          setConversation(prev => [...prev, { role: 'assistant', content: t('eventConvertedToTask') || 'Event converted to task!' }]);
        } catch (e) {
          setConversation(prev => [...prev, { role: 'assistant', content: t('eventConvertToTaskFailed') || 'Failed to convert event to task.' }]);
        }
        setIsProcessing(false);
        setInputValue('');
        return;
      }
    }
    if (lower.includes('convert') && lower.includes('task') && lower.includes('event')) {
      // Try to get last task from context
      const lastTask = Array.isArray(tasks) && tasks.length > 0 ? tasks[tasks.length - 1] : null;
      if (lastTask && lastTask.id) {
        setConversation(prev => [...prev, { role: 'user', content: messageText }]);
        setIsProcessing(true);
        try {
          await Task.toEvent(lastTask.id);
          setConversation(prev => [...prev, { role: 'assistant', content: t('taskConvertedToEvent') || 'Task converted to event!' }]);
        } catch (e) {
          setConversation(prev => [...prev, { role: 'assistant', content: t('taskConvertToEventFailed') || 'Failed to convert task to event.' }]);
        }
        setIsProcessing(false);
        setInputValue('');
        return;
      }
    }

    // ...existing handleSend logic...
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


      // Keep a longer conversation history (last 30 messages)
      const history = [...conversation, userMsg]
        .slice(-30)
        .map(msg => ({ role: msg.role, content: msg.content }));
      const contextString = history
        .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
        .join('\n');

      const prompt = `You are famly.ai, a helpful assistant.
TODAY_IS: ${new Date().toISOString()}
USER_LANGUAGE: ${currentLanguage}

When the user says "I"/"me"/"my", they refer to:
- name: ${currentUserMember?.name || 'family member'}
- id: ${currentUserMember?.id || 'unknown'}

FAMILY:
- id: ${familyId}
- members (usable IDs): ${JSON.stringify(familyMemberInfo)}

ALLOWED EVENT CATEGORIES (pick ONE; if none fits, use "other" and do NOT invent new labels):
${JSON.stringify(EVENT_CATEGORIES)}

RECENT CONVERSATION:
${contextString}

Analyze the user's last message: "${messageText}"

Return JSON ONLY (no code fences, no prose). All human-readable strings MUST be in ${currentLanguage}.
Use 24h time and ISO without timezone (YYYY-MM-DDTHH:MM:SS).

Choose EXACTLY one shape:

1) Multiple activities in one message:
{
  "action_type": "propose_multiple_events_from_chat",
  "confirmation_message": "…",
  "action_payload": {
    "events": [
      { "title": "…", "start_time": "YYYY-MM-DDTHH:MM:SS", "end_time": "YYYY-MM-DDTHH:MM:SS", "family_member_ids": ["<member_id>"], "family_id": "${familyId}", "location": "…", "category": "<one of ${EVENT_CATEGORIES.join(', ')} or 'other'>" }
    ]
  }
}

2) Vacation/date block:
{
  "action_type": "propose_multiple_events",
  "confirmation_message": "…",
  "action_payload": { "events": [ { "title": "…", "start_time": "…", "end_time": "…", "family_id": "${familyId}", "category": "holiday", "family_member_ids": [] } ] }
}

3) Single task:
{
  "action_type": "propose_task",
  "confirmation_message": "…",
  "action_payload": { "title": "…", "description": "…", "assigned_to": ["<member_id_if_user>"], "due_date": "YYYY-MM-DDTHH:MM:SS", "family_id": "${familyId}", "status": "todo" }
}

4) Single event:
{
  "action_type": "propose_event",
  "confirmation_message": "…",
  "action_payload": { "title": "…", "start_time": "YYYY-MM-DDTHH:MM:SS", "end_time": "YYYY-MM-DDTHH:MM:SS", "family_member_ids": ["<member_id>"], "family_id": "${familyId}", "location": "…", "category": "<one of ${EVENT_CATEGORIES.join(', ')} or 'other'>" }
}

5) Add wishlist item:
{
  "action_type": "propose_wishlist_item",
  "confirmation_message": "…",
  "action_payload": { "name": "…", "url": "…", "family_member_id": "<member_id>" }
}

6) Add MULTIPLE wishlist items:
{
  "action_type": "propose_multiple_wishlist_items",
  "confirmation_message": "…",
  "action_payload": { "items": [ { "name": "…", "url": "…", "family_member_id": "<member_id>" } ] }
}

7) Show wishlist:
{ "action_type": "show_wishlist", "confirmation_message": "…", "action_payload": {} }

8) Show upcoming events:
{ "action_type": "show_upcoming_events", "confirmation_message": "…", "action_payload": { "limit": 5 } }

9) Show tasks (optionally by status):
{ "action_type": "show_tasks", "confirmation_message": "…", "action_payload": { "status": "todo" } }

10) Mark a task done/in_progress:
{ "action_type": "update_task_status", "confirmation_message": "…", "action_payload": { "id": "<task_id>", "status": "done" } }

11) Need clarification:
{ "action_type": "clarify", "clarification_question": "…" }

12) General chat:
{ "action_type": "chat", "response": "…" }`;

      const response = await InvokeLLM({
        prompt,
        system: `You are famly.ai. Respond ONLY with JSON. All human-readable strings MUST be written in ${currentLanguage}.`,
        response_json_schema: {
          type: "object",
          properties: {
            action_type: {
              type: "string",
              enum: [
                "propose_task",
                "propose_event",
                "propose_multiple_events",
                "propose_multiple_events_from_chat",
                "propose_wishlist_item",
                "propose_multiple_wishlist_items",
                "show_wishlist",
                "show_upcoming_events",
                "show_tasks",
                "update_task_status",
                "clarify",
                "chat",
                "convert_event_to_task",
                "convert_task_to_event"
              ]
            },
            confirmation_message: { type: "string" },
            action_payload: {
              type: "object",
              properties: {
                // task
                title: { type: "string" },
                description: { type: "string" },
                assigned_to: { type: "array", items: { type: "string" } },
                due_date: { type: "string" },
                family_id: { type: "string" },
                status: { type: "string" },
                id: { type: "string" },
                // single event
                start_time: { type: "string" },
                end_time: { type: "string" },
                family_member_ids: { type: "array", items: { type: "string" } },
                location: { type: "string" },
                category: { type: "string", enum: EVENT_CATEGORIES },
                // multiple events
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
                      location: { type: "string" },
                      category: { type: "string", enum: EVENT_CATEGORIES }
                    },
                    required: ["title", "start_time", "end_time", "family_id"]
                  }
                },
                // wishlist
                name: { type: "string" },
                url: { type: "string" },
                family_member_id: { type: "string" },
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      url: { type: "string" },
                      family_member_id: { type: "string" }
                    },
                    required: ["name"]
                  }
                },
                // listing helpers
                limit: { type: "number" },
                // conversion
                event_id: { type: "string" },
                task_id: { type: "string" }
              }
            },
            clarification_question: { type: "string" },
            response: { type: "string" }
          },
          required: ["action_type"]
        },
        strict: true,
      });

      const data = response?.data || {};
      const type = data.action_type;
      let aiResponse = null;
      let nextPending = null;
      let hasAction = false;

      const autoApply = true; // we auto-apply WHEN payload is complete

      switch (type) {
        case 'convert_event_to_task': {
          const payload = data.action_payload || {};
          if (payload.event_id) {
            await executeAction({ action_type: 'convert_event_to_task', action_payload: payload });
            aiResponse = null;
            hasAction = false;
            nextPending = null;
          }
          break;
        }
        case 'convert_task_to_event': {
          const payload = data.action_payload || {};
          if (payload.task_id) {
            await executeAction({ action_type: 'convert_task_to_event', action_payload: payload });
            aiResponse = null;
            hasAction = false;
            nextPending = null;
          }
          break;
        }
        // ...existing switch cases...
        case 'propose_task': {
          const payload = data.action_payload || {};
          const complete = isCompleteTask(payload);
          if (autoApply && complete) {
            await executeAction({ action_type: 'create_task', action_payload: payload });
            aiResponse = null;
            hasAction = false;
            nextPending = null;
          } else {
            aiResponse = data.confirmation_message;
            nextPending = { action_type: 'create_task', action_payload: payload };
            hasAction = true;
          }
          break;
        }
        // ...rest of switch...
      }

      if (aiResponse) {
        setConversation(prev => [...prev, { role: 'assistant', content: aiResponse, hasAction }]);
      }
      setPendingAction(nextPending);
    } catch (err) {
      setConversation(prev => [
        ...prev,
        { role: 'assistant', content: t('aiError') || "I couldn't complete that action. Please try again." }
      ]);
    }
    setIsProcessing(false);
  };

      setConversation(prev => [...prev, { role: 'assistant', content: successMessage }]);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error("Error executing action:", error);
      setConversation(prev => [
        ...prev,
        {
          role: 'assistant',
          content: t('aiError') || "I couldn't complete that action. Please try again."
        }
      ]);
    }
  };

  const handleConfirmAction = () => {
    if (!pendingAction) return;
    executeAction(pendingAction);
    setPendingAction(null);
  };

  const handleCancelAction = () => {
    setPendingAction(null);
    setConversation(prev => [
      ...prev,
      { role: 'assistant', content: t('actionCancelled') || "Okay, I won't do that." }
    ]);
  };

  const summarizeList = (items, kind) => {
    if (!Array.isArray(items) || !items.length) return t('nothingFound') || 'Nothing found.';
    if (kind === 'wishlist') {
      return items.map(i => `• ${i.name}${i.url ? ` — ${i.url}` : ''}`).join('\n');
    }
    if (kind === 'events') {
      return items.map(e => {
        const st = formatDateTimeEU(e.start_time, currentLanguage === 'nl' ? 'nl-NL' : undefined);
        const en = formatDateTimeEU(e.end_time,   currentLanguage === 'nl' ? 'nl-NL' : undefined);
        return `• ${e.title} — ${st}  →  ${en}${e.location ? ` @ ${e.location}` : ''}`;
      }).join('\n');
    }

    if (kind === 'tasks') {
      return items.map(tk => {
        const due = tk.due_date ? formatDateTimeEU(tk.due_date, currentLanguage === 'nl' ? 'nl-NL' : undefined) : '';
        return `• [${tk.status}] ${tk.title}${due ? ` (due ${due})` : ''}`;
      }).join('\n');
    }
    return '';
  };

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

      const history = [...conversation, userMsg]
        .slice(-6)
        .map(msg => ({ role: msg.role, content: msg.content }));
      const contextString = history
        .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
        .join('\n');

      const prompt = `You are famly.ai, a helpful assistant.
TODAY_IS: ${new Date().toISOString()}
USER_LANGUAGE: ${currentLanguage}

When the user says "I"/"me"/"my", they refer to:
- name: ${currentUserMember?.name || 'family member'}
- id: ${currentUserMember?.id || 'unknown'}

FAMILY:
- id: ${familyId}
- members (usable IDs): ${JSON.stringify(familyMemberInfo)}

ALLOWED EVENT CATEGORIES (pick ONE; if none fits, use "other" and do NOT invent new labels):
${JSON.stringify(EVENT_CATEGORIES)}

RECENT CONVERSATION:
${contextString}

Analyze the user's last message: "${messageText}"

Return JSON ONLY (no code fences, no prose). All human-readable strings MUST be in ${currentLanguage}.
Use 24h time and ISO without timezone (YYYY-MM-DDTHH:MM:SS).

Choose EXACTLY one shape:

1) Multiple activities in one message:
{
  "action_type": "propose_multiple_events_from_chat",
  "confirmation_message": "…",
  "action_payload": {
    "events": [
      { "title": "…", "start_time": "YYYY-MM-DDTHH:MM:SS", "end_time": "YYYY-MM-DDTHH:MM:SS", "family_member_ids": ["<member_id>"], "family_id": "${familyId}", "location": "…", "category": "<one of ${EVENT_CATEGORIES.join(', ')} or 'other'>" }
    ]
  }
}

2) Vacation/date block:
{
  "action_type": "propose_multiple_events",
  "confirmation_message": "…",
  "action_payload": { "events": [ { "title": "…", "start_time": "…", "end_time": "…", "family_id": "${familyId}", "category": "holiday", "family_member_ids": [] } ] }
}

3) Single task:
{
  "action_type": "propose_task",
  "confirmation_message": "…",
  "action_payload": { "title": "…", "description": "…", "assigned_to": ["<member_id_if_user>"], "due_date": "YYYY-MM-DDTHH:MM:SS", "family_id": "${familyId}", "status": "todo" }
}

4) Single event:
{
  "action_type": "propose_event",
  "confirmation_message": "…",
  "action_payload": { "title": "…", "start_time": "YYYY-MM-DDTHH:MM:SS", "end_time": "YYYY-MM-DDTHH:MM:SS", "family_member_ids": ["<member_id>"], "family_id": "${familyId}", "location": "…", "category": "<one of ${EVENT_CATEGORIES.join(', ')} or 'other'>" }
}

5) Add wishlist item:
{
  "action_type": "propose_wishlist_item",
  "confirmation_message": "…",
  "action_payload": { "name": "…", "url": "…", "family_member_id": "<member_id>" }
}

6) Add MULTIPLE wishlist items:
{
  "action_type": "propose_multiple_wishlist_items",
  "confirmation_message": "…",
  "action_payload": { "items": [ { "name": "…", "url": "…", "family_member_id": "<member_id>" } ] }
}

7) Show wishlist:
{ "action_type": "show_wishlist", "confirmation_message": "…", "action_payload": {} }

8) Show upcoming events:
{ "action_type": "show_upcoming_events", "confirmation_message": "…", "action_payload": { "limit": 5 } }

9) Show tasks (optionally by status):
{ "action_type": "show_tasks", "confirmation_message": "…", "action_payload": { "status": "todo" } }

10) Mark a task done/in_progress:
{ "action_type": "update_task_status", "confirmation_message": "…", "action_payload": { "id": "<task_id>", "status": "done" } }

11) Need clarification:
{ "action_type": "clarify", "clarification_question": "…" }

12) General chat:
{ "action_type": "chat", "response": "…" }`;

      const response = await InvokeLLM({
        prompt,
        system: `You are famly.ai. Respond ONLY with JSON. All human-readable strings MUST be written in ${currentLanguage}.`,
        response_json_schema: {
          type: "object",
          properties: {
            action_type: {
              type: "string",
              enum: [
                "propose_task",
                "propose_event",
                "propose_multiple_events",
                "propose_multiple_events_from_chat",
                "propose_wishlist_item",
                "propose_multiple_wishlist_items",
                "show_wishlist",
                "show_upcoming_events",
                "show_tasks",
                "update_task_status",
                "clarify",
                "chat"
              ]
            },
            confirmation_message: { type: "string" },
            action_payload: {
              type: "object",
              properties: {
                // task
                title: { type: "string" },
                description: { type: "string" },
                assigned_to: { type: "array", items: { type: "string" } },
                due_date: { type: "string" },
                family_id: { type: "string" },
                status: { type: "string" },
                id: { type: "string" },
                // single event
                start_time: { type: "string" },
                end_time: { type: "string" },
                family_member_ids: { type: "array", items: { type: "string" } },
                location: { type: "string" },
                category: { type: "string", enum: EVENT_CATEGORIES },
                // multiple events
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
                      location: { type: "string" },
                      category: { type: "string", enum: EVENT_CATEGORIES }
                    },
                    required: ["title", "start_time", "end_time", "family_id"]
                  }
                },
                // wishlist
                name: { type: "string" },
                url: { type: "string" },
                family_member_id: { type: "string" },
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      url: { type: "string" },
                      family_member_id: { type: "string" }
                    },
                    required: ["name"]
                  }
                },
                // listing helpers
                limit: { type: "number" }
              }
            },
            clarification_question: { type: "string" },
            response: { type: "string" }
          },
          required: ["action_type"]
        },
        strict: true,
      });

      const data = response?.data || {};
      const type = data.action_type;
      let aiResponse = null;
      let nextPending = null;
      let hasAction = false;

      const autoApply = true; // we auto-apply WHEN payload is complete

      switch (type) {
        case 'propose_task': {
          const payload = data.action_payload || {};
          const complete = isCompleteTask(payload);
          if (autoApply && complete) {
            await executeAction({ action_type: 'create_task', action_payload: payload });
            aiResponse = null;
            hasAction = false;
            nextPending = null;
          } else {
            aiResponse = data.confirmation_message;
            nextPending = { action_type: 'create_task', action_payload: payload };
            hasAction = true;
          }
          break;
        }

        case 'propose_event': {
          const payload = data.action_payload || {};
          const complete = isCompleteEvent(payload);
          if (autoApply && complete) {
            await executeAction({ action_type: 'create_event', action_payload: payload });
            aiResponse = null;
            hasAction = false;
            nextPending = null;
          } else {
            aiResponse = data.confirmation_message;
            nextPending = { action_type: 'create_event', action_payload: payload };
            hasAction = true;
          }
          break;
        }

        case 'propose_multiple_events':
        case 'propose_multiple_events_from_chat': {
          aiResponse = data.confirmation_message;
          // normalize to a single actionable type so Confirm always works
          nextPending = { action_type: 'create_multiple_events', action_payload: data.action_payload || { events: [] } };
          hasAction = true;
          break;
        }
        case 'propose_wishlist_item': {
          const payload = data.action_payload || {};
          const complete = isCompleteWishlistItem(payload);
          if (complete) {
            await executeAction({ action_type: 'add_to_wishlist', action_payload: payload });
            aiResponse = null;
            hasAction = false;
            nextPending = null;
          } else {
            aiResponse = data.confirmation_message;
            nextPending = { action_type: 'add_to_wishlist', action_payload: payload };
            hasAction = true;
          }
          break;
        }

        case 'propose_multiple_wishlist_items': {
          aiResponse = data.confirmation_message;
          nextPending = { action_type: 'add_multiple_to_wishlist', action_payload: data.action_payload || { items: [] } };
          hasAction = true;
          break;
        }

        case 'show_wishlist': {
          // pick whose wishlist to show (Max / me / default fallback)
          const target = resolveTargetMember(messageText, familyMembers, currentUserMember);
          if (!target?.id) {
            aiResponse = t('aiError') || "Sorry, I couldn't figure out whose wishlist to show.";
            break;
          }

          try {
            const list = await WishlistItem.filter({ family_member_id: target.id });
            const heading =
              data.confirmation_message ||
              (t('hereIsWishlistFor', { name: target.name }) || `Here is ${target.name}'s wishlist:`);

            aiResponse = `${heading}\n${summarizeList(list, 'wishlist', currentLanguage === 'nl' ? 'nl-NL' : 'en-GB')}`;
          } catch (err) {
            // if password-protected and unauthenticated/public, backend may return 403
            if (err?.status === 403) {
              aiResponse =
                (t('wishlistPasswordRequired') ||
                  `This wishlist is protected. Please open the wishlist page and provide the password.`)
                + `\n\n` +
                (t('openWishlistHint') ||
                  `Tip: open the Wishlist page for ${target.name} from the Family members screen.`);
            } else {
              aiResponse = t('aiError') || "Sorry, I had trouble fetching the wishlist.";
            }
          }
          break;
        }


        case 'show_upcoming_events': {
          const limit = Number(data?.action_payload?.limit) || 5;
          const list = await ScheduleEvent.upcoming();
          const trimmed = Array.isArray(list) ? list.slice(0, limit) : [];
          aiResponse = `${data.confirmation_message || (t('upcomingEvents') || 'Upcoming events:')}` + '\n' + summarizeList(trimmed, 'events');
          break;
        }

        case 'show_tasks': {
          const status = data?.action_payload?.status || undefined;
          const list = await Task.filter(status ? { status } : {});
          aiResponse = `${data.confirmation_message || (t('hereAreYourTasks') || 'Here are your tasks:')}` + '\n' + summarizeList(list, 'tasks');
          break;
        }

        case 'update_task_status': {
          const payload = data.action_payload || {};
          if (payload?.id && payload?.status) {
            await executeAction({ action_type: 'update_task_status', action_payload: payload });
            aiResponse = null;
          } else {
            aiResponse = data.confirmation_message || (t('confirmTaskUpdate') || 'Update this task?');
            nextPending = { action_type: 'update_task_status', action_payload: payload };
            hasAction = true;
          }
          break;
        }

        case 'clarify':
          aiResponse = data.clarification_question;
          break;

        case 'chat':
        default:
          aiResponse = data.response;
          if (conversationContext?.type === 'chat' && user?.family_id) {
            const aiMember = allFamilyMembers.find(m => m.role === 'ai_assistant');
            if (aiMember) {
              await ChatMessage.create({
                conversation_id: conversationContext.conversationId,
                sender_id: aiMember.id,
                content: data.response || '',
                message_type: 'ai_suggestion'
              });
              await Conversation.update(conversationContext.conversationId, {
                last_message_preview: (data.response || '').substring(0, 100),
                last_message_timestamp: new Date().toISOString()
              });
            }
          }
          break;
      }

      setPendingAction(nextPending || null);

      // Append assistant bubble ONLY if we didn't auto-apply:
      if (aiResponse) {
        setConversation(prev => [
          ...prev,
          {
            role: 'assistant',
            content: aiResponse || (t('aiError') || "Sorry, I had trouble with that. Could you rephrase?"),
            hasAction,
            action: nextPending || null
          }
        ]);
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

  /** ——— Review widgets (tabular-ish) ——— */

  // Editable row for one event, with checkbox
  const EventRow = ({ event, index, onSelect, selected }) => (
    <div className="p-3 bg-gray-50 rounded-lg space-y-2 flex items-start gap-2">
      <input
        type="checkbox"
        className="mt-2"
        checked={selected}
        onChange={e => onSelect(e.target.checked)}
      />
      <Input
        value={event.title || ''}
        onChange={(e) =>
          setPendingAction(prev => ({
            ...prev,
            action_payload: {
              ...prev.action_payload,
              events: prev.action_payload.events?.map((ev, i) =>
                i === index ? { ...ev, title: e.target.value } : ev
              ) || prev.action_payload.events,
            },
          }))
        }
        className="text-sm"
        placeholder={t('title') || 'Title'}
      />
  <div className="grid grid-cols-2 gap-2">
      <Input
        type="datetime-local"
        value={toLocalInputValue(event.start_time)}
        onChange={(e) =>
          setPendingAction(prev => ({
            ...prev,
            action_payload: {
              ...prev.action_payload,
              events: prev.action_payload.events.map((ev, i) =>
                i === index ? { ...ev, start_time: fromLocalInputValue(e.target.value) } : ev
              ),
            },
          }))
        }
        className="text-xs"
      />

      <Input
        type="datetime-local"
        value={toLocalInputValue(event.end_time)}
        onChange={(e) =>
          setPendingAction(prev => ({
            ...prev,
            action_payload: {
              ...prev.action_payload,
              events: prev.action_payload.events.map((ev, i) =>
                i === index ? { ...ev, end_time: fromLocalInputValue(e.target.value) } : ev
              ),
            },
          }))
        }
        className="text-xs"
      />

      </div>

  <div className="text-xs">{t('assignToMembers') || 'Assign to members'}</div>
      <div className="flex flex-wrap gap-2">
        <Select
          value="" // use menu to toggle; showing selected below
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
                ) || prev.action_payload.events,
              },
            }));
          }}
        >
          <SelectTrigger className="h-7 text-xs w-48">
            <SelectValue placeholder={t('toggleAssignees') || 'Toggle assignees'} />
          </SelectTrigger>
          <SelectContent>
            {allFamilyMembers.map(m => (
              <SelectItem key={m.id} value={m.id}>
                {m.name}
              </SelectItem>
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

  // Editable row for one task, with checkbox
  const TaskRow = ({ task, index, onSelect, selected }) => (
    <div className="p-3 bg-gray-50 rounded-lg space-y-2 flex items-start gap-2">
      <input
        type="checkbox"
        className="mt-2"
        checked={selected}
        onChange={e => onSelect(e.target.checked)}
      />
      <Input
        value={task.title || ''}
        onChange={(e) =>
          setPendingAction(prev => ({
            ...prev,
            action_payload: {
              ...prev.action_payload,
              tasks: prev.action_payload.tasks?.map((tk, i) =>
                i === index ? { ...tk, title: e.target.value } : tk
              ) || prev.action_payload.tasks,
            },
          }))
        }
        className="text-sm"
        placeholder={t('title') || 'Title'}
      />
      <Input
        value={task.description || ''}
        onChange={(e) =>
          setPendingAction(prev => ({
            ...prev,
            action_payload: {
              ...prev.action_payload,
              tasks: prev.action_payload.tasks?.map((tk, i) =>
                i === index ? { ...tk, description: e.target.value } : tk
              ) || prev.action_payload.tasks,
            },
          }))
        }
        className="text-sm"
        placeholder={t('addDetails') || 'Details'}
      />
      <div className="grid grid-cols-2 gap-2">
        <Input
          type="datetime-local"
          value={task.due_date ? new Date(task.due_date).toISOString().slice(0, 16) : ''}
          onChange={(e) =>
            setPendingAction(prev => ({
              ...prev,
              action_payload: {
                ...prev.action_payload,
                tasks: prev.action_payload.tasks?.map((tk, i) =>
                  i === index ? { ...tk, due_date: isoLocal(e.target.value) } : tk
                ) || prev.action_payload.tasks,
              },
            }))
          }
          className="text-xs"
        />
        <Select
          value={task.status || 'todo'}
          onValueChange={(value) =>
            setPendingAction(prev => ({
              ...prev,
              action_payload: {
                ...prev.action_payload,
                tasks: prev.action_payload.tasks?.map((tk, i) =>
                  i === index ? { ...tk, status: value } : tk
                ) || prev.action_payload.tasks,
              },
            }))
          }
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
                ) || prev.action_payload.tasks,
              },
            }));
          }}
        >
          <SelectTrigger className="h-7 text-xs w-48">
            <SelectValue placeholder={t('toggleAssignees') || 'Toggle assignees'} />
          </SelectTrigger>
          <SelectContent>
            {allFamilyMembers.map(m => (
              <SelectItem key={m.id} value={m.id}>
                {m.name}
              </SelectItem>
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

  // Editable row for one wishlist item (name + url + owner), with checkbox
  const WishlistRow = ({ item, index, onSelect, selected }) => (
  <div className="p-3 bg-gray-50 rounded-lg space-y-2 flex items-start gap-2">
    <input
      type="checkbox"
      className="mt-2"
      checked={selected}
      onChange={e => onSelect(e.target.checked)}
    />
    <Input
      value={item.name || ''}
      onChange={(e) =>
        setPendingAction(prev => ({
          ...prev,
          action_payload: {
            ...prev.action_payload,
            items: prev.action_payload.items?.map((it, i) =>
              i === index ? { ...it, name: e.target.value } : it
            ) || prev.action_payload.items,
          },
        }))
      }
      className="text-sm"
      placeholder="Name"
    />
    <Input
      value={item.url || ''}
      onChange={(e) =>
        setPendingAction(prev => ({
          ...prev,
          action_payload: {
            ...prev.action_payload,
            items: prev.action_payload.items?.map((it, i) =>
              i === index ? { ...it, url: e.target.value } : it
            ) || prev.action_payload.items,
          },
        }))
      }
      className="text-sm"
      placeholder="https://…"
    />
    <div className="flex items-center gap-2">
      <div className="text-xs">For member</div>
      <Select
        value={item.family_member_id || ''}
        onValueChange={(memberId) =>
          setPendingAction(prev => ({
            ...prev,
            action_payload: {
              ...prev.action_payload,
              items: prev.action_payload.items?.map((it, i) =>
                i === index ? { ...it, family_member_id: memberId } : it
              ) || prev.action_payload.items,
            },
          }))
        }
      >
        <SelectTrigger className="h-8 text-sm w-56">
          <SelectValue placeholder="Pick a member" />
        </SelectTrigger>
        <SelectContent>
          {allFamilyMembers.map(m => (
            <SelectItem key={m.id} value={m.id}>
              {m.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  </div>
);


  /** Render */
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

                  {/* Unified review for all types, with checkboxes and single confirm */}
                  {msg.hasAction && index === conversation.length - 1 && pendingAction && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-3 p-3 bg-white border rounded-lg max-h-96 overflow-y-auto w-full max-w-2xl space-y-3"
                    >
                      <h4 className="font-semibold text-sm mb-2">
                        {t('reviewAndConfirm') || 'Review and confirm your selections:'}
                      </h4>
                      {/* Events */}
                      {Array.isArray(pendingAction.action_payload?.events) && pendingAction.action_payload.events.length > 0 && (
                        <div>
                          <div className="font-semibold text-xs text-emerald-800 mb-1">{t('events') || 'Events'}</div>
                          {pendingAction.action_payload.events.map((ev, i) => (
                            <EventRow
                              key={i}
                              event={ev}
                              index={i}
                              selected={ev.selected !== false}
                              onSelect={checked => {
                                setPendingAction(prev => ({
                                  ...prev,
                                  action_payload: {
                                    ...prev.action_payload,
                                    events: prev.action_payload.events.map((e, idx) => idx === i ? { ...e, selected: checked } : e)
                                  }
                                }));
                              }}
                            />
                          ))}
                        </div>
                      )}
                      {/* Tasks */}
                      {Array.isArray(pendingAction.action_payload?.tasks) && pendingAction.action_payload.tasks.length > 0 && (
                        <div>
                          <div className="font-semibold text-xs text-green-800 mb-1">{t('tasks') || 'Tasks'}</div>
                          {pendingAction.action_payload.tasks.map((tk, i) => (
                            <TaskRow
                              key={i}
                              task={tk}
                              index={i}
                              selected={tk.selected !== false}
                              onSelect={checked => {
                                setPendingAction(prev => ({
                                  ...prev,
                                  action_payload: {
                                    ...prev.action_payload,
                                    tasks: prev.action_payload.tasks.map((t, idx) => idx === i ? { ...t, selected: checked } : t)
                                  }
                                }));
                              }}
                            />
                          ))}
                        </div>
                      )}
                      {/* Wishlist */}
                      {Array.isArray(pendingAction.action_payload?.items) && pendingAction.action_payload.items.length > 0 && (
                        <div>
                          <div className="font-semibold text-xs text-purple-800 mb-1">{t('wishlist') || 'Wishlist'}</div>
                          {pendingAction.action_payload.items.map((it, i) => (
                            <WishlistRow
                              key={i}
                              item={it}
                              index={i}
                              selected={it.selected !== false}
                              onSelect={checked => {
                                setPendingAction(prev => ({
                                  ...prev,
                                  action_payload: {
                                    ...prev.action_payload,
                                    items: prev.action_payload.items.map((w, idx) => idx === i ? { ...w, selected: checked } : w)
                                  }
                                }));
                              }}
                            />
                          ))}
                        </div>
                      )}
                      <div className="flex justify-end gap-2 pt-4 border-t border-blue-100 mt-4">
                        <Button onClick={handleCancelAction} size="sm" variant="outline">
                          <X className="w-4 h-4 mr-1" /> {t('cancel') || 'Cancel'}
                        </Button>
                        <Button
                          onClick={() => {
                            // Only confirm selected items
                            const filtered = { ...pendingAction.action_payload };
                            if (filtered.events) filtered.events = filtered.events.filter(e => e.selected !== false);
                            if (filtered.tasks) filtered.tasks = filtered.tasks.filter(t => t.selected !== false);
                            if (filtered.items) filtered.items = filtered.items.filter(w => w.selected !== false);
                            executeAction({ ...pendingAction, action_payload: filtered });
                            setPendingAction(null);
                          }}
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <Check className="w-4 h-4 mr-1" /> {t('yesSoundsGood') || 'Yes, sounds good'}
                        </Button>
                      </div>
                    </motion.div>
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

      {/* Clear chat button at top right */}
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
