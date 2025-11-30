// Helper to trigger a push notification via the service worker
async function triggerPushNotification({ title, body, url }) {
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      const reg = await navigator.serviceWorker?.ready;
      if (reg?.showNotification) {
        await reg.showNotification(title, {
          body,
          icon: '/icons/icon-192.png',
          badge: '/icons/badge-72.png',
          data: { url: url || '/' },
        });
      } else {
        new Notification(title, { body, icon: '/icons/icon-192.png' });
      }
    } catch (e) {
      // fallback: ignore
    }
  }
}
// src/pages/Schedule.jsx
import React, { useState, useEffect, useMemo, useRef } from "react";
// --- WebSocket for real-time event updates ---
const useEventWebSocket = (reload) => {
  const wsRef = useRef(null);
  useEffect(() => {
    if (!reload) return;
    let ws;
    try {
      const token = localStorage.getItem("famlyai_token");
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.host;
      const WS_BASE = (import.meta)?.env?.VITE_WS_BASE || `${protocol}//${host}`;
      ws = new window.WebSocket(`${WS_BASE}/ws?token=${encodeURIComponent(token)}`);
      wsRef.current = ws;
      ws.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data);
          if (data && (
            data.type === 'schedule_event_created' ||
            data.type === 'schedule_event_updated' ||
            data.type === 'schedule_event_deleted')) {
            // Data updates handled by FamilyDataContext WebSocket - no manual reload needed
            console.log('🔍 [OPTIMIZATION] Schedule WebSocket update - no manual reload needed');
          }
        } catch {}
      };
    } catch {}
    return () => { try { ws && ws.close(); } catch {} };
  }, []);
};
import { ScheduleEvent, FamilyMember, User, Task } from "@/api/entities";
import {
  addDays, addWeeks, addMonths, addYears, getHours,
  parseISO, startOfDay, endOfDay
} from "date-fns";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useFamilyData } from "@/hooks/FamilyDataContext";
import { createPageUrl } from "@/utils";
import { useLanguage } from "@/components/common/LanguageProvider";
import { Button } from "@/components/ui/button";
import { Check, Users, LayoutGrid, CalendarDays, Maximize, Minimize, Star } from "lucide-react";
import Joyride from "../components/common/Joyride";
import { useToast } from "@/components/ui/use-toast";

import WeeklyCalendar from "../components/schedule/WeeklyCalendar";
import ResourceCalendar from "../components/schedule/ResourceCalendar";
import ScheduleSidebar from "../components/schedule/ScheduleSidebar";
import EventDialog from "../components/schedule/EventDialog";
import AIReviewDialog from "../components/schedule/AIReviewDialog";
import { InvokeLLMNormalized } from "@/api/integrations"; // make sure you still have this client
import { AIAgent } from "@/api/aiAgent";
import { createEventService } from "@/services/eventCreationService";

const scheduleTourSteps = [
  { target: '#calendar-view-toggle', title: 'Calendar Views', content: 'Switch between a traditional weekly calendar and a "By Member" view to see schedules from different perspectives.'},
  { target: '#weekly-calendar', title: 'The Family Calendar', content: 'This is your weekly view. Click on any time slot to quickly add a new event for that time.' },
  { target: '#schedule-filters', title: 'Filter Your View', content: 'Focus on specific family members by selecting or deselecting them here. This helps simplify busy schedules!' },
  { target: '#schedule-sidebar', title: 'Add Events & See Today', content: "Use this area to add a new event anytime or see what's happening today at a glance." },
  { target: '#sidebar-dashboard', title: 'Navigate Anywhere', content: 'Use the main sidebar to easily jump to other parts of the app, like your tasks or family settings.' },
];

