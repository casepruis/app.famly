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
import React, { useState, useEffect, useRef } from "react";
// --- WebSocket for real-time event/task updates ---
const useFamlyWebSocket = (reload) => {
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
          // Temporarily disable auto-reload for created events to reduce redundant calls
          if (data && (
            data.type === 'schedule_event_updated' ||
            data.type === 'schedule_event_deleted' ||
            data.type === 'task_created' ||
            data.type === 'task_updated' ||
            data.type === 'task_deleted')) {
            // Data updates handled by FamilyDataContext WebSocket - no manual reload needed
            console.log('🔍 [OPTIMIZATION] Dashboard WebSocket update - no manual reload needed');
          }
        } catch {}
      };
    } catch {}
    return () => { try { ws && ws.close(); } catch {} };
  }, []);
};
import { useFamilyData } from "@/hooks/FamilyDataContext";
import { motion } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useLanguage } from "@/components/common/LanguageProvider";
import { parseISO } from "date-fns";
import { useToast } from "@/components/ui/use-toast";

import AIInsights from "../components/dashboard/AIInsights";
import UpcomingEvents from "../components/dashboard/UpcomingEvents";
import UpcomingTasks from "../components/dashboard/UpcomingTasks";
import WeeklySchedulePreview from "../components/dashboard/WeeklySchedulePreview";
import EventDialog from "@/components/schedule/EventDialog";
import AIReviewDialog from "@/components/schedule/AIReviewDialog";
import { ScheduleEvent } from "@/api/entities";
import Joyride from "../components/common/Joyride";
import FunFactCard from "../components/dashboard/FunFactCard";
import InsightDebugPanel from "../components/InsightDebugPanel";

const tourSteps = (t) => [
    { target: '#weekly-schedule-preview', title: t('weeklySchedule') || 'Weekly Schedule', content: t('tour_weeklySchedule_content') || 'Get a quick overview of your family\'s week at a glance. Click to navigate to the full schedule.' },
    { target: '#upcoming-events-card', title: t('upcomingEvents') || 'Upcoming Events', content: t('tour_upcomingEvents_content') || 'Never miss an appointment or activity. Your next 5 events are listed here.' },
    { target: '#upcoming-tasks-card', title: t('upcomingTasks') || 'Upcoming Tasks', content: t('tour_upcomingTasks_content') || 'Stay on top of your family\'s to-do list. See what needs to be done.' },
    { target: '#ai-insights-card', title: t('aiInsights') || 'AI Family Insights', content: t('tour_aiInsights_content') || 'Our AI analyzes your schedule to provide helpful suggestions and optimizations.' },
    { target: '#sidebar-ai-assistant', title: t('aiAssistant') || 'AI Assistant', content: t('tour_aiAssistant_content') || 'Click here anytime to chat with the AI, create tasks, or schedule events using your voice.' },
];

