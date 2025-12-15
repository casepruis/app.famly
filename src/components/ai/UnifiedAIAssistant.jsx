// (ReviewAndConfirmPanel removed, now using ActionReviewPanel)
// UnifiedAIAssistant.jsx (CLEANED)
import React, { useState, useRef, useEffect, useCallback } from 'react';
import ActionReviewPanel from '../common/ActionReviewPanel';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Mic, MicOff, Send, Bot, Loader2, MessageCircle, Check, X, Volume2, VolumeX, StopCircle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/components/common/LanguageProvider";
// InvokeLLM removed - all LLM calls go through backend agents
import { AIAgent } from '@/api/aiAgent';
import { Task, ScheduleEvent, WishlistItem, ChatMessage, Conversation, fetchWithAuth } from '@/api/entities';
import { combineDateTimeToISO } from '@/utils/timezone';
import { detectLanguage, getLanguageName, shouldPromptLanguageSwitch } from '@/utils/languageDetection';
import { useVoiceAssistant } from '@/hooks/useVoiceAssistant';
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

// Convert AI response event payload to use proper timezone-aware datetimes
const convertEventPayloadTimezone = (payload, familyMembers = []) => {
  const converted = { ...payload };
  
  // Convert start_time if it exists
  if (converted.start_time && typeof converted.start_time === 'string') {
    // Skip conversion if already in UTC format (has Z or timezone offset)
    if (/[zZ]|[+\-]\d{2}:\d{2}$/.test(converted.start_time)) {
      // Already in UTC format, no conversion needed
    } else {
      // Extract date and time components from any datetime format
      const match = converted.start_time.match(/^(\d{4}-\d{2}-\d{2})T?(\d{2}:\d{2})/);
      if (match) {
        const [, date, time] = match;
        // Convert: AI often treats user's local time as UTC incorrectly
        converted.start_time = combineDateTimeToISO(date, time);
      }
    }
  }
  
  // Convert end_time if it exists
  if (converted.end_time && typeof converted.end_time === 'string') {
    // Skip conversion if already in UTC format (has Z or timezone offset)
    if (/[zZ]|[+\-]\d{2}:\d{2}$/.test(converted.end_time)) {
      // Already in UTC format, no conversion needed
    } else {
      // Extract date and time components from any datetime format
      const match = converted.end_time.match(/^(\d{4}-\d{2}-\d{2})T?(\d{2}:\d{2})/);
      if (match) {
        const [, date, time] = match;
        // Convert: AI often treats user's local time as UTC incorrectly
        converted.end_time = combineDateTimeToISO(date, time);
      }
    }
  }
  
  // Fix family member assignment: convert user emails to family member IDs
  if (converted.family_member_ids !== undefined) {
    const originalIds = converted.family_member_ids;
    
    // Ensure it's an array
    const idsArray = Array.isArray(originalIds) ? originalIds : [];
    
    // Convert user emails/IDs to family member IDs
    const validMemberIds = [];
    
    console.log(`🌍 Processing family_member_ids:`, originalIds);
    console.log(`🌍 Available family members:`, familyMembers.map(m => ({id: m.id, name: m.name, user_id: m.user_id})));
    
    for (const id of idsArray) {
      if (!id || typeof id !== 'string' || id.trim() === '') continue;
      
      // Check if it's already a valid family member ID
      const existingMember = familyMembers.find(m => m.id === id);
      if (existingMember) {
        validMemberIds.push(id);
        console.log(`🌍 Valid family member ID: ${id} (${existingMember.name})`);
        continue;
      }
      
      // Check if it's a user email that needs conversion to family member ID
      const memberByUserId = familyMembers.find(m => m.user_id === id);
      if (memberByUserId) {
        validMemberIds.push(memberByUserId.id);
        console.log(`🌍 Converted user email to family member: ${id} → ${memberByUserId.id} (${memberByUserId.name})`);
        continue;
      }
      
      console.log(`🌍 Invalid member ID ignored: ${id}`);
    }
    
    // Set the converted IDs (empty array shows "All Family")
    converted.family_member_ids = validMemberIds;
    
    // IMPORTANT: Only set assigned_to if it doesn't already exist (preserve user choices)
    if (converted.assigned_to === undefined) {
      converted.assigned_to = validMemberIds;
      console.log(`🌍 Set assigned_to to family_member_ids:`, validMemberIds);
    } else {
      console.log(`🌍 Preserved existing assigned_to:`, converted.assigned_to);
    }
    
    console.log(`🌍 Final family member IDs: ${JSON.stringify(originalIds)} → ${JSON.stringify(converted.family_member_ids)}`);
  }
  
  // FINAL STEP: Ensure family_member_ids reflects the final assignment choice
  // If assigned_to was set by user interaction, use that as the source of truth
  if (converted.assigned_to !== undefined && Array.isArray(converted.assigned_to)) {
    converted.family_member_ids = [...converted.assigned_to];
  }
  
  return converted;
};

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
  const { t, currentLanguage, updateUserLanguage } = useLanguage();
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
  const [languageMismatch, setLanguageMismatch] = useState(null); // {detectedLang, userMessage}
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const voiceResponseRef = useRef('');
  // useAgents removed - always use backend agents (no direct LLM calls from frontend)
  const conversationEndRef = useRef(null);

  // Voice assistant hook
  const {
    isConnected: voiceConnected,
    isListening,
    isProcessing: voiceProcessing,
    isPlaying,
    connect: connectVoice,
    disconnect: disconnectVoice,
    startListening,
    stopListening,
    sendText: sendVoiceText,
    cancelResponse: cancelVoiceResponse,
  } = useVoiceAssistant({
    language: currentLanguage,
    onTranscript: useCallback((text, role) => {
      if (role === 'user') {
        // User transcript is complete
        setVoiceTranscript(text);
        setConversation(prev => [...prev, { role: 'user', content: text }]);
        // Reset accumulator for next response
        voiceResponseRef.current = '';
      } else {
        // Assistant transcript comes as deltas, accumulate them
        voiceResponseRef.current += text;
        // Update the last assistant message or add new one
        setConversation(prev => {
          const lastIdx = prev.length - 1;
          if (lastIdx >= 0 && prev[lastIdx].role === 'assistant' && prev[lastIdx].isVoice) {
            // Update existing voice message
            return [...prev.slice(0, lastIdx), { ...prev[lastIdx], content: voiceResponseRef.current }];
          }
          // Add new voice message
          return [...prev, { role: 'assistant', content: voiceResponseRef.current, isVoice: true }];
        });
      }
    }, []),
    onFunctionCall: useCallback((name, result) => {
      console.log('🎤 Voice function call:', name, result);
      if (result?.success) {
        onUpdate?.(); // Refresh data after successful action
      }
    }, [onUpdate]),
    onError: useCallback((error) => {
      console.error('🎤 Voice error:', error);
      voiceResponseRef.current = '';
      setConversation(prev => [...prev, { 
        role: 'assistant', 
        content: currentLanguage === 'nl' 
          ? `Spraakfout: ${error}` 
          : `Voice error: ${error}` 
      }]);
    }, [currentLanguage]),
  });

  // Toggle voice mode
  const toggleVoice = useCallback(async () => {
    if (voiceEnabled) {
      disconnectVoice();
      setVoiceEnabled(false);
    } else {
      await connectVoice();
      setVoiceEnabled(true);
    }
  }, [voiceEnabled, connectVoice, disconnectVoice]);

  // Handle microphone button - single click to connect AND start listening
  const handleMicClick = useCallback(async () => {
    if (!voiceEnabled) {
      await toggleVoice();
      // Start listening immediately after connecting
      startListening();
      return;
    }
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [voiceEnabled, isListening, toggleVoice, startListening, stopListening]);

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
    setVoiceEnabled(false);
    disconnectVoice();
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }, [user?.id]);

  const handleClearChat = () => {
    setConversation([]);
    setPendingAction(null);
    setInputValue('');
    setVoiceTranscript('');
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
          console.log('🔧 DEBUG: create_event action triggered');
          console.log('🔧 DEBUG: Raw action_payload:', action_payload);
          const payload = convertEventPayloadTimezone({ ...action_payload }, allFamilyMembers);
          console.log('🔧 DEBUG: After conversion:', payload);
          if (!payload.family_id) payload.family_id = user?.family_id;
          // Add detected language to payload
          if (action_payload.language) {
            payload.language = action_payload.language;
            console.log('🔧 DEBUG: Added language to payload:', payload.language);
            console.log('🔧 DEBUG: Full payload with language:', payload);
          } else {
            console.log('🔧 DEBUG: No language in action_payload:', action_payload);
          }
          await ScheduleEvent.create(payload);
          setConversation(prev => [...prev, { role: 'assistant', content: t('eventCreated') || 'Event created!' }]);
          break;
        }
        case 'create_multiple_events': {
          const events = (action_payload?.events || []).filter(Boolean);
          for (const ev of events) {
            const payload = convertEventPayloadTimezone({ ...ev }, allFamilyMembers);
            if (!payload.family_id) payload.family_id = user?.family_id;
            // Add detected language to payload
            if (action_payload.language) {
              payload.language = action_payload.language;
              console.log('🔧 DEBUG: Added language to event payload:', payload.language);
            }
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

  /** ----------------- Language handling ----------------- */
  const handleLanguageChoice = async (choice) => {
    if (!languageMismatch) return;
    
    const messageText = languageMismatch.userMessage;
    const detectedLang = languageMismatch.detectedLang;
    let languageToUse = currentLanguage;
    
    if (choice === 'detected') {
      // Use detected language for this message only
      languageToUse = detectedLang;
    } else if (choice === 'preferred') {
      // Use current preferred language
      languageToUse = currentLanguage;
    } else if (choice === 'change') {
      // Change user's preferred language permanently
      try {
        // Update the language via the language context
        await updateUserLanguage(detectedLang);
        languageToUse = detectedLang;
        
        // Show confirmation message after processing
        setTimeout(() => {
          setConversation(prev => ([
            ...prev,
            { 
              role: 'assistant', 
              content: `Your preferred language has been changed to ${getLanguageName(detectedLang, detectedLang)}.`
            }
          ]));
        }, 1000);
      } catch (error) {
        console.error('Error updating language preference:', error);
        languageToUse = detectedLang; // Fallback to detected language
      }
    }
    
    setLanguageMismatch(null);
    
    // Add user message to conversation
    const userMsg = { role: 'user', content: messageText };
    setConversation(prev => [...prev, userMsg]);
    setIsProcessing(true);
    
    console.log('🌐 Processing with backend agent, language:', languageToUse);
    
    // Always use backend agents - no direct LLM calls from frontend
    await processWithBackendAgent(messageText, languageToUse);
  };

  /**
   * Process message using backend agent system
   * This routes through RootAgent → specialist agents (Planning, Task, etc.)
   */
  const processWithBackendAgent = async (messageText, languageToUse) => {
    const familyId = user?.family_id;
    
    if (!familyId) {
      setConversation(prev => [
        ...prev,
        { role: 'assistant', content: t('noFamilyIdError') || "I can't do that without a family context." }
      ]);
      return;
    }

    try {
      console.log('🤖 Using backend agent for:', messageText.substring(0, 50));
      
      const response = await AIAgent.chat(familyId, messageText, {
        language: languageToUse
      });
      
      console.log('🤖 Agent response:', response);
      
      // Add the agent's response message
      setConversation(prev => [
        ...prev,
        { role: 'assistant', content: response.message }
      ]);
      
      // Process any suggestions from the agent
      if (response.suggestions && response.suggestions.length > 0) {
        const tasks = [];
        const events = [];
        const wishlist = [];
        
        for (const suggestion of response.suggestions) {
          if (suggestion.action_type === 'create_task') {
            tasks.push({
              ...suggestion.action_data,
              family_id: familyId,
            });
          } else if (suggestion.action_type === 'create_event') {
            events.push({
              ...suggestion.action_data,
              family_id: familyId,
            });
          } else if (suggestion.action_type === 'add_to_wishlist') {
            wishlist.push(suggestion.action_data);
          }
        }
        
        if (tasks.length || events.length || wishlist.length) {
          const eventsWithSelection = events.map((e, idx) => ({
            id: e.id || `event-${Date.now()}-${idx}`,
            selected: true,
            ...convertEventPayloadTimezone(e, allFamilyMembers),
          }));
          
          setPendingAction({
            action_payload: {
              tasks,
              events: eventsWithSelection,
              items: wishlist,
              language: languageToUse,
            }
          });
        }
      }
      
      // Refresh data if tool calls were made
      if (response.tool_calls && response.tool_calls.length > 0) {
        const hasSuccessfulCalls = response.tool_calls.some(tc => tc.status === 'completed');
        if (hasSuccessfulCalls) {
          onUpdate?.();
        }
      }
      
    } catch (error) {
      console.error('Backend agent error:', error);
      // Show error to user instead of falling back to direct LLM
      setConversation(prev => [
        ...prev,
        { role: 'assistant', content: t('aiError') || "Sorry, I had trouble processing that. Please try again." }
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  /** ----------------- Sending flow ----------------- */
  const handleSend = async (messageText) => {
    if (isProcessing || !messageText?.trim()) return;

    setPendingAction(null);
    setLanguageMismatch(null);

    // Only detect language for messages with 4+ words (skip greetings like "hoi", "hey")
    const wordCount = messageText.trim().split(/\s+/).length;
    let detectedLang = currentLanguage; // Default to current language
    
    if (wordCount >= 4) {
      detectedLang = await detectLanguage(messageText);
      console.log('🌐 Language detection:', {
        input: messageText,
        detected: detectedLang,
        userPreference: currentLanguage,
        wordCount
      });

      // Check for language mismatch and prompt user
      if (shouldPromptLanguageSwitch(detectedLang, currentLanguage)) {
        console.log('🌐 Language mismatch detected, showing prompt');
        setLanguageMismatch({
          detectedLang,
          userMessage: messageText,
          detectedLangName: getLanguageName(detectedLang, currentLanguage),
          preferredLangName: getLanguageName(currentLanguage, currentLanguage)
        });
        return; // Stop processing, wait for user choice
      }
    } else {
      console.log('🌐 Skipping language detection for short message:', { wordCount, messageText });
    }

    // Add user message to conversation
    const userMsg = { role: 'user', content: messageText };
    setConversation(prev => [...prev, userMsg]);
    setInputValue('');
    setIsProcessing(true);

    // Always use backend agents - no direct LLM fallback
    await processWithBackendAgent(messageText, currentLanguage);
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
                      const familyId = user?.family_id;
                      const language = pendingAction.action_payload?.language || currentLanguage;
                      
                      try {
                        if (tasks && tasks.length) await Task.bulkCreate(tasks);
                        
                        let createdEvents = [];
                        if (events && events.length) {
                          console.log('🔧 DEBUG: bulkCreate events triggered');
                          console.log('🔧 DEBUG: Raw events array:', events);
                          // Apply timezone conversion to all events and add language
                          const convertedEvents = events.map(event => {
                            const converted = convertEventPayloadTimezone(event, allFamilyMembers);
                            if (language) {
                              converted.language = language;
                              console.log('🔧 DEBUG: Added language to bulk event:', converted.language);
                            }
                            return converted;
                          });
                          console.log('🔧 DEBUG: After bulk conversion:', convertedEvents);
                          createdEvents = await ScheduleEvent.bulkCreate(convertedEvents);
                        }
                        if (items && items.length) await WishlistItem.bulkCreate(items);
                        
                        if ((tasks && tasks.length) || (events && events.length) || (items && items.length)) {
                          setConversation(prev => ([...prev, { role: 'assistant', content: 'Items added!' }]));
                        }
                        
                        // Note: Backend agent already includes task suggestions in its response
                        // No additional AI analysis needed for events created via agent
                        if (false && createdEvents.length > 0 && familyId) { // Disabled - agent handles this
                          setPendingAction(null); // Clear current pending action first
                          setIsProcessing(true);
                          
                          try {
                            console.log('🤖 Analyzing created events for suggestions...');
                            
                            for (const event of createdEvents) {
                              const analysis = await AIAgent.analyzeEvent(familyId, {
                                ...event,
                                language
                              });
                              
                              console.log('🤖 Event analysis result:', analysis);
                              
                              // Collect task suggestions
                              const suggestedTasks = [];
                              if (analysis.suggested_tasks && analysis.suggested_tasks.length > 0) {
                                for (const task of analysis.suggested_tasks) {
                                  const assignedTo = task.assignee_id ? [task.assignee_id] : (task.assigned_to || []);
                                  suggestedTasks.push({
                                    title: task.title,
                                    description: task.description,
                                    due_date: task.due_date,
                                    assigned_to: assignedTo,
                                    status: 'pending',
                                    priority: task.priority || 'medium',
                                    family_id: familyId,
                                    related_event_id: event.id,
                                    ai_suggested: true,
                                    selected: true
                                  });
                                }
                              }
                              
                              // Show task suggestions if any
                              if (suggestedTasks.length > 0) {
                                setPendingAction({
                                  action_payload: {
                                    tasks: suggestedTasks,
                                    events: [],
                                    items: [],
                                    language
                                  }
                                });
                              }
                            }
                          } catch (analysisError) {
                            console.error('🚨 Event analysis failed:', analysisError);
                          } finally {
                            setIsProcessing(false);
                          }
                          return;
                        }
                      } catch (e) {
                        console.error('🚨 Error in confirm handler:', e);
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

      {/* Language Mismatch Dialog */}
      {languageMismatch && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-4 mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg"
        >
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
              <Bot className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-amber-800 mb-3">
                {currentLanguage === 'nl' 
                  ? `Ik heb gedetecteerd dat je in het ${languageMismatch.detectedLangName} schrijft, maar je voorkeurstaal is ingesteld op ${languageMismatch.preferredLangName}. Hoe wil je doorgaan?`
                  : `I detected you're writing in ${languageMismatch.detectedLangName}, but your preferred language is set to ${languageMismatch.preferredLangName}. How would you like to proceed?`
                }
              </p>
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleLanguageChoice('detected')}
                    className="bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    {currentLanguage === 'nl' 
                      ? `Antwoord in het ${languageMismatch.detectedLangName} (eenmalig)`
                      : `Respond in ${languageMismatch.detectedLangName} (this time)`
                    }
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleLanguageChoice('preferred')}
                  >
                    {currentLanguage === 'nl' 
                      ? `Gebruik ${languageMismatch.preferredLangName}`
                      : `Use ${languageMismatch.preferredLangName}`
                    }
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleLanguageChoice('change')}
                    className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
                  >
                    {currentLanguage === 'nl' 
                      ? `Wijzig voorkeur naar ${languageMismatch.detectedLangName}`
                      : `Change preference to ${languageMismatch.detectedLangName}`
                    }
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setLanguageMismatch(null)}
                  >
                    {t('cancel') || 'Cancel'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Voice Status Indicator */}
      {voiceEnabled && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-4 mb-2 p-3 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isListening ? (
                <>
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-sm text-purple-700 font-medium">
                    {currentLanguage === 'nl' ? 'Luisteren...' : 'Listening...'}
                  </span>
                </>
              ) : isPlaying ? (
                <>
                  <Volume2 className="w-4 h-4 text-purple-600 animate-pulse" />
                  <span className="text-sm text-purple-700">
                    {currentLanguage === 'nl' ? 'Spreken...' : 'Speaking...'}
                  </span>
                </>
              ) : voiceProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 text-purple-600 animate-spin" />
                  <span className="text-sm text-purple-700">
                    {currentLanguage === 'nl' ? 'Verwerken...' : 'Processing...'}
                  </span>
                </>
              ) : (
                <>
                  <div className="w-3 h-3 bg-green-500 rounded-full" />
                  <span className="text-sm text-purple-700">
                    {currentLanguage === 'nl' ? 'Spraakassistent klaar' : 'Voice assistant ready'}
                  </span>
                </>
              )}
            </div>
            {(isPlaying || voiceProcessing) ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={cancelVoiceResponse}
                className="text-orange-600 hover:text-orange-800"
              >
                <StopCircle className="w-4 h-4 mr-1" />
                {currentLanguage === 'nl' ? 'Onderbreek' : 'Interrupt'}
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { disconnectVoice(); setVoiceEnabled(false); }}
                className="text-purple-600 hover:text-purple-800"
              >
                <VolumeX className="w-4 h-4 mr-1" />
                {currentLanguage === 'nl' ? 'Sluit' : 'Close'}
              </Button>
            )}
          </div>
          {voiceTranscript && (
            <p className="text-xs text-purple-600 mt-1 italic">"{voiceTranscript}"</p>
          )}
        </motion.div>
      )}

      {/* Composer */}
      <div className="border-t p-2 sm:p-4 bg-white flex-shrink-0">
        <div className="relative flex items-center gap-2">
          <Textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={voiceEnabled 
              ? (currentLanguage === 'nl' ? 'Klik op de microfoon om te spreken...' : 'Click the microphone to speak...')
              : (t('typeYourMessage') || "Type your message...")
            }
            className="w-full pr-28 rounded-lg border-gray-300 focus:ring-blue-500 focus:border-blue-500 resize-none"
            rows={1}
            disabled={isProcessing || !!pendingAction || isListening}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
            <Button 
              variant="ghost" 
              size="icon" 
              className={`transition-colors ${
                isListening 
                  ? 'text-red-500 hover:text-red-600 animate-pulse' 
                  : voiceEnabled 
                    ? 'text-purple-500 hover:text-purple-600' 
                    : 'text-gray-500 hover:text-blue-500'
              }`}
              onClick={handleMicClick}
              disabled={isProcessing || !!pendingAction}
              title={voiceEnabled 
                ? (isListening 
                    ? (currentLanguage === 'nl' ? 'Stop luisteren' : 'Stop listening')
                    : (currentLanguage === 'nl' ? 'Start luisteren' : 'Start listening'))
                : (currentLanguage === 'nl' ? 'Spraak activeren' : 'Enable voice')
              }
            >
              {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </Button>
            <Button
              size="sm"
              onClick={() => inputValue.trim() && handleSend(inputValue.trim())}
              disabled={!inputValue.trim() || isProcessing || !!pendingAction || isListening}
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
