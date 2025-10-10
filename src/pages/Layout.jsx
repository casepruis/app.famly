import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger
} from "@/components/ui/sidebar";
import {
  Home,
  Calendar,
  CheckSquare,
  Users,
  Settings,
  LogOut,
  User as UserIcon,
  HardDrive,
  Plus,
  Rocket,
  Gift,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Zap,
  Bot,
  List,
  Bell
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { LanguageProvider, useLanguage } from "@/components/common/LanguageProvider";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { getLanguageInfo } from "@/components/common/translations";
import { User, FamilyMember, Family, Conversation, ChatMessage, Push } from "@/api/entities";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";

import logo from '@/assets/famly_kama_icon.svg';

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
  const [currentFamilyMember, setCurrentFamilyMember] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isChatExpanded, setIsChatExpanded] = useState(true);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [notificationCounts, setNotificationCounts] = useState({});
  const lastMessageIdsRef = useRef({});

  // WS infra
  const wsRef = useRef(null);
  const pingRef = useRef(null);
  const retryRef = useRef(0);

  // Volatile refs for WS effect
  const conversationsRef = useRef([]);
  const meRef = useRef(null);
  const notifyRef = useRef(null);

  // ensure we have a push subscription saved on the backend when permission is already granted
  const ensurePushSubscription = useCallback(async (userId) => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    const reg = await navigator.serviceWorker.ready;

    // do we already have a browser subscription?
    let sub = await reg.pushManager.getSubscription();

    // get VAPID key from backend
    const { publicKey } = await Push.getVapidPublicKey();

    // create a new subscription if missing (no prompt; permission is already granted)
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }

    // upsert on backend
    await Push.subscribe({
      user_id: userId,
      subscription: sub.toJSON(),
    });

    console.log('✅ Push subscription synced');
  }, []);


  // --- Web Push helpers ---
  function urlBase64ToUint8Array(base64String) {
    const pad = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + pad).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
  }

  const [pushSupported, setPushSupported] = useState(false);
  const [notifPermission, setNotifPermission] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );

  useEffect(() => {
    const supported = ('serviceWorker' in navigator) && ('PushManager' in window);
    setPushSupported(supported);
  }, []);

  const enablePush = useCallback(async (userId) => {
    try {
      if (!pushSupported) {
        alert('Push not supported on this browser.');
        return;
      }
      // permission must be from a user gesture (this click)
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        setNotifPermission(perm);
        alert('Notifications are blocked.');
        return;
      }

      // get public key from backend
      const { publicKey } = await Push.getVapidPublicKey();

      // subscribe via the service worker
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      // send to backend
      await Push.subscribe({
        user_id: userId,
        subscription: sub.toJSON(),
      });

      setNotifPermission('granted');
  toast({ title: 'Notifications enabled', description: 'You will receive alerts for new messages.', duration: 5000 });
    } catch (err) {
      console.error('Enable push failed:', err);
  toast({ title: 'Could not enable notifications', description: String(err?.message || err), variant: 'destructive', duration: 5000 });
    }
  }, [pushSupported, toast]);

  // Function to handle showing notifications
  const showNotification = useCallback((conversationId, conversationName, senderName, messageContent) => {
    const urlParams = new URLSearchParams(window.location.search);
    const activeChatId = urlParams.get('id');
    const currentPath = window.location.pathname.split('/').pop();

    // Suppress if user is already viewing this chat
    if (currentPath === 'Chat' && activeChatId === conversationId) {
      console.log(`🚫 Notification for ${conversationName} suppressed: user is viewing this chat.`);
      return;
    }

    console.log(`✅ Displaying notification for a message in ${conversationName}.`);

    // Update UI badge count immediately
    setNotificationCounts(prev => ({
      ...prev,
      [conversationId]: (prev[conversationId] || 0) + 1,
    }));

    // Prefer SW registration for foreground notifications when available
    (async () => {
      try {
        if ('Notification' in window && Notification.permission === 'granted') {
          const reg = await navigator.serviceWorker?.ready;
          if (reg?.showNotification) {
            await reg.showNotification(`${senderName} in ${conversationName}`, {
              body: messageContent.substring(0, 100),
              icon: '/icons/icon-192.png',
              badge: '/icons/badge-72.png',
              tag: conversationId,
              data: { url: createPageUrl('Chat') + `?id=${conversationId}` },
            });
          } else {
            const n = new Notification(`${senderName} in ${conversationName}`, {
              body: messageContent.substring(0, 100),
              icon: '/icons/icon-192.png',
              tag: conversationId,
            });
            setTimeout(() => { try { n?.close?.(); } catch {} }, 5000);
          }
        }
      } catch (e) {
        console.warn('Notification display error', e);
      }
    })();

    // Auto-clear sidebar badge after 5s unless user opened the chat
    setTimeout(() => {
      const nowParams = new URLSearchParams(window.location.search);
      const nowActive = nowParams.get('id');
      const nowPath = window.location.pathname.split('/').pop();
      if (!(nowPath === 'Chat' && nowActive === conversationId)) {
        setNotificationCounts(prev => ({
          ...prev,
          [conversationId]: 0
        }));
      }
    }, 5000);
  }, [navigate, toast]);
  useEffect(() => {
    if (!currentUser?.id) return;
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') return;
    // fire-and-forget; no UI prompt needed
    ensurePushSubscription(currentUser.id);
    // run once per user session
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  // register SW
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(console.error);
    }
  }, []);

  useEffect(() => { conversationsRef.current = conversations; }, [conversations]);
  useEffect(() => { meRef.current = currentFamilyMember; }, [currentFamilyMember]);
  useEffect(() => { notifyRef.current = showNotification; }, [showNotification]);

  // ask permission only if default (initial load)
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      // Don’t auto-prompt here if you prefer; keeping your original behavior:
      Notification.requestPermission().then(p => setNotifPermission(p));
    }
  }, []);

  // Clear notification counts when a chat is opened
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const activeChatId = urlParams.get('id');
    const currentPath = location.pathname.split('/').pop();
    if (currentPath === 'Chat' && activeChatId) {
      setNotificationCounts(prev => ({ ...prev, [activeChatId]: 0 }));
    }
  }, [location.pathname, location.search]);

  // Main data loading
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const authUser = await User.me();
      setCurrentUser(authUser);

      if (authUser?.family_id) {
        const [familyData, convosData] = await Promise.all([
          Family.get(authUser.family_id).catch(() => null),
          Conversation.filter({ family_id: authUser.family_id }, '-last_message_timestamp').catch(() => []),
        ]);
        console.log("🗂️ Loaded conversations:", convosData);
        setFamily(familyData);
        setConversations(convosData);

        const meAsMember = await FamilyMember.me();
        setCurrentFamilyMember(meAsMember || null);

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

  // WebSocket wiring
  useEffect(() => {
    if (!currentUser || !family || !currentFamilyMember) return;

    const token = localStorage.getItem("famlyai_token");
    if (!token) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const WS_BASE = (import.meta)?.env?.VITE_WS_BASE || `${protocol}//${host}`;

    let closed = false;

    const connect = () => {
      if (closed) return;

      const ws = new WebSocket(`${WS_BASE}/ws?token=${encodeURIComponent(token)}`);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("📡 Layout WebSocket connected");
        retryRef.current = 0;

        if (pingRef.current) clearInterval(pingRef.current);
        pingRef.current = window.setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send("ping");
        }, 30000);
      };

      ws.onmessage = async (event) => {
        if (typeof event.data !== "string" || event.data[0] !== "{") return;

        try {
          const { type, payload } = JSON.parse(event.data);

          if (type === "chat_message_created") {
            const message = payload;

            if (message.sender_id === meRef.current?.id) return;

            const convo = conversationsRef.current.find(c => c.id === message.conversation_id);
            if (!convo) return;

            let senderName = "Unknown";
            try {
              const sender = await FamilyMember.get(message.sender_id);
              senderName = sender?.name || senderName;
            } catch {}

            notifyRef.current(
              message.conversation_id,
              convo.name,
              senderName,
              message.content
            );
          }
        } catch (err) {
          console.error("WebSocket message error in Layout:", err);
        }
      };

      ws.onerror = (e) => {
        console.warn("Layout WebSocket error; readyState=", ws.readyState, e);
      };

      ws.onclose = (e) => {
        if (pingRef.current) { clearInterval(pingRef.current); pingRef.current = null; }
        if (closed) return;

        console.warn("Layout WebSocket closed:", e.code, e.reason || "(no reason)");
        const delay = Math.min(30000, 1000 * Math.pow(2, retryRef.current++));
        setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      closed = true;
      if (pingRef.current) { clearInterval(pingRef.current); pingRef.current = null; }
      try { wsRef.current?.close(); } catch {}
      wsRef.current = null;
    };
  }, [currentUser, family, currentFamilyMember]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadData();
    }, 100);
    return () => clearTimeout(timeoutId);
  }, [loadData, location.pathname]);

  useEffect(() => {
    const handleChatRead = (event) => {
      const { conversationId } = event.detail;
      setNotificationCounts(prev => ({
        ...prev,
        [conversationId]: 0
      }));
    };

    window.addEventListener('famly-chat-read', handleChatRead);
    return () => window.removeEventListener('famly-chat-read', handleChatRead);
  }, []);

  const staticNavItems = useMemo(() => [
    { title: t('dashboard') || 'Dashboard', url: createPageUrl("Dashboard"), icon: Home, id: 'sidebar-dashboard' },
    { title: t('schedule') || 'Schedule', url: createPageUrl("Schedule"), icon: Calendar, id: 'sidebar-schedule' },
    { title: t('events') || 'Events', url: createPageUrl("Events"), icon: List, id: 'sidebar-events' },
    { title: t('tasks') || 'Tasks', url: createPageUrl("Tasks"), icon: CheckSquare, id: 'sidebar-tasks' }
  ], [t]);

  const adminNavItems = useMemo(() => {
    const items = [];
    if (currentUser?.is_family_admin) {
      items.push({ title: t('admin') || 'Admin', url: createPageUrl("Admin"), icon: Settings });
    }
    if (currentUser?.is_platform_admin) {
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
    return ['Dashboard', 'Schedule', 'Tasks', 'FamilyMembers', 'Admin', 'PlatformAdmin', 'Connectors', 'Events','Chat'].includes(currentPageName);
  }, [currentPageName]);

  const showAddAction = useMemo(() => {
    return ['Schedule', 'Tasks', 'Events', 'FamilyMembers'].includes(currentPageName);
  }, [currentPageName]);

  const activeConversationId = new URLSearchParams(location.search).get('id');

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Loading...</div>
      </div>
    );
  }

  if (currentPageName === 'Debug') {
    return (
      <div className="bg-gray-100">
        {children}
      </div>
    );
  }

  console.log("🧪 Header visibility check", {
    currentUser,
    showHeaderActions,
    currentPageName,
  });

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
        {isSidebarVisible && currentUser && (
          <Sidebar className="border-r bg-white" style={{borderColor: 'var(--famly-accent)'}}>
            <SidebarHeader className="p-4 border-b" style={{borderColor: 'var(--famly-accent)'}}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center shadow-lg transform rotate-3 p-2">
                  <img 
                    src={logo}
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
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsSidebarVisible(prev => !prev)}
                  className="text-gray-500 hover:text-gray-700"
                  title={isSidebarVisible ? 'Hide sidebar' : 'Show sidebar'}
                >
                  {isSidebarVisible ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </Button>

                <h1 className="text-xl font-bold text-gray-900 capitalize">
                  {t(currentPageName?.charAt(0).toLowerCase() + currentPageName?.slice(1)) || currentPageName}
                </h1>
              </div>
              
              <div className="flex items-center gap-2">
                {/* Enable notifications button (shown only when supported and not already granted) */}
                {currentUser && pushSupported && notifPermission !== 'granted' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => enablePush(currentUser.id)}
                    className="text-gray-600 hover:text-gray-900 flex items-center gap-2"
                    title="Enable notifications"
                  >
                    <Bell className="w-4 h-4" />
                    <span className="text-sm">Enable notifications</span>
                  </Button>
                )}

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
