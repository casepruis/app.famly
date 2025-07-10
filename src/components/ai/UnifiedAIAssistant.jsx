
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Mic, Send, Bot, Loader2, MessageCircle, Check, X, Calendar, Clock, ChevronDown } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/components/common/LanguageProvider";
import { InvokeLLM } from '@/api/integrations';
import { Task, ScheduleEvent, WishlistItem, ChatMessage, Conversation } from '@/api/entities';

export default function UnifiedAIAssistant({ conversationContext, allFamilyMembers = [], user, onUpdate }) {
  const { t, currentLanguage } = useLanguage();
  const [inputValue, setInputValue] = useState('');
  const [conversation, setConversation] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const conversationEndRef = useRef(null);

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation, pendingAction]);

  const executeAction = async (action) => {
    try {
      let successMessage = '';
      if (action.action_type === 'create_task') {
        await Task.create(action.action_payload);
        successMessage = t('taskCreatedConfirmation', { title: action.action_payload.title }) || `Okay, I've created the task: "${action.action_payload.title}".`;
      } else if (action.action_type === 'create_event') {
        await ScheduleEvent.create(action.action_payload);
        successMessage = t('eventCreatedConfirmation', { title: action.action_payload.title }) || `Okay, I've scheduled the event: "${action.action_payload.title}".`;
      } else if (action.action_type === 'add_to_wishlist') {
        await WishlistItem.create(action.action_payload);
        successMessage = t('wishlistAddedConfirmation', { name: action.action_payload.name }) || `Okay, I've added "${action.action_payload.name}" to the wishlist.`
      } else if (action.action_type === 'create_multiple_events' || action.action_type === 'propose_multiple_events_from_chat') { // Also handle the new 'propose_multiple_events_from_chat' here
        let createdEventTitles = [];
        for (const eventPayload of action.action_payload.events) {
          await ScheduleEvent.create(eventPayload);
          createdEventTitles.push(eventPayload.title);
        }
        successMessage = t('multipleEventsCreatedConfirmation', { count: createdEventTitles.length, titles: createdEventTitles.join(', ') }) || `Okay, I've scheduled ${createdEventTitles.length} events: ${createdEventTitles.join(', ')}.`;
      } else {
         return;
      }

      setConversation(prev => [...prev, { role: 'assistant', content: successMessage }]);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error("Error executing action:", error);
      setConversation(prev => [...prev, { role: 'assistant', content: t('aiError') || "I couldn't complete that action. Please try again." }]);
    }
  };

  const handleConfirmAction = () => {
    if (!pendingAction) return;
    executeAction(pendingAction);
    setPendingAction(null);
  };
  
  const handleCancelAction = () => {
    setPendingAction(null);
    setConversation(prev => [...prev, { role: 'assistant', content: t('actionCancelled') || 'Okay, I won\'t do that.' }]);
  };

  const handleSend = async (messageText) => {
    if (isProcessing || !messageText?.trim()) return;

    setPendingAction(null);
    const newMessage = { role: 'user', content: messageText };
    setConversation(prev => [...prev, newMessage]);
    setInputValue('');
    setIsProcessing(true);

    try {
      const familyMembers = Array.isArray(allFamilyMembers) ? allFamilyMembers : [];
      const currentUserMember = user ? familyMembers.find(m => m.user_id === user.id) : null;
      const familyMemberInfo = familyMembers.map(m => ({ id: m.id, name: m.name }));
      const familyId = user?.family_id || null;

      if (!familyId) {
        setConversation(prev => [...prev, { role: 'assistant', content: t('noFamilyIdError') || "I can't do that without a family context. Please set up or join a family first." }]);
        setIsProcessing(false);
        return;
      }

      // Build conversation history for context
      const conversationHistory = conversation.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // Add the new user message to the history
      conversationHistory.push({ role: 'user', content: messageText });

      // Create a conversation context string
      const recentHistory = conversationHistory.slice(-6); // Last 6 messages for context
      const contextString = recentHistory.map(msg => 
        `${msg.role === 'user' ? 'Gebruiker' : 'Assistent'}: ${msg.content}`
      ).join('\n');

      const prompt = `Je bent famly.ai, een behulpzame Nederlandse familiehulp assistent.
De gebruiker is ${currentUserMember?.name || 'een familielid'}. Hun ID is ${currentUserMember?.id}. Wanneer ze "ik", "mij", of "mijn" zeggen, MOET je hun ID gebruiken.
Vandaag is ${new Date().toISOString()}.
Taal van de gebruiker: ${currentLanguage}.
Familieleden beschikbaar: ${JSON.stringify(familyMemberInfo)}.
De familie ID is: ${familyId}.

BELANGRIJK: ALLE antwoorden moeten in het Nederlands zijn. Gebruik juiste grammatica en natuurlijke bewoordingen.

GESPREKSGESCHIEDENIS:
${contextString}

ANALYSEER het huidige bericht van de gebruiker: "${messageText}" in de context van het bovenstaande gesprek en kies ÉÉN van de volgende JSON outputs:

1. **ALS de gebruiker MEERDERE activiteiten in één bericht noemt (bijv. "wendag in de ochtend en feestje in de middag"):**
   Parseer ELKE activiteit in een apart event-object. Interpreteer dagdelen: ochtend (09:00-12:00), middag (13:00-17:00), avond (18:00-22:00).
   {
      "action_type": "propose_multiple_events_from_chat",
      "confirmation_message": "Ik heb deze activiteiten gevonden in je bericht. Kloppen de details?",
      "action_payload": {
        "events": [
          { "title": "Wendag school", "start_time": "YYYY-MM-DDTH09:00:00.000Z", "end_time": "YYYY-MM-DDTH12:00:00.000Z", "family_member_ids": ["id_van_Kai", "id_van_Max"], "family_id": "${familyId}" },
          { "title": "Feestje Jax", "start_time": "YYYY-MM-DDTH13:00:00.000Z", "end_time": "YYYY-MM-DDTH17:00:00.000Z", "family_member_ids": ["id_van_Kai", "id_van_Max"], "family_id": "${familyId}" }
        ]
      }
    }

2.  **ALS de gebruiker een groot blok tekst plakt met datums (zoals een vakantieschema):**
    Gebruik deze actie. Parseer ALLE datums en evenementen uit de tekst.
    - "20 t/m 24 oktober 2025" -> start: 2025-10-20T00:00:00, end: 2025-10-24T23:59:59
    - "22 december 2025 t/m 02 januari 2026" -> start: 2025-12-22T00:00:00, end: 2026-01-02T23:59:59
    - "vanaf 12 uur" -> starttijd is 12:00, eindtijd is 23:59 op dezelfde dag.
    - Stel categorie in op "holiday" voor vakanties en "studyday" voor studiedagen/margedagen.
    {
      "action_type": "propose_multiple_events",
      "confirmation_message": "Ik heb de vakantiedata gevonden! Controleer de lijst en bevestig.",
      "action_payload": {
        "events": [
          { "title": "Herfstvakantie", "start_time": "2025-10-20T00:00:00.000Z", "end_time": "2025-10-24T23:59:59.000Z", "family_id": "${familyId}", "category": "holiday", "family_member_ids": [] }
        ]
      }
    }

3.  **ALS de gebruiker vraagt om een ENKELE taak aan te maken:**
    {
      "action_type": "propose_task",
      "confirmation_message": "Ik kan een taak aanmaken: [Titel] op [Datum]. Klopt dat?",
      "action_payload": { "title": "...", "description": "...", "assigned_to": ["user_id_if_I_or_me"], "due_date": "YYYY-MM-DDTHH:MM:SS", "family_id": "${familyId}", "status": "todo" }
    }

4.  **ALS de gebruiker vraagt om een ENKELE afspraak te plannen:**
    {
      "action_type": "propose_event",
      "confirmation_message": "Ik kan deze afspraak plannen: [beschrijving]. Voor welke datum/tijd?",
      "action_payload": { "title": "...", "start_time": "YYYY-MM-DDTHH:MM:SS", "end_time": "...", "family_member_ids": ["member_ids"], "family_id": "${familyId}" }
    }

5.  **ALS je genoeg info hebt om aan verlanglijst toe te voegen:**
    {
        "action_type": "propose_wishlist_item",
        "confirmation_message": "Moet ik [Item Naam] aan de verlanglijst van [Naam gezinslid] toevoegen?",
        "action_payload": { "name": "...", "url": "...", "family_member_id": "member_id_for_wishlist" }
    }

6.  **ALS informatie ontbreekt voor een actie:**
    { "action_type": "clarify", "clarification_question": "Je vraag in het Nederlands met verwijzing naar de context." }

7.  **ALS het gewoon algemene chat is:**
    { "action_type": "chat", "response": "Je vriendelijke, gesprekmatige antwoord in het Nederlands dat past bij de context." }
    
Output ALLEEN de JSON.`;

      const response = await InvokeLLM({ prompt, response_json_schema: { type: "object" } });

      let aiResponse, hasAction = false;

      switch (response.action_type) {
        case 'propose_task':
          aiResponse = response.confirmation_message;
          setPendingAction({ action_type: 'create_task', action_payload: response.action_payload });
          hasAction = true;
          break;
        case 'propose_event':
          aiResponse = response.confirmation_message;
          setPendingAction({ action_type: 'create_event', action_payload: response.action_payload });
          hasAction = true;
          break;
        case 'propose_multiple_events':
          aiResponse = response.confirmation_message;
          setPendingAction({ action_type: 'create_multiple_events', action_payload: response.action_payload });
          hasAction = true;
          break;
        case 'propose_multiple_events_from_chat': // New case for multiple events from chat
          aiResponse = response.confirmation_message;
          setPendingAction({ action_type: 'propose_multiple_events_from_chat', action_payload: response.action_payload }); // Keep original action_type for pendingAction
          hasAction = true;
          break;
        case 'propose_wishlist_item':
          aiResponse = response.confirmation_message;
          setPendingAction({ action_type: 'add_to_wishlist', action_payload: response.action_payload });
          hasAction = true;
          break;
        case 'clarify':
          aiResponse = response.clarification_question;
          break;
        case 'chat':
        default:
          aiResponse = response.response;
          
          // If this is a chat context, save the AI response as a chat message
          if (conversationContext?.type === 'chat' && user?.family_id) {
            const aiMember = allFamilyMembers.find(m => m.role === 'ai_assistant');
            if (aiMember) {
              console.log("💬 Saving AI response as chat message");
              await ChatMessage.create({
                conversation_id: conversationContext.conversationId,
                sender_id: aiMember.id,
                content: response.response, // Use response.response from the 'chat' action type
                message_type: 'ai_suggestion'
              });
              
              // Update conversation timestamp
              await Conversation.update(conversationContext.conversationId, {
                last_message_preview: response.response.substring(0, 100),
                last_message_timestamp: new Date().toISOString()
              });
              
              console.log("📢 AI message saved, should trigger notification polling");
            } else {
                console.warn("AI assistant member not found. Cannot save AI chat message.");
            }
          }
          break;
      }

      const newAIMessage = { role: 'assistant', content: aiResponse || (t('aiError') || "Sorry, ik had een beetje moeite daarmee. Kun je het anders formuleren?"), hasAction, action: pendingAction };
      setConversation(prev => [...prev, newAIMessage]);
      
    } catch (error) {
      console.error("Error processing message:", error);
      setConversation(prev => [...prev, { role: 'assistant', content: t('aiError') || "Sorry, ik had een beetje moeite daarmee. Kun je het anders formuleren?" }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (inputValue.trim()) {
        handleSend(inputValue.trim());
      }
    }
  };

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
                <MessageCircle className="w-12 h-12 mx-auto text-gray-300 mb-2"/>
                <p className="mb-1 font-medium">{t('aiAssistantTitle') || 'Uw persoonlijke assistent'}</p>
                <p className="text-sm text-gray-500 mb-4">{t('aiAssistantTagline') || 'Hoe kan ik uw gezinsleven vereenvoudigen?'}</p>
                <div className="text-sm space-y-1 text-gray-400">
                  <p>"{t('scheduleMyAppointment') || "Plan mijn afspraak voor morgen"}"</p>
                  <p>"{t('addToMyWishlist') || "Voeg een nieuw spel toe aan mijn verlanglijst"}"</p>
                  <p>"{t('createMyTasks') || "Maak een taak om mijn kamer op te ruimen"}"</p>
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
                {msg.hasAction && index === conversation.length - 1 && 
                 (pendingAction?.action_type === 'create_multiple_events' || pendingAction?.action_type === 'propose_multiple_events_from_chat') && ( // Check for both types of multiple event proposals
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-3 p-3 bg-white border rounded-lg max-h-80 overflow-y-auto w-full max-w-md"
                  >
                    <h4 className="font-semibold text-sm mb-2">{t('proposedEvents') || 'Voorgestelde evenementen:'}</h4>
                    <div className="space-y-3">
                      {pendingAction.action_payload.events.map((event, i) => (
                        <div key={i} className="p-3 bg-gray-50 rounded-lg">
                          <div className="font-medium text-sm mb-2">{event.title}</div>
                          
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <label className="block text-gray-600 mb-1">Start:</label>
                              <Select 
                                value={new Date(event.start_time).toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-')} 
                                onValueChange={(dateStr) => {
                                  const originalDate = new Date(event.start_time);
                                  const currentHour = originalDate.getHours();
                                  const currentMinute = originalDate.getMinutes();

                                  const newLocalDatetime = new Date(dateStr); 
                                  newLocalDatetime.setHours(currentHour);
                                  newLocalDatetime.setMinutes(currentMinute);
                                  newLocalDatetime.setSeconds(0);
                                  newLocalDatetime.setMilliseconds(0);

                                  const newStartTime = newLocalDatetime.toISOString();
                                  setPendingAction(prev => ({
                                    ...prev,
                                    action_payload: {
                                      ...prev.action_payload,
                                      events: prev.action_payload.events.map((e, idx) => 
                                        idx === i ? { ...e, start_time: newStartTime } : e
                                      )
                                    }
                                  }));
                                }}
                              >
                                <SelectTrigger className="h-7 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Array.from({ length: 7 }, (_, dayOffset) => {
                                    const optionDate = new Date();
                                    optionDate.setDate(optionDate.getDate() + dayOffset);
                                    const valueStr = optionDate.toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
                                    return (
                                      <SelectItem key={valueStr} value={valueStr}>
                                        {optionDate.toLocaleDateString(currentLanguage, { 
                                          weekday: 'short', 
                                          day: 'numeric', 
                                          month: 'short' 
                                        })}
                                      </SelectItem>
                                    );
                                  })}
                                </SelectContent>
                              </Select>
                              
                              <Select 
                                value={new Date(event.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })} 
                                onValueChange={(timeStr) => {
                                  const originalDate = new Date(event.start_time);
                                  const currentYear = originalDate.getFullYear();
                                  const currentMonth = originalDate.getMonth();
                                  const currentDay = originalDate.getDate();

                                  const [newHour, newMinute] = timeStr.split(':').map(Number);
                                  const newLocalDatetime = new Date(currentYear, currentMonth, currentDay, newHour, newMinute, 0, 0);

                                  const newStartTime = newLocalDatetime.toISOString();
                                  setPendingAction(prev => ({
                                    ...prev,
                                    action_payload: {
                                      ...prev.action_payload,
                                      events: prev.action_payload.events.map((e, idx) => 
                                        idx === i ? { ...e, start_time: newStartTime } : e
                                      )
                                    }
                                  }));
                                }}
                              >
                                <SelectTrigger className="h-7 text-xs mt-1">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Array.from({ length: 48 }, (_, j) => {
                                    const hour = Math.floor(j / 2);
                                    const minute = (j % 2) * 30;
                                    const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                                    return (
                                      <SelectItem key={time} value={time}>
                                        {time}
                                      </SelectItem>
                                    );
                                  })}
                                </SelectContent>
                              </Select>
                            </div>
                            
                            <div>
                              <label className="block text-gray-600 mb-1">Eind:</label>
                              <Select 
                                value={new Date(event.end_time).toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-')} 
                                onValueChange={(dateStr) => {
                                  const originalDate = new Date(event.end_time);
                                  const currentHour = originalDate.getHours();
                                  const currentMinute = originalDate.getMinutes();

                                  const newLocalDatetime = new Date(dateStr); 
                                  newLocalDatetime.setHours(currentHour);
                                  newLocalDatetime.setMinutes(currentMinute);
                                  newLocalDatetime.setSeconds(0);
                                  newLocalDatetime.setMilliseconds(0);

                                  const newEndTime = newLocalDatetime.toISOString();
                                  setPendingAction(prev => ({
                                    ...prev,
                                    action_payload: {
                                      ...prev.action_payload,
                                      events: prev.action_payload.events.map((e, idx) => 
                                        idx === i ? { ...e, end_time: newEndTime } : e
                                      )
                                    }
                                  }));
                                }}
                              >
                                <SelectTrigger className="h-7 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Array.from({ length: 7 }, (_, dayOffset) => {
                                    const optionDate = new Date();
                                    optionDate.setDate(optionDate.getDate() + dayOffset);
                                    const valueStr = optionDate.toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
                                    return (
                                      <SelectItem key={valueStr} value={valueStr}>
                                        {optionDate.toLocaleDateString(currentLanguage, { 
                                          weekday: 'short', 
                                          day: 'numeric', 
                                          month: 'short' 
                                        })}
                                      </SelectItem>
                                    );
                                  })}
                                </SelectContent>
                              </Select>
                              
                              <Select 
                                value={new Date(event.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })} 
                                onValueChange={(timeStr) => {
                                  const originalDate = new Date(event.end_time);
                                  const currentYear = originalDate.getFullYear();
                                  const currentMonth = originalDate.getMonth();
                                  const currentDay = originalDate.getDate();

                                  const [newHour, newMinute] = timeStr.split(':').map(Number);
                                  const newLocalDatetime = new Date(currentYear, currentMonth, currentDay, newHour, newMinute, 0, 0);

                                  const newEndTime = newLocalDatetime.toISOString();
                                  setPendingAction(prev => ({
                                    ...prev,
                                    action_payload: {
                                      ...prev.action_payload,
                                      events: prev.action_payload.events.map((e, idx) => 
                                        idx === i ? { ...e, end_time: newEndTime } : e
                                      )
                                    }
                                  }));
                                }}
                              >
                                <SelectTrigger className="h-7 text-xs mt-1">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Array.from({ length: 48 }, (_, j) => {
                                    const hour = Math.floor(j / 2);
                                    const minute = (j % 2) * 30;
                                    const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                                    return (
                                      <SelectItem key={time} value={time}>
                                        {time}
                                      </SelectItem>
                                    );
                                  })}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
                {msg.hasAction && index === conversation.length - 1 && pendingAction && (
                    <motion.div 
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex gap-2 mt-2"
                    >
                        <Button onClick={handleConfirmAction} size="sm" className="bg-green-600 hover:bg-green-700">
                            <Check className="w-4 h-4 mr-1"/> {t('yesSoundsGood') || 'Ja, klinkt goed'}
                        </Button>
                        <Button onClick={handleCancelAction} size="sm" variant="outline">
                           <X className="w-4 h-4 mr-1"/> {t('cancel') || 'Annuleren'}
                        </Button>
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
      <div className="border-t p-2 sm:p-4 bg-white flex-shrink-0">
        <div className="relative">
          <Textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('typeYourMessage') || "Typ uw bericht..."}
            className="w-full pr-24 rounded-lg border-gray-300 focus:ring-blue-500 focus:border-blue-500 resize-none"
            rows={1}
            disabled={isProcessing || !!pendingAction}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="text-gray-500 hover:text-blue-500"
              disabled={true}
            >
              <Mic className={`w-5 h-5`} />
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (inputValue.trim()) {
                  handleSend(inputValue.trim());
                }
              }}
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
