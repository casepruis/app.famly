// src/pages/Schedule.jsx
import React, { useState, useEffect, useMemo } from "react";
import { ScheduleEvent, FamilyMember, User, Task } from "@/api/entities";
import {
  addDays, addWeeks, addMonths, addYears, getHours,
  parseISO, startOfDay, endOfDay
} from "date-fns";
import { useNavigate, useSearchParams } from "react-router-dom";
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
  const [events, setEvents] = useState([]);
  const [familyMembers, setFamilyMembers] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentViewDate, setCurrentViewDate] = useState(new Date());
  const [runTour, setRunTour] = useState(false);
  const [reviewData, setReviewData] = useState(null);
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const [calendarView, setCalendarView] = useState("weekly");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [dashboardFavorite, setDashboardFavorite] = useState(null);
  const [isMembersSidebarOpen, setIsMembersSidebarOpen] = useState(false);
  const [familyId, setFamilyId] = useState(null);
  
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
    (async () => {
      try {
        const user = await User.me();
        if (!user?.family_id) { navigate(createPageUrl("Index")); return; }
        setFamilyId(user.family_id);
        if (user.preferred_calendar_view) setCalendarView(user.preferred_calendar_view);
        if (user.dashboard_favorite_view) setDashboardFavorite(user.dashboard_favorite_view);
        await loadData(user.family_id);
      } catch (e) {
        console.error("Failed to init schedule:", e);
      }
    })();

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
  }, [searchParams]);

  const loadData = async (fid) => {
    setIsLoading(true);
    try {
      const [eventsData, membersData] = await Promise.all([
        // order_by & limit supported by backend now
        ScheduleEvent.filter({ family_id: fid }, "-start_time", 1000),
        FamilyMember.filter({ family_id: fid }, "-created_date"),
      ]);

      setEvents(eventsData);
      setFamilyMembers(membersData);
      setSelectedMembers(membersData.filter(m => m.role !== "ai_assistant").map(m => m.id));
    } catch (error) {
      console.error("Error loading schedule data:", error);
    }
    setIsLoading(false);
  };

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
  try {
    const llm = await InvokeLLMNormalized({
      prompt: `You are a family organizer assistant. Suggest a very short 2–3 word title and any useful follow-up tasks as plain strings.
Event Title: "${eventData.title || ""}"
Description: "${eventData.description || ""}"
Category: "${eventData.category || ""}"`,
      response_json_schema: {
        type: "object",
        properties: {
          short_title: { type: "string" },
          suggestedTasks: { type: "array", items: { type: "string" } },
          tasks: { type: "array", items: { type: "string" } },
          summary: { type: "string" }
        },
        additionalProperties: true
      }
    });

    const normalizedSuggestedTasks = (llm.suggestedTasks || []).map((t) =>
      typeof t === "string" ? { title: t } : t
    );

    const reviewPayload = {
      originalEvent: {
        ...eventData,
        short_title: eventData.short_title || llm.short_title || eventData.short_title
      },
      aiResult: {
        ...llm,
        suggestedTasks: normalizedSuggestedTasks
      },
      initialData: selectedEvent,
      editType
    };

    setReviewData(reviewPayload);
    setIsEventDialogOpen(false);

    if (normalizedSuggestedTasks.length > 0) {
      setIsReviewDialogOpen(true);
    } else {
      handleConfirmSave(reviewPayload.originalEvent, [], editType);
    }
  } catch (err) {
    console.error("AI suggestion failed:", err);
    handleConfirmSave(eventData, [], editType);
  }
};





  const handleConfirmSave = async (finalEventData, tasksToCreate, editType = "single") => {
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
        const primaryEventId = savedEvents.length > 0 ? savedEvents[0].id : null;

        if (tasksToCreate && tasksToCreate.length > 0 && primaryEventId) {
          const tasksPayload = tasksToCreate.map((task) => ({
            ...task,
            family_id: familyId,
            status: "todo",
            ai_suggested: true,
            related_event_id: primaryEventId,
          }));
          await Task.bulkCreate(tasksPayload);
        }

        toast({
          title: t("eventSaved"),
          description:
            t("eventSavedDescription", { title: finalEventData.title }) +
            (eventsToCreate.length > 1 ? ` (${t("instancesCreated", { count: eventsToCreate.length })})` : ""),
          duration: 5000 
        });
      }
    } catch (error) {
      console.error("Error during final save:", error);
      toast({ title: t("saveFailed"), description: t("somethingWentWrong"), variant: "destructive", duration: 5000  });
    } finally {
      setIsReviewDialogOpen(false);
      setReviewData(null);
      setSelectedEvent(null);
      setSelectedTimeSlot(null);
      if (familyId) await loadData(familyId);
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
          let deletedTasksCount = 0;

          for (const seriesEvent of allSeriesEvents) {
            const relatedTasks = await Task.filter({ related_event_id: seriesEvent.id });
            if (relatedTasks.length > 0) {
              // eslint-disable-next-line no-await-in-loop
              for (const task of relatedTasks) await Task.delete(task.id);
              deletedTasksCount += relatedTasks.length;
            }
            // eslint-disable-next-line no-await-in-loop
            await ScheduleEvent.delete(seriesEvent.id);
          }

          toast({
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
          const relatedTasks = await Task.filter({ related_event_id: event.id });
          if (relatedTasks.length > 0) {
            const shouldDeleteTasks = window.confirm(t("confirmDeleteRelatedTasks", { count: relatedTasks.length }));
            if (shouldDeleteTasks) {
              for (const task of relatedTasks) {
                // eslint-disable-next-line no-await-in-loop
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
          const relatedTasks = await Task.filter({ related_event_id: event.id });
          if (relatedTasks.length > 0) {
            const shouldDeleteTasks = window.confirm(t("confirmDeleteRelatedTasks", { count: relatedTasks.length }));
            if (shouldDeleteTasks) {
              for (const task of relatedTasks) {
                // eslint-disable-next-line no-await-in-loop
                await Task.delete(task.id);
              }
            }
          }

          await ScheduleEvent.delete(event.id);
          toast({ title: t("eventDeleted"), description: t("eventDeletedDescription", { title: event.title }) , duration: 5000 });
          deletionSuccessful = true;
        } catch (error) {
          console.error("Error deleting event:", error);
          toast({ title: t("deleteFailed"), description: t("somethingWentWrong"), variant: "destructive" , duration: 5000 });
        }
      }
    }

    if (deletionSuccessful && familyId) {
      setIsEventDialogOpen(false);
      setSelectedEvent(null);
      await loadData(familyId);
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

  const filteredEvents = useMemo(() => {
    const eventsWithoutAI = events.filter((event) => {
      if (!event.family_member_ids || event.family_member_ids.length === 0) return true;
      const nonAIAssignments = event.family_member_ids.filter((id) => {
        const member = familyMembers.find((m) => m.id === id);
        return member && member.role !== "ai_assistant";
      });
      return nonAIAssignments.length > 0 || event.family_member_ids.length === 0;
    });

    const realFamilyMembersCount = familyMembers.filter((m) => m.role !== "ai_assistant").length;
    if (selectedMembers.length === realFamilyMembersCount) return eventsWithoutAI;

    return eventsWithoutAI.filter((event) => {
      if (!event.family_member_ids || event.family_member_ids.length === 0) return true;
      return event.family_member_ids.some((id) => selectedMembers.includes(id));
    });
  }, [events, selectedMembers, familyMembers]);

  // Helper: stable YYYY-MM-DD for a Date in the user's TZ
  const makeDayKey = (tz) => {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit"
    });
    return (d) => fmt.format(d); // e.g. "2025-10-06"
  };

  // Grab the user's tz once (profile → browser → UTC)
  const userTimezone =
    (typeof user !== "undefined" && (user.timezone || user.time_zone)) ||
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
