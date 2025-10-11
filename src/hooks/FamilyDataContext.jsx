import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { User, Family, FamilyMember, ScheduleEvent, Task } from "@/api/entities";

const FamilyDataContext = createContext(null);

export function FamilyDataProvider({ children }) {
  const [user, setUser] = useState(null);
  const [family, setFamily] = useState(null);
  const [members, setMembers] = useState([]);
  const [events, setEvents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

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
    // Assume window.famlyWS is the shared WebSocket instance from Layout.jsx
    const ws = window.famlyWS;
    if (!ws) return;
    const handler = (event) => {
      if (typeof event.data !== "string" || event.data[0] !== "{") return;
      try {
        const { type } = JSON.parse(event.data);
        if ([
          "family_member_created","family_member_updated","family_member_deleted",
          "schedule_event_created","schedule_event_updated","schedule_event_deleted",
          "task_created","task_updated","task_deleted",
          "wishlist_item_created","wishlist_item_updated","wishlist_item_deleted"
        ].includes(type)) {
          loadData();
        }
      } catch {}
    };
    ws.addEventListener("message", handler);
    return () => ws.removeEventListener("message", handler);
  }, [loadData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <FamilyDataContext.Provider value={{ user, family, members, events, tasks, isLoading, error, reload: loadData }}>
      {children}
    </FamilyDataContext.Provider>
  );
}

export function useFamilyData() {
  const ctx = useContext(FamilyDataContext);
  if (!ctx) throw new Error("useFamilyData must be used within a FamilyDataProvider");
  return ctx;
}
