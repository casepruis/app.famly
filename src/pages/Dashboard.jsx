import React, { useState, useEffect } from "react";
import { Task } from "@/api/entities";
import { ScheduleEvent } from "@/api/entities";
import { FamilyMember } from "@/api/entities";
import { Family } from "@/api/entities";
import { User } from "@/api/entities";
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
import Joyride from "../components/common/Joyride";
import FunFactCard from "../components/dashboard/FunFactCard";

const tourSteps = (t) => [
    { target: '#weekly-schedule-preview', title: t('weeklySchedule') || 'Weekly Schedule', content: t('tour_weeklySchedule_content') || 'Get a quick overview of your family\'s week at a glance. Click to navigate to the full schedule.' },
    { target: '#upcoming-events-card', title: t('upcomingEvents') || 'Upcoming Events', content: t('tour_upcomingEvents_content') || 'Never miss an appointment or activity. Your next 5 events are listed here.' },
    { target: '#upcoming-tasks-card', title: t('upcomingTasks') || 'Upcoming Tasks', content: t('tour_upcomingTasks_content') || 'Stay on top of your family\'s to-do list. See what needs to be done.' },
    { target: '#ai-insights-card', title: t('aiInsights') || 'AI Family Insights', content: t('tour_aiInsights_content') || 'Our AI analyzes your schedule to provide helpful suggestions and optimizations.' },
    { target: '#sidebar-ai-assistant', title: t('aiAssistant') || 'AI Assistant', content: t('tour_aiAssistant_content') || 'Click here anytime to chat with the AI, create tasks, or schedule events using your voice.' },
];

export default function Dashboard() {
  // All hooks must be called before any early returns
  const [family, setFamily] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [events, setEvents] = useState([]);
  const [familyMembers, setFamilyMembers] = useState([]);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [runTour, setRunTour] = useState(false);
  const [editEvent, setEditEvent] = useState(null);
  const [reviewData, setReviewData] = useState(null);
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(null);
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  // Add retry logic with exponential backoff
  const withRetry = async (fn, maxRetries = 3, baseDelay = 1000) => {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (error.response?.status === 429 && i < maxRetries - 1) {
          const delay = baseDelay * Math.pow(2, i) + Math.random() * 1000;
          console.log(`Rate limited, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }
    }
  };

  useEffect(() => {
    // Debounce the loadData call
    const timeoutId = setTimeout(() => {
      loadData();
    }, 100);

    const handleAction = (event) => {
      const customEvent = event;
      const { action } = customEvent.detail;
      if (action === 'tour') {
        setRunTour(true);
      }
    };

    window.addEventListener('actionTriggered', handleAction);
    
    // Also handle URL params on first load
    const action = searchParams.get('action');
    if (action === 'tour') {
        setRunTour(true);
        setSearchParams({}); // Clear the action from URL
    }

    return () => {
      clearTimeout(timeoutId); // Clear timeout on unmount or re-run of effect
      window.removeEventListener('actionTriggered', handleAction);
    };
  }, [searchParams]);

  const loadData = async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      const currentUser = await withRetry(() => User.me());
      setUser(currentUser);

      if (!currentUser.family_id) {
        navigate(createPageUrl("FamilySetup"));
        return;
      }

      const familyId = currentUser.family_id;
      
      let familyData = null;
      try {
        familyData = await withRetry(() => Family.get(familyId));
        setFamily(familyData);
      } catch (familyError) {
        console.error("Family not found:", familyError);
        if (familyError.response?.status === 429) {
          setHasError(true);
          toast({ duration: 5000, 
            title: 'Rate Limit Exceeded', 
            description: 'Too many requests. Please wait a moment and refresh.', 
            variant: "destructive" , 
            duration: 5000 
          });
          return;
        }
        try {
          await User.updateMyUserData({ family_id: null });
          navigate(createPageUrl("Index"));
          return;
        } catch (updateError) {
          console.error("Failed to clear family_id:", updateError);
          setHasError(true);
          return;
        }
      }

      const dataPromises = [
        withRetry(() => ScheduleEvent.filter({ family_id: familyId }, '-start_time', 1000)).catch(() => []),
        withRetry(() => Task.filter({ family_id: familyId }, 'due_date', 1000)).catch(() => []),
        withRetry(() => FamilyMember.filter({ family_id: familyId }, '-created_date')).catch(() => [])
      ];
      
      const [eventsData, tasksData, membersData] = await Promise.all(dataPromises);
      
      setEvents(eventsData);
      setTasks(tasksData);
      setFamilyMembers(membersData);
      
    } catch (error) {
      console.error("Error loading dashboard data:", error);
      if (error.response?.status === 401) {
         navigate(createPageUrl("Index"));
      } else if (error.response?.status === 429) {
        setHasError(true);
  toast({ duration: 5000, 
          title: 'Rate Limit Exceeded', 
          description: 'Too many requests. Please wait a moment and refresh.', 
          variant: "destructive" , 
          duration: 5000 
        });
      } else {
        setHasError(true);
  toast({ title: t('errorLoadingData'), description: t('couldNotLoadDashboard'), variant: "destructive", duration: 5000  });
      }
    }
    setIsLoading(false);
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

  if (hasError) {
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
    // No AI review for now, just save directly
    try {
      if (editEvent && editEvent.id) {
        await ScheduleEvent.update(editEvent.id, eventData);
        setEvents(prev => prev.map(e => e.id === editEvent.id ? { ...e, ...eventData } : e));
  toast({ title: t('eventUpdated'), description: eventData.title, variant: 'success', duration: 5000 });
      } else {
        // Ensure family_id is included for new events
        const newEvent = { ...eventData, family_id: user?.family_id };
        const created = await ScheduleEvent.create(newEvent);
        setEvents(prev => [...prev, created]);
  toast({ title: t('eventCreated'), description: eventData.title, variant: 'success', duration: 5000 });
      }
      handleDialogClose();
    } catch (error) {
  toast({ title: t('errorSavingEvent'), description: eventData.title, variant: 'destructive', duration: 5000 });
    }
  };
  const handleDialogDelete = async (event) => {
    if (!window.confirm(t('confirmDeleteEvent') || 'Delete this event?')) return;
    try {
      await ScheduleEvent.delete(event.id);
      setEvents(prev => prev.filter(e => e.id !== event.id));
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
        onSave={handleProcessSave}
        onDelete={handleDialogDelete}
        familyMembers={familyMembers}
        initialData={editEvent}
        selectedDate={selectedTimeSlot?.date}
        selectedHour={selectedTimeSlot?.hour}
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
      <div className="grid lg:grid-cols-2 gap-6">
        <motion.div id="ai-insights-card" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.4 }}>
          <AIInsights tasks={tasks} events={events} familyMembers={familyMembers} />
        </motion.div>
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.5 }}>
          <FunFactCard />
        </motion.div>
      </div>
    </div>
  );
}