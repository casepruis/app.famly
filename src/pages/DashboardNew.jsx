/**
 * Dashboard Page (Refactored)
 * 
 * Uses unified useEventCreation and useTaskCreation hooks for consistent UX
 * across all event and task creation entry points.
 */

import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import { parseISO } from "date-fns";

import { useFamilyData } from "@/hooks/FamilyDataContext";
import { useEventCreation } from "@/hooks/useEventCreation";
import { useTaskCreation } from "@/hooks/useTaskCreation";
import { useLanguage } from "@/components/common/LanguageProvider";
import { createPageUrl } from "@/utils";

// Components
import AIInsights from "../components/dashboard/AIInsights";
import UpcomingEvents from "../components/dashboard/UpcomingEventsNew";
import UpcomingTasks from "../components/dashboard/UpcomingTasksNew";
import WeeklySchedulePreview from "../components/dashboard/WeeklySchedulePreview";
import EventDialog from "@/components/schedule/EventDialog";
import AIReviewDialog from "@/components/schedule/AIReviewDialog";
import TaskForm from "@/components/tasks/TaskForm";
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
  // Family data from context
  const { user, family, members: familyMembers, events, tasks, isLoading, error } = useFamilyData();
  
  // Unified event creation hook
  const {
    isEventDialogOpen,
    isReviewDialogOpen,
    selectedEvent,
    selectedTimeSlot,
    reviewData,
    isProcessing: isEventProcessing,
    openNewEventDialog,
    openEditEventDialog,
    closeEventDialog,
    closeReviewDialog,
    processEventSave,
    confirmWithTasks,
    skipReview,
    deleteEvent,
  } = useEventCreation();

  // Unified task creation hook
  const {
    isTaskDialogOpen,
    selectedTask,
    prefillData: taskPrefillData,
    isInferring: isTaskInferring,
    isSaving: isTaskSaving,
    openNewTaskDialog,
    openEditTaskDialog,
    closeTaskDialog,
    saveTask,
    toggleTaskComplete,
  } = useTaskCreation();

  // Local state
  const [hasError, setHasError] = useState(false);
  const [runTour, setRunTour] = useState(false);
  
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();

  // Filter upcoming events (next 5, sorted by date, deduplicated for recurring)
  const upcomingEvents = useMemo(() => {
    return events
      .filter(e => {
        if (!e.start_time) return false;
        try {
          return parseISO(e.start_time) >= new Date();
        } catch {
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
        // For recurring events, only show the first upcoming instance
        if (event.recurrence_id) {
          if (!acc.find(e => e.recurrence_id === event.recurrence_id)) {
            acc.push(event);
          }
        } else {
          acc.push(event);
        }
        return acc;
      }, [])
      .slice(0, 5);
  }, [events]);

  // Filter upcoming tasks (next 5, not completed, sorted by due date)
  const upcomingTasks = useMemo(() => {
    return tasks
      .filter(t => {
        if (t.status === 'completed') return false;
        if (t.due_date) {
          try {
            const dueDate = parseISO(t.due_date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return dueDate >= today;
          } catch {
            return false;
          }
        }
        return true; // Include tasks without due date
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
  }, [tasks]);

  // Handle tour completion
  const handleTourComplete = () => {
    setRunTour(false);
    localStorage.setItem('famlyai_tour_dashboard_completed', 'true');
  };

  // Handle URL actions
  useEffect(() => {
    const action = searchParams.get("action");
    if (action === "new-event") {
      openNewEventDialog();
      setSearchParams({});
    } else if (action === "new-task") {
      openNewTaskDialog();
      setSearchParams({});
    } else if (action === "tour") {
      setRunTour(true);
      setSearchParams({});
    }
  }, [searchParams, setSearchParams, openNewEventDialog, openNewTaskDialog]);

  // Error state
  if (error || hasError) {
    return (
      <div className="p-6 text-center">
        <div className="max-w-md mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            {t('rateLimitExceeded') || 'Rate limit exceeded'}
          </h2>
          <p className="text-gray-600 mb-6">
            {t('tooManyRequests') || 'Too many requests were made. Please wait a moment before trying again.'}
          </p>
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

  // Loading state
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

  // Event handlers for child components
  const handleCalendarDayClick = (dateObj) => {
    openNewEventDialog(dateObj, 9);
  };

  const handleCalendarEventClick = (event) => {
    openEditEventDialog(event);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      <Joyride steps={tourSteps(t)} run={runTour} onComplete={handleTourComplete} />
      
      {/* Event Dialog - unified for all entry points */}
      <EventDialog
        isOpen={isEventDialogOpen}
        onClose={closeEventDialog}
        onSave={processEventSave}
        onDelete={deleteEvent}
        familyMembers={familyMembers}
        initialData={selectedEvent}
        selectedDate={selectedTimeSlot?.date}
        selectedHour={selectedTimeSlot?.hour}
        userLoaded={!!user && !!user.family_id}
        externalProcessing={isEventProcessing}
      />
      
      {/* AI Review Dialog - shown after event creation with suggestions */}
      <AIReviewDialog
        isOpen={isReviewDialogOpen}
        onClose={skipReview}
        reviewData={reviewData}
        onConfirm={(finalEvent, tasksToCreate) => {
          confirmWithTasks(finalEvent, tasksToCreate);
        }}
      />

      {/* Task Dialog - unified for all entry points */}
      <TaskForm
        isOpen={isTaskDialogOpen}
        onClose={closeTaskDialog}
        onSave={saveTask}
        familyMembers={familyMembers}
        task={selectedTask || taskPrefillData}
        inferring={isTaskInferring}
        saving={isTaskSaving}
      />
      
      {/* Main Dashboard Grid */}
      <div className="grid lg:grid-cols-4 gap-6">
        {/* Weekly Schedule Preview - spans 2 columns */}
        <motion.div 
          id="weekly-schedule-preview" 
          className="lg:col-span-2" 
          initial={{ opacity: 0, y: -20 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <WeeklySchedulePreview
            events={events}
            familyMembers={familyMembers}
            onDayClick={handleCalendarDayClick}
            onEventClick={handleCalendarEventClick}
          />
        </motion.div>

        {/* Upcoming Events */}
        <motion.div 
          id="upcoming-events-card" 
          className="lg:col-span-1" 
          initial={{ opacity: 0, x: -20 }} 
          animate={{ opacity: 1, x: 0 }} 
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <UpcomingEvents 
            events={upcomingEvents} 
            familyMembers={familyMembers}
            onAddEvent={() => openNewEventDialog()}
            onEventClick={openEditEventDialog}
          />
        </motion.div>

        {/* Upcoming Tasks */}
        <motion.div 
          id="upcoming-tasks-card" 
          className="lg:col-span-1" 
          initial={{ opacity: 0, x: 0 }} 
          animate={{ opacity: 1, x: 0 }} 
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <UpcomingTasks 
            tasks={upcomingTasks} 
            familyMembers={familyMembers}
            onAddTask={() => openNewTaskDialog()}
            onTaskClick={openEditTaskDialog}
            onToggleComplete={toggleTaskComplete}
          />
        </motion.div>
      </div>

      {/* AI Insights & Fun Fact - currently commented out */}
      {/* <div className="grid lg:grid-cols-2 gap-6">
        <motion.div id="ai-insights-card" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.4 }}>
          <AIInsights tasks={tasks} events={events} familyMembers={familyMembers} />
        </motion.div>
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.5 }}>
          <FunFactCard />
        </motion.div>
      </div> */}
    </div>
  );
}
