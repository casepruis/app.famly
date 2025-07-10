

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { SidebarProvider, Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarTrigger } from "@/components/ui/sidebar";
import { Home, Calendar, CheckSquare, Users, Settings, LogOut, User as UserIcon, HardDrive, Plus, Rocket, Gift, ChevronDown, ChevronRight, MessageSquare, Zap, Bot, List } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { LanguageProvider, useLanguage } from "@/components/common/LanguageProvider";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { getLanguageInfo } from "@/components/common/translations";
import { User, FamilyMember, Family, Conversation, ChatMessage } from "@/api/entities"; // Added ChatMessage
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";


// Hardcoded list of platform administrators
const PLATFORM_ADMINS = ["kees.pruis@gmail.com"];

function LanguageSelector() {
  const { currentLanguage, updateUserLanguage } = useLanguage();
  const languages = ['en', 'es', 'fr', 'de', 'nl', 'it', 'pt'];
  return (
    <Select value={currentLanguage} onValueChange={updateUserLanguage}>
      <SelectTrigger id="language-selector" className="w-24 h-7 text-xs border-none bg-transparent">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {languages.map(lang => {
          const info = getLanguageInfo(lang);
          return (
            <SelectItem key={lang} value={lang}>
              <span className="flex items-center gap-2">
                <span>{info.flag}</span>
                <span>{info.name}</span>
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

function UserAvatar({ user, family }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const handleSignOut = async () => {
    try {
      await User.logout();
      navigate(createPageUrl('Index'));
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };
  const getInitials = () => {
    if (user?.full_name) {
      return user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return 'U';
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="w-8 h-8 rounded-full p-0 bg-gradient-to-r from-slate-400 to-slate-500 text-white hover:from-slate-500 hover:to-slate-600">
          <span className="font-medium text-xs">{getInitials()}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="flex items-center gap-3 p-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-slate-400 to-slate-500 flex items-center justify-center text-white font-medium text-xs">
            {getInitials()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{user?.full_name || 'User'}</p>
            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            {family && (
              <p className="text-xs text-gray-400 truncate">{family.name}</p>
            )}
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} className="text-gray-600 focus:text-gray-800">
          <LogOut className="w-4 h-4 mr-2" />
          {t('signOut') || 'Sign Out'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}


function LayoutContent({ children, currentPageName }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { toast } = useToast();
  
  const [currentUser, setCurrentUser] = useState(null);
  const [family, setFamily] = useState(null);
  // Add state for the current user's FamilyMember object
  const [currentFamilyMember, setCurrentFamilyMember] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isChatExpanded, setIsChatExpanded] = useState(true);
  const [notificationCounts, setNotificationCounts] = useState({});
  const lastMessageIdsRef = useRef({}); // Ref to track last message IDs for all convos
  const pollingIntervalRef = useRef(null); // Ref to hold the interval ID

  // Function to handle showing notifications
  const showNotification = useCallback((conversationId, conversationName, senderName, messageContent) => {
      const urlParams = new URLSearchParams(window.location.search);
      const activeChatId = urlParams.get('id');
      const currentPath = window.location.pathname.split('/').pop();

      // Suppress notifications if user is already viewing the specific chat
      if (currentPath === 'Chat' && activeChatId === conversationId) {
          console.log(`🚫 Notification for ${conversationName} suppressed: user is viewing this chat.`);
          return;
      }

      console.log(`✅ Displaying notification for a message in ${conversationName}.`);

      // Update UI badge count
      setNotificationCounts(prev => ({
          ...prev,
          [conversationId]: (prev[conversationId] || 0) + 1,
      }));
      
      // Show browser notification
      if ('Notification' in window && Notification.permission === 'granted') {
          const notification = new Notification(`${senderName} in ${conversationName}`, {
              body: messageContent.substring(0, 100),
              icon: 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/52181febd_Screenshot_20250703_092323_Chrome.jpg',
              tag: conversationId,
          });
          notification.onclick = () => {
              navigate(createPageUrl('Chat') + `?id=${conversationId}`);
              window.focus();
          };
      }
      
      // Show in-app toast notification
      toast({
          title: `${senderName} in ${conversationName}`,
          description: messageContent.substring(0, 50) + (messageContent.length > 50 ? '...' : ''),
          duration: 5000,
      });
  }, [navigate, toast]); // Added navigate and toast to dependencies for useCallback

  useEffect(() => {
    // Request notification permission on app load
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // This useEffect handles clearing notification counts when a chat is opened
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const activeChatId = urlParams.get('id');
    const currentPath = location.pathname.split('/').pop();
    
    if (currentPath === 'Chat' && activeChatId) {
        setNotificationCounts(prev => ({...prev, [activeChatId]: 0}));
    }
  }, [location.pathname, location.search]);

  // Main data loading effect
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const user = await User.me();
      setCurrentUser(user);

      if (user?.family_id) {
        const [familyData, convosData] = await Promise.all([
          Family.get(user.family_id).catch(() => null),
          Conversation.filter({ family_id: user.family_id }, '-last_message_timestamp').catch(() => []),
        ]);
        setFamily(familyData);
        setConversations(convosData);

        // Fetch the current user's FamilyMember record within the context of their family
        // This assumes FamilyMember has a user_id property that links to User.id
        const memberForCurrentUser = await FamilyMember.filter({ user_id: user.id, family_id: user.family_id }, null, 1);
        setCurrentFamilyMember(memberForCurrentUser[0] || null);


        // Initialize last message IDs for polling
        if (convosData.length > 0) {
            const latestMessages = await Promise.all(
                convosData.map(c => ChatMessage.filter({ conversation_id: c.id }, '-created_date', 1))
            );
            const initialIds = {};
            latestMessages.forEach((msgArray, index) => {
                if (msgArray && msgArray.length > 0) {
                    initialIds[convosData[index].id] = msgArray[0].id;
                }
            });
            lastMessageIdsRef.current = initialIds;
            console.log("📊 Initial last message IDs set:", lastMessageIdsRef.current);
        }
      }
    } catch (error) {
      console.error("Layout data loading error:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Start polling when component is ready and has conversations
  useEffect(() => {
    // Only poll if not loading, user exists, and there are conversations
    if (isLoading || !currentUser || conversations.length === 0) {
      // Clear interval if conditions are not met to prevent unnecessary polling
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
        console.log("🧹 Polling paused due to missing data or loading state.");
      }
      return;
    }

    const poll = async () => {
      console.log("🔄 Polling for new messages...");
      
      try {
        // Fetch members only once and cache them for this polling cycle
        const members = await FamilyMember.filter({ family_id: currentUser.family_id });
        // Find the current user's member record to properly check if they sent the message
        const currentUserMember = members.find(m => m.user_id === currentUser.id);

        for (const convo of conversations) {
          try {
            const latestMsgArr = await ChatMessage.filter({ conversation_id: convo.id }, '-created_date', 1);
            if (latestMsgArr && latestMsgArr.length > 0) {
              const latestMsg = latestMsgArr[0];
              const lastKnownId = lastMessageIdsRef.current[convo.id];

              if (latestMsg.id !== lastKnownId) {
                console.log(`🆕 New message found in "${convo.name}"! Dispatching event.`);
                
                // Dispatch a global event that the active ChatWindow can listen to
                window.dispatchEvent(new CustomEvent('famly-new-chat-message', { detail: { message: latestMsg } }));
                
                // Handle notifications if the message is not from the current user
                if (latestMsg.sender_id !== currentUserMember?.id) { 
                    const sender = members.find(m => m.id === latestMsg.sender_id);
                    showNotification(convo.id, convo.name, sender?.name || 'Someone', latestMsg.content);
                }
                
                // Update the ref with the new latest ID
                lastMessageIdsRef.current = {
                    ...lastMessageIdsRef.current,
                    [convo.id]: latestMsg.id
                };
              }
            }
          } catch (conversationError) {
            // Skip this conversation if there's an error, continue with others
            console.error(`Error polling conversation ${convo.id}:`, conversationError);
          }
        }
      } catch (error) {
        console.error("Error during polling:", error);
        
        // If we hit a rate limit, slow down the polling
        if (error.response?.status === 429) {
          console.log("⏰ Rate limit hit, extending polling interval");
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            // Restart with longer interval
            pollingIntervalRef.current = setInterval(poll, 15000); // 15 seconds instead of 7
          }
        }
      }
    };

    // Clear any existing interval before setting a new one
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    pollingIntervalRef.current = setInterval(poll, 10000); // Start with 10 seconds instead of 7

    // Cleanup function
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        console.log("🧹 Polling stopped.");
      }
    };
  }, [isLoading, currentUser, conversations, navigate, toast, showNotification]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadData();
    }, 100);
    return () => clearTimeout(timeoutId);
  }, [loadData, location.pathname]);

  const staticNavItems = useMemo(() => [
    { title: t('dashboard') || 'Dashboard', url: createPageUrl("Dashboard"), icon: Home, id: 'sidebar-dashboard' },
    { title: t('schedule') || 'Schedule', url: createPageUrl("Schedule"), icon: Calendar, id: 'sidebar-schedule' },
    { title: t('events') || 'Events', url: createPageUrl("Events"), icon: List, id: 'sidebar-events' },
    { title: t('tasks') || 'Tasks', url: createPageUrl("Tasks"), icon: CheckSquare, id: 'sidebar-tasks' }
  ], [t]);

  const adminNavItems = useMemo(() => {
    const items = [];
    if (currentUser?.role === 'admin') {
      items.push({ title: t('admin') || 'Admin', url: createPageUrl("Admin"), icon: Settings });
    }
    // Explicitly check for the platform admin email
    if (currentUser && PLATFORM_ADMINS.includes(currentUser.email)) {
      items.push({ title: 'Platform Admin', url: createPageUrl("PlatformAdmin"), icon: HardDrive });
    }
    return items;
  }, [currentUser, t]);

  const handleActionClick = (action) => {
    window.dispatchEvent(new CustomEvent('actionTriggered', { detail: { action } }));
  };
  
  const handleNewChat = () => {
    navigate(createPageUrl('FamilyMembers'));
  };

  const showHeaderActions = useMemo(() => {
    return ['Dashboard', 'Schedule', 'Tasks', 'FamilyMembers', 'Admin', 'PlatformAdmin', 'Connectors', 'Events'].includes(currentPageName);
  }, [currentPageName]);

  const showAddAction = useMemo(() => {
    return ['Schedule', 'Tasks', 'Events'].includes(currentPageName);
  }, [currentPageName]);

  const activeConversationId = new URLSearchParams(location.search).get('id');

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Loading...</div>
      </div>
    );
  }

  // Special layout for the Chat page to be full-screen
  if (currentPageName === 'Chat') {
    return (
      <div className="h-screen w-screen flex bg-white">
        {children}
      </div>
    );
  }

  // Special layout for Debug page to be simple
  if (currentPageName === 'Debug') {
    return (
      <div className="bg-gray-100">
        {children}
      </div>
    );
  }

  return (
    <SidebarProvider>
      <style>
        {`
          :root {
            --famly-primary: #3b82f6;
            --famly-secondary: #10b981;
            --famly-accent: #e5e7eb;
            --famly-bg: #f9fafb;
            --famly-text-primary: #111827;
            --famly-text-secondary: #6b7280;
          }
        `}
      </style>
      <div className="min-h-screen flex w-full" style={{backgroundColor: 'var(--famly-bg)'}}>
        {currentUser && (
          <Sidebar className="border-r bg-white" style={{borderColor: 'var(--famly-accent)'}}>
            <SidebarHeader className="p-4 border-b" style={{borderColor: 'var(--famly-accent)'}}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center shadow-lg transform rotate-3 p-2">
                  <img 
                    src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/52181febd_Screenshot_20250703_092323_Chrome.jpg" 
                    alt="famly.ai Logo" 
                    className="w-full h-full object-contain" 
                  />
                </div>
                <div>
                  <h1 className="text-lg font-bold bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
                    famly.ai
                  </h1>
                  <p className="text-xs text-gray-500 font-medium">{t('tagline')}</p>
                </div>
              </div>
            </SidebarHeader>
            
            <SidebarContent className="px-2 py-3">
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild className={`transition-all duration-200 rounded-lg p-2 mb-1 bg-gradient-to-r from-blue-500 to-green-500 text-white hover:opacity-90 shadow`}>
                      <Link to={createPageUrl('AIAssistant')} className="flex items-center gap-3" id="sidebar-ai-assistant">
                        <Bot className="w-4 h-4" />
                        <span className="text-sm font-semibold">{t('aiAssistant') || 'AI assistant'}</span>
                      </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                <hr className="my-3"/>

                {staticNavItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild className={`transition-all duration-200 rounded-lg p-2 mb-1 ${location.pathname.startsWith(item.url) && !location.pathname.startsWith(createPageUrl('Chat')) ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}>
                      <Link to={item.url} className="flex items-center gap-3" id={item.id}>
                        <item.icon className="w-4 h-4" />
                        <span className="text-sm">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
                
                {conversations.length > 0 && (
                  <>
                    <hr className="my-3"/>
                    <SidebarMenuItem className="px-2 py-1">
                      <div className="flex items-center justify-between w-full p-2 text-sm font-medium">
                        <button 
                          onClick={() => setIsChatExpanded(!isChatExpanded)} 
                          className="flex items-center gap-3 text-gray-600 hover:text-gray-900"
                        >
                          <MessageSquare className="w-4 h-4" />
                          <span>{t('chats') || 'Chats'}</span>
                          {isChatExpanded ? <ChevronDown className="w-4 h-4 ml-1" /> : <ChevronRight className="w-4 h-4 ml-1" />}
                        </button>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleNewChat}>
                          <Plus className="w-4 h-4 text-gray-500" />
                        </Button>
                      </div>
                    </SidebarMenuItem>
                    {isChatExpanded && (
                      <div className="ml-2 pr-2">
                        {conversations.map((convo) => (
                          <SidebarMenuItem key={convo.id}>
                            <SidebarMenuButton asChild className={`w-full transition-all duration-200 rounded-lg p-2 mb-1 justify-between ${activeConversationId === convo.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}>
                              <Link to={createPageUrl('Chat') + `?id=${convo.id}`} className="flex items-center gap-3 w-full">
                                <span className="w-2 h-2 rounded-full bg-gray-400" />
                                <span className="text-sm truncate flex-1">{convo.name}</span>
                                {notificationCounts[convo.id] > 0 && (
                                    <Badge className="h-5 px-2 bg-blue-500 text-white flex items-center justify-center">{notificationCounts[convo.id]}</Badge>
                                )}
                              </Link>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        ))}
                      </div>
                    )}
                  </>
                )}

                <hr className="my-3"/>
                
                <SidebarMenuItem>
                  <SidebarMenuButton asChild className={`transition-all duration-200 rounded-lg p-2 mb-1 ${location.pathname === createPageUrl('FamilyMembers') ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}>
                    <Link to={createPageUrl('FamilyMembers')} className="flex items-center gap-3" id="sidebar-members">
                      <Users className="w-4 h-4" />
                      <span className="text-sm">{t('manageMembers') || 'Manage members'}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                <SidebarMenuItem>
                  <SidebarMenuButton asChild className={`transition-all duration-200 rounded-lg p-2 mb-1 ${location.pathname === createPageUrl('Connectors') ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}>
                    <Link to={createPageUrl('Connectors')} className="flex items-center gap-3" id="sidebar-connectors">
                      <Zap className="w-4 h-4" />
                      <span className="text-sm">{t('connectors') || 'Connectors'}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                
                {adminNavItems.length > 0 && <hr className="my-3" />}
                {adminNavItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild className={`transition-all duration-200 rounded-lg p-2 mb-1 ${location.pathname === item.url ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}>
                      <Link to={item.url} className="flex items-center gap-3">
                        <item.icon className="w-4 h-4" />
                        <span className="text-sm">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarContent>

            <SidebarFooter className="p-3 border-t" style={{borderColor: 'var(--famly-accent)'}}>
              <div className="flex items-center justify-between">
                <UserAvatar user={currentUser} family={family} />
                <LanguageSelector />
              </div>
            </SidebarFooter>
          </Sidebar>
        )}

        <main className="flex-1 flex flex-col h-screen">
          {currentUser && showHeaderActions && (
            <header className="flex-shrink-0 flex items-center justify-between p-4 bg-white border-b" style={{borderColor: 'var(--famly-accent)'}}>
              <div className="flex items-center gap-4">
                <SidebarTrigger className="lg:hidden" />
                <h1 className="text-xl font-bold text-gray-900 capitalize">
                  {t(currentPageName?.charAt(0).toLowerCase() + currentPageName?.slice(1)) || currentPageName}
                </h1>
              </div>
              
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => handleActionClick('tour')} className="text-gray-500 hover:text-gray-700" title={t('tour')}>
                  <Rocket className="w-4 h-4" />
                </Button>
                {showAddAction && (
                  <Button variant="ghost" size="icon" onClick={() => handleActionClick('new')} className="text-gray-500 hover:text-gray-700" title={t('add')}>
                    <Plus className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </header>
          )}

          <div className="flex-1 overflow-y-auto">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}

export default function Layout({ children, currentPageName }) {
  return (
    <LanguageProvider>
      <LayoutContent children={children} currentPageName={currentPageName} />
    </LanguageProvider>
  );
}

