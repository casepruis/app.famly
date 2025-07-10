
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

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [familyMembers, setFamilyMembers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingTask, setEditingTask] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [runTour, setRunTour] = useState(false);

  const { t } = useLanguage();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [filters, setFilters] = useState({
    status: searchParams.get('status') || 'all',
    assignee: searchParams.get('assignee') || 'all'
  });

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
      toast({ title: "Error", description: "Failed to load tasks", variant: "destructive" });
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

        if (editingTask) {
            await Task.update(editingTask.id, taskToSave);
            toast({ title: t("task.updatedTitle") });
        } else {
            await Task.create(taskToSave);
            toast({ title: t("task.createdTitle") });
        }
        setIsFormOpen(false);
        setEditingTask(null);
        loadData();
    } catch (error) {
        console.error("Error saving task:", error);
        toast({ title: t("error"), description: t("task.saveError"), variant: "destructive" });
    }
  };
  
  const handleDeleteTask = async (taskId) => {
    try {
        await Task.delete(taskId);
        loadData();
        toast({ title: t("task.deletedTitle") });
    } catch (error) {
        toast({ title: t("error"), description: t("task.deleteError"), variant: "destructive" });
    }
  };

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      const taskToUpdate = tasks.find(task => task.id === taskId);
      await Task.update(taskId, { ...taskToUpdate, status: newStatus });
      loadData();
      toast({ title: t("task.statusUpdatedTitle") });
    } catch (error) {
      toast({ title: t("error"), description: t("task.statusUpdateError"), variant: "destructive" });
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
    <div className="p-6 max-w-4xl mx-auto">
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
      />
    </div>
  );
}
