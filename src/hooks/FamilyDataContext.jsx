import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { User, Family, FamilyMember, ScheduleEvent, Task } from '@/api/entities';
import { toast } from "@/components/ui/use-toast";

const FamilyDataContext = createContext(null);

export function FamilyDataProvider({ children }) {
  const [user, setUser] = useState(null);
  const [family, setFamily] = useState(null);
  const [members, setMembers] = useState([]);
  const [events, setEvents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [planningInsights, setPlanningInsights] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tokenChecked, setTokenChecked] = useState(false);

  // Wait for token to exist before loading data
  useEffect(() => {
    const token = localStorage.getItem('famlyai_token');
    if (token) setTokenChecked(true);
    else {
      setIsLoading(false);
      setTokenChecked(false);
    }
  }, [localStorage.getItem('famlyai_token')]);

  // AI agent analysis is now handled by eventCreationService
  // No duplicate calls from context

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const currentUser = await User.me();
      console.log('[FamilyDataContext] Loaded user:', currentUser);
      setUser(currentUser);
      if (!currentUser?.family_id) {
        setFamily(null);
        setMembers([]);
        setEvents([]);
        setTasks([]);
        setPlanningInsights([]);
        setIsLoading(false);
        return;
      }
      const familyId = currentUser.family_id;
      const [familyData, membersData, eventsData, tasksData] = await Promise.all([
        Family.get(familyId).catch(() => null),
        FamilyMember.filter({ family_id: familyId }, "-created_date").catch(() => []),
        ScheduleEvent.filter({ family_id: familyId }, "-start_time", 1000).catch(() => []),
        Task.filter({ family_id: familyId }, "due_date", 1000).catch(() => []),
      ]);
      console.log('[FamilyDataContext] 🔍 [API-BATCH] Loaded all family data in batch');
      console.log('[FamilyDataContext] Loaded family:', familyData);
      console.log('[FamilyDataContext] Loaded members:', membersData);
      setFamily(familyData);
      setMembers(membersData);
      setEvents(eventsData);
      setTasks(tasksData);
    } catch (err) {
      setError(err);
      console.error('[FamilyDataContext] Error loading data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // WebSocket integration: listen for relevant events and reload data
  useEffect(() => {
    const token = localStorage.getItem("famlyai_token");
    if (!token) return;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const WS_BASE = (import.meta)?.env?.VITE_WS_BASE || `${protocol}//${host}`;
    const ws = new window.WebSocket(`${WS_BASE}/ws?token=${encodeURIComponent(token)}`);
    let closed = false;
    const handler = (event) => {
      if (typeof event.data !== "string" || event.data[0] !== "{") return;
      try {
        const { type, payload } = JSON.parse(event.data);
        // --- Events ---
        if (["schedule_event_created", "schedule_event_updated", "schedule_event_deleted"].includes(type)) {
          console.log('🔍 [WS] Schedule event update:', type, payload?.id);
          setEvents(prevEvents => {
            if (type === "schedule_event_created") {
              const exists = prevEvents.some(ev => ev.id === payload.id);
              if (exists) {
                return prevEvents;
              }
              // Just add the event - NO duplicate AI call here
              // The eventCreationService already handles AI analysis
              return [...prevEvents, payload];
            }
            if (type === "schedule_event_updated") {
              return prevEvents.map(ev => ev.id === payload.id ? { ...ev, ...payload } : ev);
            }
            if (type === "schedule_event_deleted") {
              const next = prevEvents.filter(ev => ev.id !== payload.id);
              console.log('[WS] schedule_event_deleted:', payload, 'Events after delete:', next);
              return next;
            }
            return prevEvents;
          });
        }
        // --- Tasks ---
        if (["task_created", "task_updated", "task_deleted"].includes(type)) {
          console.log('🔍 [WS] Task update:', type, payload?.id);
          setTasks(prevTasks => {
            if (type === "task_created") {
              if (prevTasks.some(t => t.id === payload.id)) return prevTasks;
              return [...prevTasks, payload];
            }
            if (type === "task_updated") {
              return prevTasks.map(t => t.id === payload.id ? { ...t, ...payload } : t);
            }
            if (type === "task_deleted") {
              return prevTasks.filter(t => t.id !== payload.id);
            }
            return prevTasks;
          });
        }
        // --- Wishlist Items ---
        if (["wishlist_item_created", "wishlist_item_updated", "wishlist_item_deleted"].includes(type)) {
          setFamily(fam => fam); // No-op if not in state, but could trigger a reload if needed
          // If you have a wishlistItems state, update it here similarly
        }
        // --- Family Members ---
        if (["family_member_created", "family_member_updated", "family_member_deleted"].includes(type)) {
          setMembers(prevMembers => {
            if (type === "family_member_created") {
              if (prevMembers.some(m => m.id === payload.id)) return prevMembers;
              return [...prevMembers, payload];
            }
            if (type === "family_member_updated") {
              return prevMembers.map(m => m.id === payload.id ? { ...m, ...payload } : m);
            }
            if (type === "family_member_deleted") {
              return prevMembers.filter(m => m.id !== payload.id);
            }
            return prevMembers;
          });
        }
        // --- Planning Agent Insights ---
        if (type === "agent_insight_created") {
          console.log('[WS] agent_insight_created received:', payload);
          const { insights = [], insight_count = 0, summary = '' } = payload;
          
          // Update insights state
          setPlanningInsights(prev => {
            const newInsights = insights.filter(insight => !prev.some(p => p.id === insight.id));
            return [...prev, ...newInsights];
          });
          
          // Show notification
          if (insight_count > 0) {
            toast({
              title: `🤖 Planning Agent Insights`,
              description: `Found ${insight_count} new insights. Check the Agent page for details.`,
              duration: 8000,
            });
          }
        }
        // REMOVED: loadData() call - WebSocket handlers already update state directly
        // Only reload for family member changes (structure changes need full reload)
        if (["family_member_created","family_member_updated","family_member_deleted"].includes(type)) {
          loadData();
        }
      } catch {}
    };
    ws.addEventListener("message", handler);
    ws.onopen = () => { console.log('[WS][DEBUG] FamilyDataContext WebSocket connected'); };
    ws.onerror = (e) => { console.warn('[WS][DEBUG] FamilyDataContext WebSocket error', e); };
    ws.onclose = () => { 
      if (!closed) { 
        console.warn('[WS][DEBUG] FamilyDataContext WebSocket closed, will attempt reconnection on next data load');
        // Don't auto-reload page - let it reconnect naturally on next user interaction
      } 
    };
    return () => { closed = true; ws.removeEventListener("message", handler); try { ws.close(); } catch {} };
  }, [loadData]);


  useEffect(() => {
    if (tokenChecked) loadData();
  }, [tokenChecked, loadData]);

  return (
    <FamilyDataContext.Provider value={{ user, family, members, events, tasks, planningInsights, isLoading, error, reload: loadData }}>
      {children}
    </FamilyDataContext.Provider>
  );
}

export function useFamilyData() {
  const ctx = useContext(FamilyDataContext);
  if (!ctx) throw new Error("useFamilyData must be used within a FamilyDataProvider");
  return ctx;
}
