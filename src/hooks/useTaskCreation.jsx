/**
 * useTaskCreation Hook
 * 
 * Unified task creation hook that provides consistent UX across all entry points:
 * - Dashboard UpcomingTasks "+" button
 * - Tasks page "+" button
 * - AI-suggested tasks from event creation
 * - Convert event to task flow
 * 
 * This hook standardizes:
 * - Task dialog state management
 * - AI inference for task details
 * - Task saving
 */

import { useState, useCallback } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { useLanguage } from '@/components/common/LanguageProvider';
import { useFamilyData } from '@/hooks/FamilyDataContext';
import { Task } from '@/api/entities';
import { InvokeLLMNormalized } from '@/api/integrations';

export function useTaskCreation() {
  const { user, family, members: familyMembers } = useFamilyData();
  const { t } = useLanguage();
  const { toast } = useToast();

  // Dialog states
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  
  // Task data states
  const [selectedTask, setSelectedTask] = useState(null);  // For editing existing task
  const [prefillData, setPrefillData] = useState(null);    // For new task with prefilled data
  
  // Loading states
  const [isInferring, setIsInferring] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Get family ID from context
  const familyId = family?.id || user?.family_id;

  /**
   * Open task dialog for creating a new task
   * @param {Object} prefill - Optional prefill data { title, description, due_date, assigned_to, etc. }
   */
  const openNewTaskDialog = useCallback((prefill = null) => {
    setSelectedTask(null);
    setPrefillData(prefill);
    setIsTaskDialogOpen(true);
  }, []);

  /**
   * Open task dialog for editing an existing task
   * @param {Object} task - The task to edit
   */
  const openEditTaskDialog = useCallback((task) => {
    setSelectedTask(task);
    setPrefillData(null);
    setIsTaskDialogOpen(true);
  }, []);

  /**
   * Close task dialog and reset state
   */
  const closeTaskDialog = useCallback(() => {
    setIsTaskDialogOpen(false);
    setSelectedTask(null);
    setPrefillData(null);
  }, []);

  /**
   * Infer task details using AI (category, priority, duration, points)
   * @param {string} title - Task title to analyze
   * @returns {Object} Inferred details
   */
  const inferTaskDetails = useCallback(async (title) => {
    if (!title || title.length < 3) return null;

    setIsInferring(true);

    try {
      const result = await InvokeLLMNormalized({
        prompt: `Analyze this task and suggest appropriate values:
Task: "${title}"

Provide:
- category: one of [personal, household, school, work, health, shopping, errands, family]
- priority: one of [low, medium, high]
- estimated_duration: minutes (15, 30, 60, 90, 120)
- points: gamification points (1-20 based on effort)`,
        response_json_schema: {
          type: "object",
          properties: {
            category: { type: "string" },
            priority: { type: "string" },
            estimated_duration: { type: "number" },
            points: { type: "number" }
          },
          required: ["category", "priority"]
        }
      });

      return {
        category: result.category || 'personal',
        priority: result.priority || 'medium',
        estimated_duration: result.estimated_duration || 30,
        points: result.points || 5
      };
    } catch (error) {
      console.error('🚨 [useTaskCreation] AI inference failed:', error);
      return null;
    } finally {
      setIsInferring(false);
    }
  }, []);

  /**
   * Save a task (create or update)
   * @param {Object} taskData - Task data to save
   */
  const saveTask = useCallback(async (taskData) => {
    if (!familyId) {
      toast({
        title: t('userNotLoaded') || 'User not loaded',
        description: t('pleaseWaitForUser') || 'Please wait before creating a task.',
        variant: 'destructive',
        duration: 5000
      });
      return null;
    }

    setIsSaving(true);

    try {
      const taskPayload = {
        ...taskData,
        family_id: familyId
      };

      let savedTask;
      
      if (selectedTask?.id) {
        // Update existing task
        console.log('🔄 [useTaskCreation] Updating task:', selectedTask.id);
        savedTask = await Task.update(selectedTask.id, taskPayload);
        
        toast({
          title: t('taskUpdated') || 'Task updated',
          description: taskData.title,
          variant: 'success',
          duration: 3000
        });
      } else {
        // Create new task
        console.log('🔄 [useTaskCreation] Creating task:', taskData.title);
        savedTask = await Task.create(taskPayload);
        
        toast({
          title: t('taskCreated') || 'Task created',
          description: taskData.title,
          variant: 'success',
          duration: 3000
        });
      }

      closeTaskDialog();
      return savedTask;

    } catch (error) {
      console.error('🚨 [useTaskCreation] Save error:', error);
      toast({
        title: t('errorSavingTask') || 'Error saving task',
        description: error.message,
        variant: 'destructive',
        duration: 5000
      });
      return null;
    } finally {
      setIsSaving(false);
    }
  }, [familyId, selectedTask, t, toast, closeTaskDialog]);

  /**
   * Create multiple tasks at once (for AI suggestions)
   * @param {Array} tasks - Array of task objects
   * @param {string} relatedEventId - Optional related event ID
   */
  const createBulkTasks = useCallback(async (tasks, relatedEventId = null) => {
    if (!familyId || !tasks?.length) return [];

    setIsSaving(true);

    try {
      const tasksPayload = tasks.map(task => ({
        ...task,
        family_id: familyId,
        status: 'todo',
        ai_suggested: true,
        related_event_id: relatedEventId
      }));

      console.log('🔄 [useTaskCreation] Bulk creating tasks:', tasksPayload.length);
      const createdTasks = await Task.bulkCreate(tasksPayload);

      toast({
        title: t('tasksCreated') || 'Tasks created',
        description: `${tasks.length} task(s) added`,
        variant: 'success',
        duration: 3000
      });

      return createdTasks;

    } catch (error) {
      console.error('🚨 [useTaskCreation] Bulk create error:', error);
      toast({
        title: t('errorCreatingTasks') || 'Error creating tasks',
        description: error.message,
        variant: 'destructive',
        duration: 5000
      });
      return [];
    } finally {
      setIsSaving(false);
    }
  }, [familyId, t, toast]);

  /**
   * Delete a task
   * @param {Object} task - Task to delete
   */
  const deleteTask = useCallback(async (task) => {
    if (!window.confirm(t('confirmDeleteTask') || 'Delete this task?')) {
      return false;
    }

    try {
      await Task.delete(task.id);
      
      toast({
        title: t('taskDeleted') || 'Task deleted',
        description: task.title,
        variant: 'success',
        duration: 3000
      });

      closeTaskDialog();
      return true;

    } catch (error) {
      console.error('🚨 [useTaskCreation] Delete error:', error);
      toast({
        title: t('errorDeletingTask') || 'Error deleting task',
        description: error.message,
        variant: 'destructive',
        duration: 5000
      });
      return false;
    }
  }, [t, toast, closeTaskDialog]);

  /**
   * Toggle task completion status
   * @param {Object} task - Task to toggle
   */
  const toggleTaskComplete = useCallback(async (task) => {
    try {
      const newStatus = task.status === 'completed' ? 'todo' : 'completed';
      await Task.update(task.id, { status: newStatus });

      toast({
        title: newStatus === 'completed' 
          ? (t('taskCompleted') || 'Task completed') 
          : (t('taskReopened') || 'Task reopened'),
        description: task.title,
        duration: 2000
      });

      return true;

    } catch (error) {
      console.error('🚨 [useTaskCreation] Toggle error:', error);
      toast({
        title: t('errorUpdatingTask') || 'Error updating task',
        description: error.message,
        variant: 'destructive',
        duration: 5000
      });
      return false;
    }
  }, [t, toast]);

  return {
    // Dialog states
    isTaskDialogOpen,
    
    // Task data
    selectedTask,
    prefillData,
    
    // Loading states
    isInferring,
    isSaving,
    
    // Context data
    familyMembers,
    familyId,
    
    // Actions
    openNewTaskDialog,
    openEditTaskDialog,
    closeTaskDialog,
    inferTaskDetails,
    saveTask,
    createBulkTasks,
    deleteTask,
    toggleTaskComplete,
    
    // Direct setters for advanced use cases
    setIsTaskDialogOpen,
    setSelectedTask,
    setPrefillData,
  };
}

export default useTaskCreation;
