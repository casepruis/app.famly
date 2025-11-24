
import React, { useState, useEffect, useMemo, useRef } from "react";
// --- WebSocket for real-time task updates ---
const useTaskWebSocket = (reload) => {
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
            data.type === 'task_created' || 
            data.type === 'task_updated' || 
            data.type === 'task_deleted')) {
            reload();
          }
        } catch {}
      };
    } catch {}
    return () => { try { ws && ws.close(); } catch {} };
  }, [reload]);
};
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
import { useFamilyData } from "@/hooks/FamilyDataContext";
import { AnimatePresence, motion } from "framer-motion";
import { useSearchParams } from "react-router-dom";
import TaskCard from "../components/tasks/TaskCard";
import TaskForm from "../components/tasks/TaskForm";
import TaskFilters from "../components/tasks/TaskFilters";
import { Task } from "@/api/entities";
import { useLanguage } from "@/components/common/LanguageProvider";
import { useToast } from "@/components/ui/use-toast";
import Joyride from "../components/common/Joyride";
import { CheckCircle2 } from "lucide-react"; // Added import
// --- at top of Tasks.jsx imports ---
import { InvokeLLM } from "@/api/integrations"; // ✅ NEW


function Tasks() {
  const [isInferring, setIsInferring] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [runTour, setRunTour] = useState(false);
  const { user, family, members: familyMembers, tasks, isLoading, error, reload } = useFamilyData();

  // --- where you have: const { t } = useLanguage();
  const { t, currentLanguage } = useLanguage(); // ✅ include currentLanguage

  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [filters, setFilters] = useState({
    status: searchParams.get('status') || 'all',
    assignee: searchParams.get('assignee') || 'all'
  });

    // --- add this helper inside the component (above handleSaveTask) or outside the component file ---
  const inferDueDateWithLLM = async (title, lang) => {
    if (!title || !title.trim()) return { due_date: null, confidence: 0, reason: "empty title" };

    const prompt = `You are a date normalizer.

  TODAY_IS: ${new Date().toISOString()}
  USER_LANGUAGE: ${lang}

  Task title (natural language): "${title}"

  Goal:
  - Extract a SINGLE, best-guess due date/time if it is clearly implied by the title.
  - If you are NOT confident (ambiguous or no date language), return null.
  - Assume user timezone Europe/Stockholm.
  - Use 24h time.
  - Return ISO-like format WITHOUT timezone: "YYYY-MM-DDTHH:MM:SS".
  - For vague dayparts, prefer:
    morning → 10:00, afternoon → 15:00, evening → 19:00
  - For words like "tomorrow", "morgen", pick the next calendar day at 17:00 if no daypart is given.
  - If a specific time is present, use it.

  Respond ONLY as JSON:
  {
    "due_date": "YYYY-MM-DDTHH:MM:SS" | null,
    "confidence": number,           // 0..1
    "normalized_title": "string",   // optional; cleaned title (same language as input)
    "reason": "string"
  }`;

    const schema = {
      type: "object",
      properties: {
        due_date: { anyOf: [{ type: "string" }, { type: "null" }] },
        confidence: { type: "number", minimum: 0, maximum: 1 },
        normalized_title: { type: "string" },
        reason: { type: "string" }
      },
      required: ["due_date", "confidence", "reason"]
    };

    const res = await InvokeLLM({
      prompt,
      system: `Respond ONLY with JSON matching the provided schema. Language-sensitive parsing should follow USER_LANGUAGE: ${lang}.`,
      response_json_schema: schema,
      strict: true,
      // temperature: 0.2,
    });

    const data = res?.data || {};
    return {
      due_date: data.due_date ?? null,
      confidence: typeof data.confidence === "number" ? data.confidence : 0,
      normalized_title: typeof data.normalized_title === "string" ? data.normalized_title : null,
      reason: typeof data.reason === "string" ? data.reason : ""
    };
  };


  const tasksTourSteps = useMemo(() => [
    { 
      target: '.tasks-list-container', 
      title: t('tasksTour.welcomeTitle'), 
      content: t('tasksTour.welcomeContent') 
    },
    { 
      target: '.task-filters-container', 
      title: t('tasksTour.filterTitle'), 
      content: t('tasksTour.filterContent') 
    },
    { 
      target: '#sidebar-members', 
      title: t('tasksTour.nextMembersTitle'), 
      content: t('tasksTour.nextMembersContent') 
    },
  ], [t]);

  useEffect(() => {
    const handleAction = (event) => {
      const { action } = event.detail;
      if (action === 'new') {
        setEditingTask(null);
        setIsFormOpen(true);
      } else if (action === 'tour') {
        setRunTour(true);
      }
    };

    window.addEventListener('actionTriggered', handleAction);

    // Also handle URL params on first load
    const action = searchParams.get('action');
    if (action === 'new') {
        setEditingTask(null);
        setIsFormOpen(true);
        setSearchParams({}); // Clear the action param after handling
    } else if (action === 'tour') {
        setRunTour(true);
        setSearchParams({}); // Clear the action param after handling
    }

    return () => {
      window.removeEventListener('actionTriggered', handleAction);
    };
  }, [searchParams]);
  // WebSocket for real-time task updates
  useTaskWebSocket(reload);

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
    const newSearchParams = new URLSearchParams();
    Object.entries(newFilters).forEach(([key, value]) => {
      if (key === 'status' && value !== 'all') {
        newSearchParams.set(key, value);
      } else if (key === 'assignee' && value !== 'all') {
        newSearchParams.set(key, value);
      }
    });
    setSearchParams(newSearchParams);
  };
  
  const handleSaveTask = async (taskData) => {
    try {
      if (!user) throw new Error("User not loaded");
      let taskToSave = { ...taskData, family_id: user.family_id };

      const noDateProvided = !taskToSave.due_date || String(taskToSave.due_date).trim() === "";
      if (!editingTask && noDateProvided && taskToSave.title) {
        setIsInferring(true);
        const { due_date, confidence, normalized_title } =
          await inferDueDateWithLLM(taskToSave.title, currentLanguage);
        setIsInferring(false);

        if (normalized_title && !taskToSave.title_locked) {
          taskToSave.title = normalized_title;
        }

        if (due_date && confidence >= 0.6) {
          const when = new Date(due_date.replace(" ", "T"));
          const whenDisplay = when.toLocaleString(currentLanguage, {
            weekday: "short", year: "numeric", month: "short", day: "numeric",
            hour: "2-digit", minute: "2-digit", hour12: false,
          });
          const ok = window.confirm(
            t("task.llmInferredDueDateConfirm", { when: whenDisplay }) ||
            `Use inferred due date "${whenDisplay}"?`
          );
          if (ok) {
            taskToSave.due_date = due_date;
          }
        }
        // If no due date is detected or user declines, just continue and allow saving without a due date
      }

      setIsSaving(true);
      let createdOrUpdatedTask = null;

      if (editingTask) {
        createdOrUpdatedTask = await Task.update(editingTask.id, taskToSave);
        toast({ title: t("task.updatedTitle"), description: "Task updated", duration: 5000 });
      } else {
        createdOrUpdatedTask = await Task.create(taskToSave);  // backend now generates id
        toast({ title: t("task.createdTitle"), description: "Task created", duration: 5000  });
      }

      // --- Actionable notification for assignees (toast + push) ---
      const assignees = Array.isArray(taskToSave.assigned_to) ? taskToSave.assigned_to : [];
      if (assignees.includes(user.id)) {
        let assignerName = user.name || "Someone";
        if (editingTask && editingTask.updated_by && editingTask.updated_by !== user.id) {
          assignerName = (familyMembers.find(m => m.id === editingTask.updated_by)?.name) || assignerName;
        }
        const notifTitle = t("task.assignedToYouTitle") || "New Task Assigned";
        const notifBody = `${assignerName} added a task for you: ${taskToSave.title}`;
        toast({ title: notifTitle, description: notifBody, duration: 5000 });
        // Push notification
        triggerPushNotification({
          title: notifTitle,
          body: notifBody,
          url: window.location.origin + createPageUrl ? createPageUrl('Tasks') : '/tasks',
        });
      }

      setIsSaving(false);

      setIsFormOpen(false);
      setEditingTask(null);
  // if (reload) await reload();
    } catch (error) {
      setIsInferring(false);
      setIsSaving(false);
      console.error("Error saving task:", error);
      toast({
        title: t("error"),
        description:
          (error && error.detail && (error.detail.detail || error.detail)) ||
          t("task.saveError"),
        variant: "destructive",
        duration: 5000 
      });
    }
  };

  
  const handleDeleteTask = async (taskId) => {
    try {
        await Task.delete(taskId);
  // if (reload) await reload();
        toast({ title: t("task.deletedTitle") , duration: 5000 });
    } catch (error) {
        toast({ title: t("error"), description: t("task.deleteError"), variant: "destructive" , duration: 5000 });
    }
  };

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      const taskToUpdate = tasks.find(task => task.id === taskId);
      // Only send the fields that are needed for the update
      await Task.update(taskId, { status: newStatus });
      reload();
      toast({ title: t("task.statusUpdatedTitle"), description: "Task updated", duration: 5000  });
    } catch (error) {
      console.error('Task status update error:', error);
      toast({ 
        title: t("error"), 
        description: error.message || t("task.statusUpdateError"), 
        variant: "destructive", 
        duration: 5000 
      });
    }
  };

  const handleEditTask = (task) => {
    setEditingTask(task);
    setIsFormOpen(true);
  };
  
  const handleTourComplete = () => {
    setRunTour(false);
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const statusMatch = filters.status === 'all' || task.status === filters.status;
      const assigneeMatch = filters.assignee === 'all' || (Array.isArray(task.assigned_to) && task.assigned_to.includes(filters.assignee));
      return statusMatch && assigneeMatch;
    });
  }, [tasks, filters]);

  if (isLoading) return <div className="p-6 text-center">{t('loading')}...</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto relative">
      {(isInferring || isSaving) && (
        <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center z-20">
          <div className="px-4 py-3 rounded-lg border bg-white shadow-sm text-sm">
            {isInferring
              ? (t('task.inferencingDueDate') || 'Analyzing task title…')
              : (t('task.savingTask') || 'Saving task…')}
          </div>
        </div>
      )}

      <Joyride steps={tasksTourSteps} run={runTour} onComplete={handleTourComplete} />

      <div className="task-filters-container mb-6">
        <TaskFilters
          filters={filters}
          onFilterChange={handleFilterChange}
          familyMembers={familyMembers}
        />
      </div>

      <div className="tasks-list-container space-y-4">
        <AnimatePresence>
          {filteredTasks.length > 0 ? (
            filteredTasks.map(task => (
              <motion.div
                key={task.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
              >
                <TaskCard
                  task={task}
                  familyMembers={familyMembers}
                  onEdit={handleEditTask}
                  onStatusChange={(taskToChange, status) => handleStatusChange(taskToChange.id, status)}
                  onDelete={() => handleDeleteTask(task.id)}
                />
              </motion.div>
            ))
          ) : (
            <div className="text-center py-20 text-gray-500">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{t('allClear')}</h3>
              <p className="text-sm">{t('noTasksMatchFilters')}</p>
            </div>
          )}
        </AnimatePresence>
      </div>

      <TaskForm
        isOpen={isFormOpen}
        onClose={() => { setIsFormOpen(false); setEditingTask(null); }}
        onSave={handleSaveTask}
        task={editingTask}
        familyMembers={familyMembers}
        busy={isInferring || isSaving}          // 👈 NEW
        inferring={isInferring}                 // optional: show specific copy
        saving={isSaving}                       // optional
      />

    </div>
  );
}

export default Tasks;

