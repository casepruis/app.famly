
import React, { useState, useEffect } from 'react';
import { Conversation, User, ChatMessage } from '@/api/entities';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useLanguage } from '@/components/common/LanguageProvider';
import { Button } from "@/components/ui/button";
import { Settings, Bell, ArrowLeft, MoreVertical, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import ChatWindow from '../components/chat/ChatWindow';

export default function ChatPage() {
    const [activeConversation, setActiveConversation] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [chatVersion, setChatVersion] = useState(0); // To force re-render
    
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { t } = useLanguage();
    const { toast } = useToast();

    const activeConversationId = searchParams.get('id');

    useEffect(() => {
        const loadInitialData = async () => {
            setIsLoading(true);
            try {
                const currentUser = await User.me();
                if (!currentUser) {
                    navigate(createPageUrl('Index'));
                    return;
                }

                if (activeConversationId) {
                    const convo = await Conversation.get(activeConversationId);
                    
                    if (convo && convo.family_id === currentUser.family_id) {
                        setActiveConversation(convo);
                    } else {
                        toast({ title: "Error", description: "You do not have access to this conversation.", variant: "destructive", duration: 5000  });
                        navigate(createPageUrl('Dashboard'));
                    }
                }
            } catch (error) {
                console.error("Failed to load chat data", error);
                toast({ title: "Chat not found", description: "This conversation may have been deleted.", variant: "destructive", duration: 5000  });
                navigate(createPageUrl('Dashboard'));
            } finally {
                setIsLoading(false);
            }
        };

        loadInitialData();
        // Reset version on conversation change
        setChatVersion(0);
    }, [activeConversationId, navigate, toast]);
    
    const handleComingSoon = (feature) => {
        toast({
            title: `${feature} ${t('comingSoon') || 'Coming Soon'}`,
            description: t('featureInDevelopment') || 'This feature is currently in development.',
            duration: 5000 
        });
    };
    
    const handleClearChat = async () => {
        if (!activeConversationId) return;
        
        const isConfirmed = window.confirm(
            t('confirmClearChat') || 'Are you sure you want to delete all messages in this chat? This action cannot be undone.'
        );

        if (isConfirmed) {
            try {
                await ChatMessage.delete(activeConversationId);
                // const messagesToDelete = await ChatMessage.filter({ conversation_id: activeConversationId });
                // // Filter only messages from the current user (security/privacy consideration, adjust if needed)
                // // For a full chat clear, simply delete all messages associated with the conversation_id
                
                // // Fetch all messages for the active conversation
                // const allConversationMessages = await ChatMessage.filter({ conversation_id: activeConversationId });

                // // Delete each message
                // for (const message of allConversationMessages) {
                //     await ChatMessage.delete(message.id);
                // }
                toast({ title: t('chatCleared') || 'Chat Cleared', description: t('allMessagesDeleted') || 'All messages have been deleted.' });
                setChatVersion(v => v + 1); // Force re-render of ChatWindow
            } catch (error) {
                console.error("Failed to clear chat:", error);
                toast({ title: t('error') || 'Error', description: t('couldNotClearChat') || 'Could not clear chat messages.', variant: "destructive", duration: 5000  });
            }
        }
    };

    if (isLoading) {
        return (
            <div className="h-screen flex items-center justify-center bg-white">
                <div className="text-gray-500">{t('loading') || 'Loading'}...</div>
            </div>
        );
    }

    if (!activeConversation) {
        return (
            <div className="h-screen flex items-center justify-center bg-white">
                <div className="text-center text-gray-500">
                    <p className="text-lg font-medium">{t('noConversationSelected') || 'No conversation selected.'}</p>
                    <p className="text-sm">{t('selectConversationFromSidebar') || 'Select a conversation from the sidebar to start chatting.'}</p>
                    <Link to={createPageUrl('Dashboard')}>
                        <Button className="mt-4">
                            {t('goToDashboard') || 'Go to Dashboard'}
                        </Button>
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen flex bg-white w-full">
            {/* Chat Interface */}
            <div className="flex-1 flex flex-col">
                {/* Chat Header */}
                <header className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Link
                                to={createPageUrl('Dashboard')}
                                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                                title={t('backToDashboard') || 'Back to Dashboard'}
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </Link>
                            <div>
                                <h1 className="text-lg font-semibold text-gray-900">
                                    {activeConversation.name || 'Chat'}
                                </h1>
                                <p className="text-xs text-gray-500">
                                    {t('activeNow') || 'Active now'}
                                </p>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-1">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="text-gray-500 hover:text-gray-700 h-8 w-8">
                                        <MoreVertical className="w-5 h-5" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleComingSoon('Notifications')}>
                                        <Bell className="w-4 h-4 mr-2" />
                                        {t('notificationSettings') || 'Notification Settings'}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleComingSoon('Settings')}>
                                        <Settings className="w-4 h-4 mr-2" />
                                        {t('chatSettings') || 'Chat Settings'}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={handleClearChat} className="text-red-600 focus:text-red-700">
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        {t('clearChat') || 'Clear Chat'}
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                </header>

                {/* Chat Messages */}
                <div className="flex-1 min-h-0">
                    <ChatWindow
                        key={chatVersion}
                        conversationId={activeConversationId}
                        participants={activeConversation?.participants || []}
                        />
                </div>
            </div>
        </div>
    );
}
