
import React, { useState, useEffect, useRef } from 'react';
import { User, FamilyMember, ChatMessage, Conversation, Task, ScheduleEvent } from '@/api/entities';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2, Bot, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from "@/components/ui/use-toast";
import { InvokeLLM } from '@/api/integrations';
import InlineTaskReview from './InlineTaskReview';
import VacationEventsReview from './VacationEventsReview';

export default function ChatWindow({ conversationId }) {
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
            await ChatMessage.create({
                conversation_id: convoId, 
                sender_id: aiMember.id, 
                content: welcomeMessage, 
                message_type: 'ai_introduction'
            });
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

    useEffect(() => {
        const loadChatData = async () => {
            if (!conversationId) return;
            setIsLoading(true);
            setPendingAction(null);
            
            try {
                const user = await User.me();
                let members = await FamilyMember.list();
                const userMember = members.find(m => m.user_id === user.id);
                setCurrentUserMember(userMember);

                // --- Robust AI Member Handling ---
                let aiMember = members.find(m => m.role === 'ai_assistant');
                if (!aiMember && user.family_id) {
                    aiMember = await createAIAssistant(user.family_id);
                    if (aiMember) {
                        members = await FamilyMember.list(); // Refresh members list
                    }
                }
                setAiAssistant(aiMember);
                setFamilyMembers(members);

                // --- Load Messages & Ensure AI Introduction ---
                let initialMessages = await ChatMessage.filter({ conversation_id: conversationId }, 'created_date');
                
                if (aiMember) {
                    const hasIntro = initialMessages.some(m => m.sender_id === aiMember.id && m.message_type === 'ai_introduction');
                    if (!hasIntro) {
                        await introduceAI(aiMember, conversationId);
                        initialMessages = await ChatMessage.filter({ conversation_id: conversationId }, 'created_date'); // Reload to include intro
                    }
                }
                
                setMessages(initialMessages || []);
                window.dispatchEvent(new CustomEvent('famly-chat-opened', { detail: { conversationId } }));

            } catch (error) {
                console.error("Chat initialization error:", error);
                toast({ title: "Chat Error", description: "Could not initialize chat", variant: "destructive" });
            } finally {
                setIsLoading(false);
            }
        };
        
        loadChatData();
        
        const handleNewMessage = (event) => {
            const { message } = event.detail;
            if (message.conversation_id === conversationId) {
                setMessages(prev => [...prev, message]);
            }
        };

        window.addEventListener('famly-new-chat-message', handleNewMessage);
        return () => window.removeEventListener('famly-new-chat-message', handleNewMessage);
    }, [conversationId]);
    
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isAiProcessing, pendingAction]);

    const handleSendMessage = async () => {
        if (!inputValue.trim() || isSending || !currentUserMember) return;
        setIsSending(true);
        const content = inputValue.trim();
        setInputValue('');

        try {
            // Create the message in the database
            const newMessage = await ChatMessage.create({
                conversation_id: conversationId, 
                sender_id: currentUserMember.id, 
                content,
            });
            
            // Update conversation timestamp
            await Conversation.update(conversationId, {
                last_message_preview: content, 
                last_message_timestamp: new Date().toISOString()
            });
            
            // Add message to local state immediately
            setMessages(prev => [...prev, newMessage]);
            
        } catch (error) {
            console.error("Error sending message:", error);
            setInputValue(content); // Restore input for retry
            toast({ title: "Send Failed", variant: "destructive" });
        } finally {
            setIsSending(false);
        }
    };

    const handleAiAction = async () => {
        if (isAiProcessing || !aiAssistant) return;
        setIsAiProcessing(true);
        setPendingAction(null);

        try {
            const conversationHistory = messages.map(msg => {
                const sender = familyMembers.find(m => m.id === msg.sender_id);
                return `${sender?.name || 'Unknown'}: ${msg.content}`;
            }).join('\n');

            const familyMemberInfo = familyMembers.filter(m => m.role !== 'ai_assistant').map(m => ({ id: m.id, name: m.name }));
            const familyId = currentUserMember?.family_id;

            const response = await InvokeLLM({
                prompt: `You are famly.ai, a helpful Dutch family assistant. Analyze the ENTIRE CHAT LOG provided below to provide a summary and create actionable items.

CHAT LOG:
---
${conversationHistory}
---

Based on the chat, identify:
1. A concise summary of the conversation in Dutch.
2. Any tasks that need to be created.
3. Any events that need to be scheduled.

Family Members: ${JSON.stringify(familyMemberInfo)}
Family ID: ${familyId}

Respond with a JSON object with the following structure:
{
  "summary": "Een korte samenvatting van het gesprek in het Nederlands.",
  "tasks": [
    { "title": "...", "description": "...", "assigned_to": ["member_id"], "family_id": "${familyId}" }
  ],
  "events": [
    { "title": "...", "start_time": "YYYY-MM-DDTHH:MM:SS", "end_time": "...", "family_member_ids": ["member_id"], "family_id": "${familyId}" }
  ]
}

If no tasks or events are found, return empty arrays. The summary is mandatory.`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        summary: { type: "string" },
                        tasks: { type: "array", items: { type: "object" } },
                        events: { type: "array", items: { type: "object" } }
                    },
                    required: ["summary"]
                }
            });

            if (!response.summary) {
                throw new Error("AI did not provide a summary.");
            }

            const createdAiMessage = await ChatMessage.create({
                conversation_id: conversationId,
                sender_id: aiAssistant.id,
                content: response.summary,
                message_type: 'ai_suggestion'
            });

            if ((response.tasks && response.tasks.length > 0) || (response.events && response.events.length > 0)) {
                setPendingAction({
                    tasks: response.tasks || [],
                    events: response.events || [],
                    messageId: createdAiMessage.id
                });
            }

        } catch (error) {
            console.error("AI action error:", error);
            toast({ title: "AI Error", description: "Could not get suggestions.", variant: "destructive" });
        } finally {
            setIsAiProcessing(false);
        }
    };

    const handleConfirmActions = async (confirmedTasks, confirmedEvents) => {
        try {
            if (confirmedTasks.length > 0) await Task.bulkCreate(confirmedTasks);
            if (confirmedEvents.length > 0) await ScheduleEvent.bulkCreate(confirmedEvents);

            if (confirmedTasks.length > 0 || confirmedEvents.length > 0) {
                toast({ title: "AI Suggestions Added", description: "Tasks and events have been added to your schedule." });
            }
        } catch (error) {
            console.error("Error confirming AI actions:", error);
            toast({ title: "Error", description: "Could not save all suggestions.", variant: "destructive" });
        } finally {
            setPendingAction(null);
        }
    };

    const getMember = (memberId) => familyMembers.find(m => m.id === memberId);

    if (isLoading) {
        return <div className="h-full flex items-center justify-center bg-gray-50"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
    }

    return (
        <div className="h-full flex flex-col bg-gray-50 relative">
            <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ scrollBehavior: 'smooth' }}>
                <AnimatePresence>
                    {messages.map((msg) => {
                        const sender = getMember(msg.sender_id);
                        const isCurrentUser = sender?.id === currentUserMember?.id;
                        const isAI = sender?.role === 'ai_assistant';
                        const isAiIntroduction = msg.message_type === 'ai_introduction';
                        
                        if (isAiIntroduction) {
                            return (
                                <motion.div key={msg.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex justify-center my-6">
                                    <div className="bg-gradient-to-r from-green-100 to-emerald-100 border-2 border-green-300 rounded-xl px-6 py-4 max-w-md text-center shadow-lg">
                                        <div className="flex items-center justify-center gap-2 mb-2">
                                            <Bot className="w-5 h-5 text-green-600" />
                                            <span className="font-semibold text-green-800">AI Assistent</span>
                                        </div>
                                        <p className="text-sm text-green-700">{msg.content}</p>
                                        <p className="text-xs text-green-600 mt-2">{new Date(msg.created_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                    </div>
                                </motion.div>
                            );
                        }
                        
                        return (
                            <motion.div key={msg.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                                <div className={`flex items-end gap-3 ${isCurrentUser ? 'justify-end' : ''}`}>
                                    {!isCurrentUser && sender && (
                                        <div 
                                            className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-xs shrink-0 ${isAI ? 'bg-gradient-to-r from-green-500 to-emerald-500' : ''}`}
                                            style={{backgroundColor: isAI ? undefined : (sender.color || '#6b7280')}}
                                        >
                                            {isAI ? <Bot className="w-4 h-4" /> : sender.name.charAt(0)}
                                        </div>
                                    )}
                                    <div
                                        className={`max-w-[80%] px-4 py-2 rounded-2xl ${
                                            isCurrentUser 
                                                ? 'bg-blue-500 text-white rounded-br-md' 
                                                : isAI 
                                                    ? 'bg-gradient-to-r from-green-50 to-emerald-50 text-gray-800 rounded-bl-md shadow-sm border border-green-200'
                                                    : 'bg-white text-gray-800 rounded-bl-md shadow-sm border'
                                        }`}
                                    >
                                        {!isCurrentUser && sender && (
                                            <p className={`font-semibold text-xs mb-1 ${isAI ? 'text-green-600' : ''}`} style={{color: isAI ? undefined : (sender.color || '#6b7280')}}>
                                                {sender.name}
                                            </p>
                                        )}
                                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                        <p className={`text-xs mt-1 ${isCurrentUser ? 'text-blue-100' : 'text-gray-500'}`}>{new Date(msg.created_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                    </div>
                                </div>
                                
                                {pendingAction && msg.id === pendingAction.messageId && (
                                    <div className={`mt-2 ${isCurrentUser ? 'ml-auto' : 'ml-11'}`}>
                                        {pendingAction.tasks.length > 0 && (
                                            <InlineTaskReview tasks={pendingAction.tasks} familyMembers={familyMembers} onConfirm={(confirmed) => handleConfirmActions(confirmed, [])} />
                                        )}
                                        {pendingAction.events.length > 0 && (
                                            <VacationEventsReview events={pendingAction.events} onConfirm={(confirmed) => handleConfirmActions([], confirmed)} />
                                        )}
                                    </div>
                                )}
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
                
                {isAiProcessing && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-end gap-3"
                    >
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
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }}} 
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