const MemberFilter = ({ familyMembers, selectedMembers, onMemberFilter }) => {
  const { t } = useLanguage();
  const realFamilyMembers = familyMembers.filter(m => m.role !== "ai_assistant");

  return (
    <div id="schedule-filters" className="bg-gray-50/70 rounded-lg border border-gray-200/60 p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-4 h-4 text-gray-400"><Users className="w-4 h-4" /></div>
        <span className="text-sm font-medium text-gray-600">{t("filterByMember")}</span>
      </div>
      <div className="flex flex-wrap gap-3">
        {realFamilyMembers.map(member => (
          <div key={member.id} className="flex items-center gap-2 cursor-pointer hover:bg-white/50 rounded-md p-2 transition-colors" onClick={() => onMemberFilter(member.id)}>
            <div
              className={`w-4 h-4 rounded flex items-center justify-center border-2 transition-all ${selectedMembers.includes(member.id) ? "border-2" : "border-gray-300"}`}
              style={{
                backgroundColor: selectedMembers.includes(member.id) ? member.color : "transparent",
                borderColor: selectedMembers.includes(member.id) ? member.color : "#d1d5db",
              }}
            >
              {selectedMembers.includes(member.id) && <Check className="w-3 h-3 text-white" />}
            </div>
            <span className="text-sm font-medium text-gray-700">{member.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const generateRecurringEvents = (baseEvent) => {
  if (!baseEvent.is_recurring) return [{ ...baseEvent, recurrence_id: null }];

  const events = [];
  const recurrenceId = crypto.randomUUID();
  const startDate = parseISO(baseEvent.start_time);
  const endDate = parseISO(baseEvent.end_time);
  const duration = endDate.getTime() - startDate.getTime();

  let limit = 1;
  switch (baseEvent.recurrence_pattern) {
    case "daily": limit = 90; break;
    case "weekly": limit = 52; break;
    case "monthly": limit = 12; break;
    case "yearly": limit = 5; break;
    default: limit = 1; break;
  }

  for (let i = 0; i < limit; i++) {
    let nextStartDate = startDate;
    switch (baseEvent.recurrence_pattern) {
      case "daily": nextStartDate = addDays(startDate, i); break;
      case "weekly": nextStartDate = addWeeks(startDate, i); break;
      case "monthly": nextStartDate = addMonths(startDate, i); break;
      case "yearly": nextStartDate = addYears(startDate, i); break;
      default: nextStartDate = startDate; break;
    }
    const nextEndDate = new Date(nextStartDate.getTime() + duration);
    events.push({
      ...baseEvent,
      start_time: nextStartDate.toISOString(),
      end_time: nextEndDate.toISOString(),
      recurrence_id: recurrenceId,
    });
  }
  return events;
};

export default function Schedule() {
  // Request tracking for debugging
  const requestTracker = useRef({
    requests: [],
    log(operation, details) {
      const timestamp = new Date().toISOString();
      this.requests.push({ timestamp, operation, details });
      console.log(`🔍 [SCHEDULE-REQUEST] ${operation}`, details);
      
      // Warn about potential duplicates in last 2 seconds
      const recent = this.requests.filter(r => 
        Date.now() - new Date(r.timestamp).getTime() < 2000 && 
        r.operation === operation
      );
      if (recent.length > 1) {
        console.warn(`⚠️ [DUPLICATE] ${operation} called ${recent.length} times in 2s`);
      }
    }
  });
  const { user, family, members: familyMembers, events, isLoading, error } = useFamilyData();
  // Removed useEventWebSocket(reload) - FamilyDataContext handles WebSocket updates
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(null);
  const [currentViewDate, setCurrentViewDate] = useState(new Date());
  const [runTour, setRunTour] = useState(false);
  const [reviewData, setReviewData] = useState(null);
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const [calendarView, setCalendarView] = useState("weekly");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [dashboardFavorite, setDashboardFavorite] = useState(null);
  const [isMembersSidebarOpen, setIsMembersSidebarOpen] = useState(false);
  const familyId = user?.family_id;
  
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const handleViewChange = async (newView) => {
    setCalendarView(newView);
    try {
      await User.updateMyUserData({ preferred_calendar_view: newView });
    } catch (error) {
      console.error("Failed to save view preference:", error);
    }
  };

  const handleDashboardFavoriteToggle = async () => {
    const newFavorite = dashboardFavorite === calendarView ? null : calendarView;
    setDashboardFavorite(newFavorite);
    try {
      await User.updateMyUserData({ dashboard_favorite_view: newFavorite });
      toast({
        title: newFavorite ? t("dashboardFavoriteSet") || "Dashboard favorite set" : t("dashboardFavoriteRemoved") || "Dashboard favorite removed",
        description: newFavorite
          ? `${calendarView === "weekly" ? t("weekly") : t("byMember")} view will be used on dashboard`
          : t("dashboardUsesGeneralPreference") || "Dashboard will use your general preference",
        duration: 5000
      });
    } catch (error) {
      console.error("Failed to save dashboard favorite:", error);
    }
  };

  useEffect(() => {
    if (user && !user.family_id) {
      navigate(createPageUrl("Index"));
      return;
    }
    if (user?.preferred_calendar_view) setCalendarView(user.preferred_calendar_view);
    if (user?.dashboard_favorite_view) setDashboardFavorite(user.dashboard_favorite_view);

    const handleAction = (event) => {
      const action = event.detail.action;
      if (action === "new") {
        setSelectedEvent(null);
        setSelectedTimeSlot(null);
        setIsEventDialogOpen(true);
      } else if (action === "tour") {
        setRunTour(true);
      }
    };

    window.addEventListener("actionTriggered", handleAction);

    const action = searchParams.get("action");
    if (action === "new") {
      setSelectedEvent(null);
      setSelectedTimeSlot(null);
      setIsEventDialogOpen(true);
      setSearchParams({});
    } else if (action === "tour") {
      setRunTour(true);
      setSearchParams({});
    }

    return () => window.removeEventListener("actionTriggered", handleAction);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, user]);



  const handleEventClick = (event) => {
    const eventDate = parseISO(event.start_time);
    setCurrentViewDate(eventDate);
    setSelectedEvent(event);
    setIsEventDialogOpen(true);
  };

  const handleTimeSlotClick = (dateTime) => {
    setCurrentViewDate(dateTime);
    setSelectedTimeSlot({ date: dateTime, hour: getHours(dateTime) });
    setSelectedEvent(null);
    setIsEventDialogOpen(true);
  };


  const handleProcessSave = async (eventData, _ignored, editType = "single") => {
    console.log('🚀 [SCHEDULE] ===== HANDLEPROCESSSAVE STARTED (v2.1) =====');
    console.log('🚀 [SCHEDULE] Timestamp:', new Date().toISOString());
    console.log('🚀 [SCHEDULE] eventData:', eventData?.title);
    console.log('🚀 [SCHEDULE] editType:', editType);
    console.log('🚀 [SCHEDULE] familyId from context:', familyId);
    
    try {
      // Use shared event service for AI processing
      const eventService = createEventService(familyId, familyMembers);
      const reviewPayload = await eventService.processAndSaveEvent(eventData, editType);
      
      // Add selected event data for editing context
      reviewPayload.initialData = selectedEvent;
      
      setReviewData(reviewPayload);
      setIsEventDialogOpen(false);

      // Show review dialog if there are either task suggestions OR planning insights
      const hasSuggestions = reviewPayload.aiResult?.suggestedTasks?.length > 0;
      const hasInsights = reviewPayload.planningInsights?.length > 0;
      
      if (hasSuggestions || hasInsights) {
        console.log('🔍 [SCHEDULE] Opening review dialog with:', {
          tasks: reviewPayload.aiResult?.suggestedTasks?.length || 0,
          insights: reviewPayload.planningInsights?.length || 0
        });
        setIsReviewDialogOpen(true);
      } else {
        console.log('🔍 [SCHEDULE] No suggestions, proceeding directly to save');
        handleConfirmSave(reviewPayload.originalEvent, [], editType);
      }
    } catch (err) {
      console.error("🚨 [SCHEDULE] ===== HANDLEPROCESSSAVE ERROR =====");
      console.error("🚨 [SCHEDULE] AI suggestion failed:", err);
      console.error("🚨 [SCHEDULE] Error name:", err.name);
      console.error("🚨 [SCHEDULE] Error message:", err.message);
      console.error("🚨 [SCHEDULE] Error stack:", err.stack);
      console.error("🚨 [SCHEDULE] ===== PROCEEDING TO SAVE WITHOUT AI =====");
      handleConfirmSave(eventData, [], editType);
    }
  };



  const handleConfirmSave = async (finalEventData, tasksToCreate, editType = "single") => {
    console.log('🔍 [SCHEDULE] handleConfirmSave called with:', {
      finalEventData: finalEventData?.title,
      tasksToCreate: tasksToCreate,
      tasksCount: tasksToCreate?.length,
      editType
    });
    
    try {
      const isUpdate = reviewData && reviewData.initialData && reviewData.initialData.id;

      if (isUpdate) {
        const initialEvent = reviewData.initialData;
        const wasRecurring = initialEvent.is_recurring || !!initialEvent.recurrence_id;
        const isNowRecurring = finalEventData.is_recurring;

        if (!wasRecurring && isNowRecurring) {
          await ScheduleEvent.delete(initialEvent.id);
          const eventsToCreate = generateRecurringEvents({ ...finalEventData, family_id: familyId });
          await ScheduleEvent.bulkCreate(eventsToCreate);
          toast({ title: t("eventSeriesCreated"), description: t("eventSeriesCreatedDescription", { title: finalEventData.title }) , duration: 5000 });
        } else if (editType === "series" && wasRecurring) {
          const seriesEvents = await ScheduleEvent.filter({ recurrence_id: initialEvent.recurrence_id });
          const originalStartTime = parseISO(initialEvent.start_time);
          const newStartTime = parseISO(finalEventData.start_time);
          const timeDiff = newStartTime.getTime() - originalStartTime.getTime();

          for (const ev of seriesEvents) {
            if (!ev.is_series_exception) {
              const updatedStartTime = new Date(parseISO(ev.start_time).getTime() + timeDiff);
              const updatedEndTime = new Date(parseISO(ev.end_time).getTime() + timeDiff);
              // eslint-disable-next-line no-await-in-loop
              await ScheduleEvent.update(ev.id, {
                ...finalEventData,
                start_time: updatedStartTime.toISOString(),
                end_time: updatedEndTime.toISOString(),
                is_recurring: true,
              });
            }
          }
          toast({ title: t("seriesUpdated"), description: t("seriesUpdatedDescription", { title: finalEventData.title }) , duration: 5000 });
        } else {
          const updateData = { ...finalEventData };
          if (wasRecurring && (!isNowRecurring || editType === "single")) {
            updateData.is_recurring = false;
            updateData.is_series_exception = true;
            updateData.original_recurrence_id = initialEvent.recurrence_id;
            updateData.recurrence_id = null;
          }
          await ScheduleEvent.update(initialEvent.id, updateData);
          requestTracker.current.log('ScheduleEvent.update', { eventId: initialEvent.id });
          
          // Also create tasks for updated events if provided
          if (tasksToCreate && tasksToCreate.length > 0) {
            try {
              console.log('🔍 [SCHEDULE] Creating tasks for updated event');
              console.log('🔍 [SCHEDULE] tasksToCreate for update:', tasksToCreate);
              console.log('🔍 [SCHEDULE] initialEvent.id:', initialEvent.id);
              console.log('🔍 [SCHEDULE] familyId:', familyId);
              
              const tasksPayload = tasksToCreate.map((task, index) => {
                console.log(`🔍 [SCHEDULE] Processing update task ${index}:`, task);
                const payload = {
                  ...task,
                  family_id: familyId,
                  status: "todo",
                  ai_suggested: true,
                  related_event_id: initialEvent.id,
                };
                console.log(`🔍 [SCHEDULE] Update task ${index} payload:`, payload);
                return payload;
              });
              
              console.log('🔍 [SCHEDULE] Final tasks payload for update:', tasksPayload);
              
              // Validate payload before sending
              const invalidTasks = tasksPayload.filter(task => !task.title || !task.family_id);
              if (invalidTasks.length > 0) {
                console.error('🚨 [SCHEDULE] Invalid update tasks in payload:', invalidTasks);
                throw new Error(`Invalid update tasks detected: ${invalidTasks.length} tasks missing required fields`);
              }
              
              console.log('🔍 [SCHEDULE] About to call Task.bulkCreate for update with', tasksPayload.length, 'tasks');
              const createdTasks = await Task.bulkCreate(tasksPayload);
              console.log('🔍 [SCHEDULE] Update Task.bulkCreate returned:', createdTasks);
              requestTracker.current.log('Task.bulkCreate (update event)', { count: tasksPayload.length });
              console.log('🔍 [SCHEDULE] Tasks created successfully for update');
              toast({
                title: t("tasksCreated") || "Tasks Created",
                description: `${tasksToCreate.length} task(s) added to your list`,
                duration: 3000
              });
            } catch (taskError) {
              console.error('🚨 [SCHEDULE] Error creating tasks for update:', taskError);
              toast({
                title: "Error Creating Tasks",
                description: `Failed to create tasks: ${taskError.message || 'Unknown error'}`,
                variant: "destructive",
                duration: 5000
              });
            }
          }
          
          toast({
            title: t("eventUpdated"),
            description:
              t("eventUpdatedDescription", { title: finalEventData.title }) +
              (updateData.is_series_exception ? ` (${t("asSingleInstanceBreakingSeries")})` : ""),
            duration: 5000 
          });
        }
      } else {
        const eventsToCreate = generateRecurringEvents({ ...finalEventData, family_id: familyId });
        const savedEvents = await ScheduleEvent.bulkCreate(eventsToCreate);
        requestTracker.current.log('ScheduleEvent.bulkCreate', { count: eventsToCreate.length });
        const primaryEventId = savedEvents.length > 0 ? savedEvents[0].id : null;

        if (tasksToCreate && tasksToCreate.length > 0 && primaryEventId) {
          try {
            console.log('🔍 [SCHEDULE] Creating tasks for new event');
            console.log('🔍 [SCHEDULE] tasksToCreate received:', tasksToCreate);
            console.log('🔍 [SCHEDULE] primaryEventId:', primaryEventId);
            console.log('🔍 [SCHEDULE] familyId:', familyId);
            
            const tasksPayload = tasksToCreate.map((task, index) => {
              console.log(`🔍 [SCHEDULE] Processing task ${index}:`, task);
              const payload = {
                ...task,
                family_id: familyId,
                status: "todo",
                ai_suggested: true,
                related_event_id: primaryEventId,
              };
              console.log(`🔍 [SCHEDULE] Task ${index} payload:`, payload);
              return payload;
            });
            
            console.log('🔍 [SCHEDULE] Final tasks payload:', tasksPayload);
            
            // Validate payload before sending
            const invalidTasks = tasksPayload.filter(task => !task.title || !task.family_id);
            if (invalidTasks.length > 0) {
              console.error('🚨 [SCHEDULE] Invalid tasks in payload:', invalidTasks);
              throw new Error(`Invalid tasks detected: ${invalidTasks.length} tasks missing required fields`);
            }
            
            console.log('🔍 [SCHEDULE] About to call Task.bulkCreate with', tasksPayload.length, 'tasks');
            const createdTasks = await Task.bulkCreate(tasksPayload);
            console.log('🔍 [SCHEDULE] Task.bulkCreate returned:', createdTasks);
            requestTracker.current.log('Task.bulkCreate (new event)', { count: tasksPayload.length });
            console.log('🔍 [SCHEDULE] Tasks created successfully');
            toast({
              title: t("tasksCreated") || "Tasks Created", 
              description: `${tasksToCreate.length} task(s) added to your list`,
              duration: 3000
            });
          } catch (taskError) {
            console.error('🚨 [SCHEDULE] Error creating tasks for new event:', taskError);
            toast({
              title: "Error Creating Tasks",
              description: `Failed to create tasks: ${taskError.message || 'Unknown error'}`,
              variant: "destructive", 
              duration: 5000
            });
          }
        } else {
          console.log('🔍 [SCHEDULE] Not creating tasks:', {
            hasTasksToCreate: !!tasksToCreate,
            taskCount: tasksToCreate?.length,
            hasPrimaryEventId: !!primaryEventId
          });
        }

          toast({
            title: t("eventSaved"),
            description:
              t("eventSavedDescription", { title: finalEventData.title }) +
              (eventsToCreate.length > 1 ? ` (${t("instancesCreated", { count: eventsToCreate.length })})` : ""),
            duration: 5000 
          });
          
          // Close dialogs - WebSocket will handle data refresh
          setIsEventDialogOpen(false);
          setIsReviewDialogOpen(false);        // --- Actionable notification for event assignees (toast + push) ---
        const assignees = Array.isArray(finalEventData.family_member_ids) ? finalEventData.family_member_ids : [];
        if (user && assignees.includes(user.id)) {
          let assignerName = user.name || "Someone";
          const notifTitle = t("event.assignedToYouTitle") || "New Event Scheduled";
          const notifBody = `${assignerName} scheduled an event for you: ${finalEventData.title}`;
          toast({ title: notifTitle, description: notifBody, duration: 5000 });
          // Push notification
          triggerPushNotification({
            title: notifTitle,
            body: notifBody,
            url: window.location.origin + createPageUrl ? createPageUrl('Schedule') : '/schedule',
          });
        }
      }
    } catch (error) {
      console.error("Error during final save:", error);
      toast({ title: t("saveFailed"), description: t("somethingWentWrong"), variant: "destructive", duration: 5000  });
    } finally {
      setIsReviewDialogOpen(false);
      setReviewData(null);
      setSelectedEvent(null);
      setSelectedTimeSlot(null);
      // WebSocket will handle data updates automatically
      console.log('🔍 [OPTIMIZATION] Skipping manual reload - WebSocket will update data');
    }
  };

  const handleDeleteEvent = async (event) => {
    let deletionSuccessful = false;

    if (event.recurrence_id && !event.is_series_exception) {
      const action = window.confirm(
        `${t("recurringEventWarning")}\n\n${t("chooseDeletionOption")}\n\n${t("okOption")} = ${t("deleteEntireSeries")}\n${t("cancelOption")} = ${t("deleteOnlyThisOccurrence")}`
      );

      if (action) {
        try {
          setIsLoading(true);
          const allSeriesEvents = await ScheduleEvent.filter({ recurrence_id: event.recurrence_id });
          requestTracker.current.log('ScheduleEvent.filter', { recurrence_id: event.recurrence_id, count: allSeriesEvents.length });
          let deletedTasksCount = 0;

          for (const seriesEvent of allSeriesEvents) {
            const relatedTasks = (await Task.filter({ related_event_id: seriesEvent.id }))
              .filter((task) => task.related_event_id === seriesEvent.id);
            if (relatedTasks.length > 0) {
              for (const task of relatedTasks) await Task.delete(task.id);
              deletedTasksCount += relatedTasks.length;
            }
            await ScheduleEvent.delete(seriesEvent.id);
          }

          toast({ duration: 5000,
            title: t("seriesDeleted"),
            description: t("seriesDeletedDescription", { title: event.title, count: deletedTasksCount }),
          });
          deletionSuccessful = true;
        } catch (error) {
          console.error("Error deleting event series:", error);
          toast({ title: t("deleteFailed"), description: t("couldNotDeleteSeries"), variant: "destructive", duration: 5000  });
        } finally {
          setIsLoading(false);
        }
      } else {
        try {
          const relatedTasks = (await Task.filter({ related_event_id: event.id }))
            .filter((task) => task.related_event_id === event.id);
          if (relatedTasks.length > 0) {
            const shouldDeleteTasks = window.confirm(t("confirmDeleteRelatedTasks", { count: relatedTasks.length }));
            if (shouldDeleteTasks) {
              for (const task of relatedTasks) {
                await Task.delete(task.id);
              }
            }
          }

          await ScheduleEvent.update(event.id, {
            is_recurring: false,
            is_series_exception: true,
            original_recurrence_id: event.recurrence_id,
            recurrence_id: null,
          });
          toast({ title: t("eventDeleted"), description: t("singleOccurrenceDeletedDescription", { title: event.title }), duration: 5000  });
          deletionSuccessful = true;
        } catch (error) {
          console.error("Error deleting single event:", error);
          toast({ title: t("deleteFailed"), description: t("somethingWentWrong"), variant: "destructive", duration: 5000  });
        }
      }
    } else {
      if (window.confirm(t("confirmDeleteEvent", { title: event.title }))) {
        try {
          const relatedTasks = (await Task.filter({ related_event_id: event.id }))
            .filter((task) => task.related_event_id === event.id);
          if (relatedTasks.length > 0) {
            const shouldDeleteTasks = window.confirm(t("confirmDeleteRelatedTasks", { count: relatedTasks.length }));
            if (shouldDeleteTasks) {
              for (const task of relatedTasks) {
                await Task.delete(task.id);
              }
            }
          }

          await ScheduleEvent.delete(event.id);
          requestTracker.current.log('ScheduleEvent.delete', { eventId: event.id });
          toast({ title: t("eventDeleted"), description: t("eventDeletedDescription", { title: event.title }) , duration: 5000 });
          deletionSuccessful = true;
        } catch (error) {
          console.error("Error deleting event:", error);
          toast({ title: t("deleteFailed"), description: t("somethingWentWrong"), variant: "destructive" , duration: 5000 });
        }
      }
    }

    if (deletionSuccessful) {
      setIsEventDialogOpen(false);
      setSelectedEvent(null);
      // await reload();
    }
  };

  const handleMemberFilter = (memberId) => {
    setSelectedMembers((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  };

  const handleTourComplete = () => {
    setRunTour(false);
    localStorage.setItem("famly_tour_schedule_completed", "true");
  };

  const toggleFullscreen = () => setIsFullscreen((s) => !s);

  // Show all events except those assigned exclusively to ai_assistant
  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      if (!event.family_member_ids || event.family_member_ids.length === 0) return true;
      // Only hide if all assignees are ai_assistant
      const nonAIAssignments = event.family_member_ids.filter((id) => {
        const member = familyMembers.find((m) => m.id === id);
        return member && member.role !== "ai_assistant";
      });
      return nonAIAssignments.length > 0 || event.family_member_ids.length === 0;
    });
  }, [events, familyMembers]);

  // Helper: stable YYYY-MM-DD for a Date in the user's TZ
  const makeDayKey = (tz) => {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit"
    });
    return (d) => fmt.format(d); // e.g. "2025-10-06"
  };

  // Grab the user's tz once (profile → browser → UTC)
  const userTimezone =
    (user && (user.timezone || user.time_zone)) ||
    Intl.DateTimeFormat().resolvedOptions().timeZone ||
    "UTC";

  const dayKey = makeDayKey(userTimezone);
  const todayKey = dayKey(new Date());

  const todayEvents = filteredEvents.filter((event) => {
    if (!event.start_time) return false;
    try {
      const start = parseISO(event.start_time);
      const end = event.end_time ? parseISO(event.end_time) : new Date(start.getTime() + 60_000);

      const startKey = dayKey(start);
      const endKey = dayKey(end);

      // Overlap in calendar days within user's TZ:
      // include if today is between start and end (inclusive)
      return startKey <= todayKey && todayKey <= endKey;
    } catch {
      return false;
    }
  });

  const CalendarViews = () => (
    <>
      {calendarView === "weekly" ? (
        <WeeklyCalendar
          events={filteredEvents}
          familyMembers={familyMembers}
          onEventClick={handleEventClick}
          onTimeSlotClick={handleTimeSlotClick}
          initialDate={currentViewDate}
          key={currentViewDate.getTime()}
          onEditEvent={handleEventClick}
          onDeleteEvent={handleDeleteEvent}
        />
      ) : (
        <ResourceCalendar
          events={filteredEvents}
          familyMembers={familyMembers}
          onEventClick={handleEventClick}
          onTimeSlotClick={handleTimeSlotClick}
          initialDate={currentViewDate}
          key={currentViewDate.getTime()}
        />
      )}
    </>
  );

  if (isLoading) {
    return (
      <div className="p-6 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/4 mb-6" />
        <div className="flex gap-6">
          <div className="flex-1 h-96 bg-gray-200 rounded-xl" />
          <div className="w-80 space-y-4">
            <div className="h-24 bg-gray-200 rounded-xl" />
            <div className="h-48 bg-gray-200 rounded-xl" />
            <div className="h-32 bg-gray-200 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 bg-white z-[100] flex flex-col">
        <header className="p-4 border-b flex items-center justify-between flex-shrink-0">
          <h1 className="text-xl font-bold">{t("schedule")}</h1>
          <div className="flex items-center gap-4">
            <div className="inline-flex items-center rounded-lg bg-gray-100 p-1">
              <Button variant={calendarView === "weekly" ? "secondary" : "ghost"} size="sm" onClick={() => handleViewChange("weekly")}>
                <CalendarDays className="h-4 w-4 mr-1" />
                {t("weekly")}
              </Button>
              <Button variant={calendarView === "resource" ? "secondary" : "ghost"} size="sm" onClick={() => handleViewChange("resource")}>
                <LayoutGrid className="h-4 w-4 mr-1" />
                {t("byMember")}
              </Button>
            </div>
            <Button onClick={toggleFullscreen} variant="outline" size="sm">
              <Minimize className="h-4 w-4" />
            </Button>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4">
          <CalendarViews />
        </main>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 h-full flex flex-col">
      <Joyride steps={scheduleTourSteps} run={runTour} onComplete={handleTourComplete} />

      <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
        {isMembersSidebarOpen && (
          <div className="w-full lg:w-72 flex-shrink-0">
            <MemberFilter familyMembers={familyMembers} selectedMembers={selectedMembers} onMemberFilter={handleMemberFilter} />
          </div>
        )}

        <div className="flex-1 min-w-0 flex flex-col">
          <div id="calendar-view-toggle" className="flex items-center justify-between mb-4 flex-shrink-0">
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setIsMembersSidebarOpen(!isMembersSidebarOpen)}
                variant="outline"
                size="sm"
                title={isMembersSidebarOpen ? t("hideMembersFilter") || "Hide Members Filter" : t("showMembersFilter") || "Show Members Filter"}
              >
                <Users className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDashboardFavoriteToggle}
                className={`h-8 w-8 p-0 ${dashboardFavorite === calendarView ? "text-yellow-500" : "text-gray-400"}`}
              >
                <Star className={`h-4 w-4 ${dashboardFavorite === calendarView ? "fill-current" : ""}`} />
              </Button>
              <div className="inline-flex items-center rounded-lg bg-gray-100 p-1">
                <Button
                  variant={calendarView === "weekly" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => handleViewChange("weekly")}
                  className="px-2 py-1 text-xs h-7"
                >
                  <CalendarDays className="h-3 w-3 mr-1" />
                  {t("weekly")}
                </Button>
                <Button
                  variant={calendarView === "resource" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => handleViewChange("resource")}
                  className="px-2 py-1 text-xs h-7"
                >
                  <LayoutGrid className="h-3 w-3 mr-1" />
                  {t("byMember")}
                </Button>
              </div>
              <Button onClick={toggleFullscreen} variant="outline" size="sm">
                <Maximize className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div id="calendar-container" className="flex-1 min-h-0">
            <CalendarViews />
          </div>
        </div>

        <div id="schedule-sidebar" className="w-full lg:w-72 flex-shrink-0">
          <ScheduleSidebar todayEvents={todayEvents} />
        </div>
      </div>

      <EventDialog
        isOpen={isEventDialogOpen}
        onClose={() => { setIsEventDialogOpen(false); setSelectedEvent(null); setSelectedTimeSlot(null); }}
        onSave={handleProcessSave}
        onDelete={handleDeleteEvent}
        familyMembers={familyMembers}
        initialData={selectedEvent}
        selectedDate={selectedTimeSlot?.date}
        selectedHour={selectedTimeSlot?.hour}
        preselectedMemberId={selectedTimeSlot?.memberId}
      />

      <AIReviewDialog
        isOpen={isReviewDialogOpen}
        onClose={() => { setIsReviewDialogOpen(false); setReviewData(null); }}
        reviewData={reviewData}
        onConfirm={handleConfirmSave}
        familyMembers={familyMembers}
      />
    </div>
  );
}