export default function Dashboard() {
  // All hooks must be called before any early returns
  const { user, family, members: familyMembers, events, tasks, isLoading, error } = useFamilyData();
  // Removed useFamlyWebSocket(reload) - FamilyDataContext handles WebSocket updates
  const [hasError, setHasError] = useState(false);
  const [runTour, setRunTour] = useState(false);
  const [editEvent, setEditEvent] = useState(null);
  const [reviewData, setReviewData] = useState(null);
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(null);
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);
  const navigate = useNavigate();
  const { t, currentLanguage } = useLanguage();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  // Add retry logic with exponential backoff
  const withRetry = async (fn, maxRetries = 3, baseDelay = 1000) => {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (err) {
        if (i === maxRetries - 1) throw err;
        await new Promise(res => setTimeout(res, baseDelay * Math.pow(2, i)));
      }
    }
  };

  // Get upcoming events sorted by date - improved filtering
  // Only show first instance of recurring events
  const upcomingEvents = events
    .filter(e => {
      if (!e.start_time) return false;
      try {
        const eventDate = parseISO(e.start_time);
        return eventDate >= new Date();
      } catch (error) {
        console.error('Error parsing event date:', e.start_time, error);
        return false;
      }
    })
    .sort((a, b) => {
      try {
        return parseISO(a.start_time).getTime() - parseISO(b.start_time).getTime();
      } catch {
        return 0;
      }
    })
    .reduce((acc, event) => {
      // For recurring events, only show the first upcoming instance (already sorted)
      if (event.recurrence_id) {
        const existingEvent = acc.find(e => e.recurrence_id === event.recurrence_id);
        if (!existingEvent) {
          acc.push(event);
        }
      } else {
        // For non-recurring events, add them all
        acc.push(event);
      }
      return acc;
    }, [])
    .slice(0, 5);

  // Get upcoming tasks sorted by due date - improved filtering
  const upcomingTasks = tasks
    .filter(t => {
      if (t.status === 'completed') return false;
      if (t.due_date) {
        try {
          const dueDate = parseISO(t.due_date);
          const today = new Date();
          today.setHours(0, 0, 0, 0); // Start of today
          return dueDate >= today;
        } catch (error) {
          console.error('Error parsing task date:', t.due_date, error);
          return false;
        }
      }
      return true; // Include tasks without a due date
    })
    .sort((a, b) => {
      const aHasDate = !!a.due_date;
      const bHasDate = !!b.due_date;
      if (aHasDate && !bHasDate) return -1;
      if (!aHasDate && bHasDate) return 1;
      if (!aHasDate && !bHasDate) return 0;
      try {
        return parseISO(a.due_date).getTime() - parseISO(b.due_date).getTime();
      } catch {
        return 0;
      }
    })
    .slice(0, 5);

  const handleTourComplete = () => {
    setRunTour(false);
    localStorage.setItem('famlyai_tour_dashboard_completed', 'true');
  };

  if (error || hasError) {
    return (
      <div className="p-6 text-center">
        <div className="max-w-md mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">{t('rateLimitExceeded') || 'Rate limit exceeded'}</h2>
          <p className="text-gray-600 mb-6">{t('tooManyRequests') || 'Too many requests were made. Please wait a moment before trying again.'}</p>
          <div className="space-y-3">
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
            >
              {t('refreshPage') || 'Refresh Page'}
            </button>
            <button 
              onClick={() => navigate(createPageUrl("Index"))}
              className="w-full bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400"
            >
              {t('goToHome') || 'Go to Home'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="animate-pulse">
          <div className="h-32 bg-gradient-to-r from-blue-200 to-green-200 rounded-2xl mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
            {[1, 2, 3].map(i => <div key={i} className="h-48 bg-gray-200 rounded-xl"></div>)}
          </div>
        </div>
      </div>
    );
  }

  // --- Schedule-like event dialog logic ---
  const handleDayClick = (dateObj) => {
    setEditEvent(null);
    setSelectedTimeSlot({ date: dateObj, hour: 9 });
  };
  const handleEventClick = (event) => {
    setEditEvent(event);
    setSelectedTimeSlot(null);
  };
  const handleDialogClose = () => {
    setEditEvent(null);
    setSelectedTimeSlot(null);
  };
  const handleProcessSave = async (eventData, _ignored, editType = "single") => {
    // Prevent event creation if user or family_id is not loaded
    if (!user || !user.family_id) {
      toast({
        title: t('userNotLoaded') || 'User not loaded',
        description: t('pleaseWaitForUser') || 'Please wait for your user to load before creating an event.',
        variant: 'destructive',
        duration: 5000
      });
      return;
    }
    setIsCreatingEvent(true);
    try {
      if (editEvent && editEvent.id) {
        await ScheduleEvent.update(editEvent.id, eventData);
  // reload();
        toast({ title: t('eventUpdated'), description: eventData.title, variant: 'success', duration: 5000 });
      } else {
        // Ensure family_id is included for new events
        const newEvent = { ...eventData, family_id: user.family_id, language: currentLanguage };
        console.log('[FamlyAI] Creating event with payload:', newEvent);
        const created = await ScheduleEvent.create(newEvent);
        console.log('[FamlyAI] ScheduleEvent.create response:', created);
  // reload();
        toast({ title: t('eventCreated'), description: eventData.title, variant: 'success', duration: 5000 });
        // --- Actionable notification for event assignees (toast + push) ---
        const assignees = Array.isArray(eventData.family_member_ids) ? eventData.family_member_ids : [];
        if (user && assignees.includes(user.id)) {
          let assignerName = user.name || "Someone";
          const notifTitle = t("event.assignedToYouTitle") || "New Event Scheduled";
          const notifBody = `${assignerName} scheduled an event for you: ${eventData.title}`;
          toast({ title: notifTitle, description: notifBody, duration: 5000 });
          // Push notification
          triggerPushNotification({
            title: notifTitle,
            body: notifBody,
            url: window.location.origin + createPageUrl ? createPageUrl('Dashboard') : '/dashboard',
          });
        }
      }
      handleDialogClose();
    } catch (error) {
      console.error('[FamlyAI] Error in handleProcessSave:', error);
      toast({ title: t('errorSavingEvent'), description: eventData.title, variant: 'destructive', duration: 5000 });
    } finally {
      setIsCreatingEvent(false);
    }
  };
  const handleDialogDelete = async (event) => {
    if (!window.confirm(t('confirmDeleteEvent') || 'Delete this event?')) return;
    try {
      await ScheduleEvent.delete(event.id);
  // reload();
      toast({ title: t('eventDeleted'), description: event.title, variant: 'success', duration: 5000 });
      handleDialogClose();
    } catch (error) {
      toast({ title: t('errorDeletingEvent'), description: event.title, variant: 'destructive', duration: 5000 });
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      <Joyride steps={tourSteps(t)} run={runTour} onComplete={handleTourComplete} />
      <EventDialog
        isOpen={!!editEvent || !!selectedTimeSlot}
        onClose={handleDialogClose}
        onSave={async (eventData, _ignored, editType = "single") => {
          try {
            // Always ensure family_id is set for new events
            let newEventData = { ...eventData };
            if (!(editEvent && editEvent.id)) {
              if (!newEventData.family_id) {
                if (family && family.id) {
                  newEventData.family_id = family.id;
                } else if (user && user.family_id) {
                  newEventData.family_id = user.family_id;
                }
              }
            }
            if (editEvent && editEvent.id) {
              await ScheduleEvent.update(editEvent.id, newEventData);
              toast({ title: t('eventUpdated'), description: newEventData.title, variant: 'success', duration: 5000 });
            } else {
              const createdEvent = await ScheduleEvent.create(newEventData);
              console.log('🔍 [DASHBOARD] Event created:', createdEvent.title);
              toast({ title: t('eventCreated'), description: newEventData.title, variant: 'success', duration: 5000 });
              
              // Trigger AI review dialog for new events - use aiResult from backend response
              if (createdEvent.aiResult || createdEvent.planningInsights) {
                setReviewData({
                  originalEvent: createdEvent,
                  aiResult: createdEvent.aiResult || { suggestedTasks: [] },  // Use aiResult from backend
                  planningInsights: createdEvent.planningInsights || [],      // Include planning insights
                  type: 'event',
                  isNew: true
                });
                setIsReviewDialogOpen(true);
              }
            }
            // WebSocket will handle data updates automatically
            handleDialogClose();
          } catch (error) {
            toast({ title: t('errorSavingEvent'), description: eventData.title, variant: 'destructive', duration: 5000 });
          }
        }}
        onDelete={handleDialogDelete}
        familyMembers={familyMembers}
        initialData={editEvent}
        selectedDate={selectedTimeSlot?.date}
        selectedHour={selectedTimeSlot?.hour}
        userLoaded={!!user && !!user.family_id}
      />
      
      {/* AI Review Dialog for insights after event creation */}
      <AIReviewDialog
        isOpen={isReviewDialogOpen}
        onClose={() => {
          setIsReviewDialogOpen(false);
          setReviewData(null);
        }}
        reviewData={reviewData}
        onConfirm={async (finalEvent, allTasks) => {
          console.log('🔍 [DASHBOARD] onConfirm called with:', { finalEvent, allTasks });
          // Handle task creation from AI suggestions
          if (allTasks && allTasks.length > 0) {
            try {
              console.log('🔍 [DASHBOARD] Creating tasks:', allTasks);
              
              // Ensure all tasks have required fields before sending to API
              const tasksToCreate = allTasks.map(task => ({
                title: task.title,
                description: task.description || '',
                family_id: user.family_id,
                ai_suggested: task.ai_suggested || true,
                priority: task.priority || 'medium',
                due_date: task.due_date,
                category: task.category || 'family',
                status: task.status || 'todo',
                assigned_to: task.assigned_to || [],
                points: task.points || 0,
                estimated_duration: task.estimated_duration || 0,
                is_recurring: task.is_recurring || false,
                related_event_id: task.related_event_id || finalEvent?.id || reviewData?.originalEvent?.id
              }));
              
              for (const task of tasksToCreate) {
                console.log('🔍 [DASHBOARD] Creating task with schema-compliant data:', task);
                await Task.create(task);
              }
              console.log('🔍 [DASHBOARD] Tasks created successfully');
              toast({ 
                title: 'AI Tasks Created', 
                description: `${allTasks.length} task(s) added to your list`, 
                duration: 3000 
              });
            } catch (error) {
              console.error('Error creating tasks:', error);
              toast({ 
                title: 'Error Creating Tasks', 
                description: 'Failed to create some tasks. Please try again.', 
                variant: "destructive",
                duration: 3000 
              });
            }
          }
          setIsReviewDialogOpen(false);
          setReviewData(null);
        }}
      />
      
      <div className="grid lg:grid-cols-4 gap-6">
        <motion.div id="weekly-schedule-preview" className="lg:col-span-2" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
          <WeeklySchedulePreview
            events={events}
            familyMembers={familyMembers}
            onDayClick={handleDayClick}
            onEventClick={handleEventClick}
          />
        </motion.div>
        <motion.div id="upcoming-events-card" className="lg:col-span-1" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
          <UpcomingEvents events={upcomingEvents} familyMembers={familyMembers} />
        </motion.div>
        <motion.div id="upcoming-tasks-card" className="lg:col-span-1" initial={{ opacity: 0, x: 0 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.3 }}>
          <UpcomingTasks tasks={upcomingTasks} familyMembers={familyMembers} />
        </motion.div>
      </div>
      {/* <div className="grid lg:grid-cols-2 gap-6">
        <motion.div id="ai-insights-card" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.4 }}>
          <AIInsights tasks={tasks} events={events} familyMembers={familyMembers} />
        </motion.div>
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.5 }}>
          <FunFactCard />
        </motion.div>
      </div> */}
      
      {/* Temporary debug panel for testing insight tracking */}
      <InsightDebugPanel />
    </div>
  );
}
