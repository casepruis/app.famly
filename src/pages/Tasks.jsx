
import React, { useState, useEffect, useMemo } from "react";
import { Task } from "@/api/entities";
import { FamilyMember } from "@/api/entities";
import { User } from "@/api/entities";
import { AnimatePresence, motion } from "framer-motion";
import { useSearchParams } from "react-router-dom";
import TaskCard from "../components/tasks/TaskCard";
import TaskForm from "../components/tasks/TaskForm";
import TaskFilters from "../components/tasks/TaskFilters";
import { useLanguage } from "@/components/common/LanguageProvider";
import { useToast } from "@/components/ui/use-toast";
import Joyride from "../components/common/Joyride";
import { CheckCircle2 } from "lucide-react"; // Added import
// --- at top of Tasks.jsx imports ---
import { InvokeLLM } from "@/api/integrations"; // ✅ NEW


export default function Tasks() {
  const [isInferring, setIsInferring] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [familyMembers, setFamilyMembers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingTask, setEditingTask] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [runTour, setRunTour] = useState(false);

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
    loadData();
    
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

  const loadData = async () => {
    setIsLoading(true);
    try {
      const user = await User.me();
      const familyId = user.family_id;
      const [tasksData, membersData] = await Promise.all([
        Task.filter({ family_id: familyId }, '-created_date', 200),
        FamilyMember.filter({ family_id: familyId })
      ]);
      setTasks(tasksData);
      setFamilyMembers(membersData);
    } catch (error) {
      console.error("Error loading tasks data:", error);
      toast({ title: "Error", description: "Failed to load tasks", variant: "destructive" , duration: 5000 });
    } finally {
        setIsLoading(false);
    }
  };

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
    const user = await User.me();
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
        } else {
          toast({
            title: t("task.dueDateNeededTitle") || "Due date needed",
            description: t("task.dueDateNeededDescription") || "Please pick a due date before saving.",
            duration: 5000 
          });
          setIsFormOpen(true);
          setEditingTask(taskData);
          return;
        }
      } else {
        toast({
          title: t("task.noDateDetectedTitle") || "No clear date detected",
          description: t("task.noDateDetectedDescription") || "Please set a due date so we can schedule this properly.",
          duration: 5000 
        });
        setIsFormOpen(true);
        setEditingTask(taskData);
        return;
      }
    }

    setIsSaving(true);
    if (editingTask) {
      await Task.update(editingTask.id, taskToSave);
      toast({ title: t("task.updatedTitle"), description: "Task updated", duration: 5000 });
    } else {
      await Task.create(taskToSave);  // backend now generates id
      toast({ title: t("task.createdTitle"), description: "Task created", duration: 5000  });
    }
    setIsSaving(false);

    setIsFormOpen(false);
    setEditingTask(null);
    loadData();
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
        loadData();
        toast({ title: t("task.deletedTitle") , duration: 5000 });
    } catch (error) {
        toast({ title: t("error"), description: t("task.deleteError"), variant: "destructive" , duration: 5000 });
    }
  };

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      const taskToUpdate = tasks.find(task => task.id === taskId);
      await Task.update(taskId, { ...taskToUpdate, status: newStatus });
      loadData();
      toast({ title: t("task.statusUpdatedTitle"), description: "Task updated", duration: 5000  });
    } catch (error) {
      toast({ title: t("error"), description: t("task.statusUpdateError"), variant: "destructive", duration: 5000  });
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
