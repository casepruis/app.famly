/**
 * useEventCreation Hook
 * 
 * Unified event creation hook that provides consistent UX across all entry points:
 * - Dashboard calendar click
 * - Dashboard UpcomingEvents "+" button
 * - Schedule page calendar click
 * - Schedule page "+" button
 * 
 * This hook standardizes:
 * - Event dialog state management
 * - AI processing flow
 * - Review dialog with task suggestions
 * - Event saving with related tasks
 */

import { useState, useCallback } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { useLanguage } from '@/components/common/LanguageProvider';
import { useFamilyData } from '@/hooks/FamilyDataContext';
import { ScheduleEvent, Task } from '@/api/entities';
import { createEventService } from '@/services/eventCreationService';

export function useEventCreation() {
  const { user, family, members: familyMembers } = useFamilyData();
  const { t, currentLanguage } = useLanguage();
  const { toast } = useToast();

  // Dialog states
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  
  // Event data states
  const [selectedEvent, setSelectedEvent] = useState(null);        // For editing existing event
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(null);  // For creating new event with prefilled time
  const [reviewData, setReviewData] = useState(null);              // AI review data
  
  // Loading states
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Get family ID from context
  const familyId = family?.id || user?.family_id;

  /**
   * Open event dialog for creating a new event
   * @param {Date} date - Optional date to prefill
   * @param {number} hour - Optional hour to prefill (0-23)
   * @param {string} memberId - Optional member ID to preselect
   */
  const openNewEventDialog = useCallback((date = null, hour = null, memberId = null) => {
    setSelectedEvent(null);
    setSelectedTimeSlot(date ? { date, hour: hour ?? 9 } : null);
    setIsEventDialogOpen(true);
  }, []);

  /**
   * Open event dialog for editing an existing event
   * @param {Object} event - The event to edit
   */
  const openEditEventDialog = useCallback((event) => {
    setSelectedEvent(event);
    setSelectedTimeSlot(null);
    setIsEventDialogOpen(true);
  }, []);

  /**
   * Close event dialog and reset state
   */
  const closeEventDialog = useCallback(() => {
    setIsEventDialogOpen(false);
    setSelectedEvent(null);
    setSelectedTimeSlot(null);
  }, []);

  /**
   * Close review dialog
   */
  const closeReviewDialog = useCallback(() => {
    setIsReviewDialogOpen(false);
    setReviewData(null);
  }, []);

  /**
   * Process event save - handles both new and edit flows
   * This is called from EventDialog's onSave
   * 
   * @param {Object} eventData - Event data from dialog
   * @param {Object} aiResult - Optional AI result (for edits that already have AI analysis)
   * @param {string} editType - "single" or "series" for recurring events
   */
  const processEventSave = useCallback(async (eventData, aiResult = null, editType = "single") => {
    if (!familyId) {
      toast({
        title: t('userNotLoaded') || 'User not loaded',
        description: t('pleaseWaitForUser') || 'Please wait for your user to load before creating an event.',
        variant: 'destructive',
        duration: 5000
      });
      return;
    }

    setIsProcessing(true);

    try {
      const isEditing = selectedEvent?.id;
      
      // Prepare event data with family context
      const eventToProcess = {
        ...eventData,
        family_id: familyId,
        language: currentLanguage
      };

      if (isEditing) {
        // Update existing event
        console.log('🔄 [useEventCreation] Updating event:', selectedEvent.id);
        await ScheduleEvent.update(selectedEvent.id, eventToProcess);
        
        toast({
          title: t('eventUpdated') || 'Event updated',
          description: eventData.title,
          variant: 'success',
          duration: 5000
        });
        
        closeEventDialog();
        
      } else {
        // New event - use event service for AI processing
        console.log('🔄 [useEventCreation] Creating new event with AI processing');
        
        const eventService = createEventService(familyId, familyMembers);
        const reviewPayload = await eventService.processAndSaveEvent(eventToProcess, editType);
        
        // Store initial data for potential updates
        reviewPayload.initialData = selectedEvent;
        
        setReviewData(reviewPayload);
        closeEventDialog();

        // Check if we have suggestions or insights to review
        const hasSuggestions = reviewPayload.aiResult?.suggestedTasks?.length > 0;
        const hasInsights = reviewPayload.planningInsights?.length > 0;

        if (hasSuggestions || hasInsights) {
          console.log('🔍 [useEventCreation] Opening review dialog:', {
            tasks: reviewPayload.aiResult?.suggestedTasks?.length || 0,
            insights: reviewPayload.planningInsights?.length || 0
          });
          setIsReviewDialogOpen(true);
        } else {
          // No suggestions, just show success toast
          toast({
            title: t('eventCreated') || 'Event created',
            description: eventData.title,
            variant: 'success',
            duration: 5000
          });
        }
      }
      
    } catch (error) {
      console.error('🚨 [useEventCreation] Error:', error);
      toast({
        title: t('errorSavingEvent') || 'Error saving event',
        description: error.message,
        variant: 'destructive',
        duration: 5000
      });
    } finally {
      setIsProcessing(false);
    }
  }, [familyId, familyMembers, selectedEvent, currentLanguage, t, toast, closeEventDialog]);

  /**
   * Confirm save from review dialog (with selected tasks)
   * 
   * @param {Object} finalEventData - The final event data (may be modified)
   * @param {Array} tasksToCreate - Array of task objects to create
   * @param {string} editType - "single" or "series"
   */
  const confirmWithTasks = useCallback(async (finalEventData, tasksToCreate = [], editType = "single") => {
    setIsSaving(true);

    try {
      console.log('🔍 [useEventCreation] Confirming with tasks:', tasksToCreate?.length || 0);

      // Create selected tasks
      if (tasksToCreate && tasksToCreate.length > 0) {
        const tasksPayload = tasksToCreate.map(task => ({
          ...task,
          family_id: familyId,
          status: 'todo',
          ai_suggested: true,
          related_event_id: finalEventData.id || reviewData?.originalEvent?.id
        }));

        console.log('🔍 [useEventCreation] Creating tasks:', tasksPayload.length);
        await Task.bulkCreate(tasksPayload);

        toast({
          title: t('tasksCreated') || 'Tasks Created',
          description: `${tasksToCreate.length} task(s) added to your list`,
          duration: 3000
        });
      }

      // Show final success message
      toast({
        title: t('eventCreated') || 'Event created',
        description: finalEventData.title || reviewData?.originalEvent?.title,
        variant: 'success',
        duration: 5000
      });

      closeReviewDialog();

    } catch (error) {
      console.error('🚨 [useEventCreation] Error creating tasks:', error);
      toast({
        title: t('errorCreatingTasks') || 'Error creating tasks',
        description: error.message,
        variant: 'destructive',
        duration: 5000
      });
    } finally {
      setIsSaving(false);
    }
  }, [familyId, reviewData, t, toast, closeReviewDialog]);

  /**
   * Skip review and just close (tasks not created)
   */
  const skipReview = useCallback(() => {
    toast({
      title: t('eventCreated') || 'Event created',
      description: reviewData?.originalEvent?.title,
      variant: 'success',
      duration: 5000
    });
    closeReviewDialog();
  }, [reviewData, t, toast, closeReviewDialog]);

  /**
   * Delete an event
   * @param {Object} event - Event to delete
   * @param {boolean} deleteSeries - If true, delete entire recurring series
   */
  const deleteEvent = useCallback(async (event, deleteSeries = false) => {
    if (!window.confirm(t('confirmDeleteEvent') || 'Delete this event?')) {
      return false;
    }

    try {
      if (deleteSeries && event.recurrence_id) {
        // Delete all events in the series
        const seriesEvents = await ScheduleEvent.filter({ recurrence_id: event.recurrence_id });
        for (const ev of seriesEvents) {
          await ScheduleEvent.delete(ev.id);
        }
        toast({
          title: t('seriesDeleted') || 'Series deleted',
          description: event.title,
          variant: 'success',
          duration: 5000
        });
      } else {
        await ScheduleEvent.delete(event.id);
        toast({
          title: t('eventDeleted') || 'Event deleted',
          description: event.title,
          variant: 'success',
          duration: 5000
        });
      }
      
      closeEventDialog();
      return true;
      
    } catch (error) {
      console.error('🚨 [useEventCreation] Delete error:', error);
      toast({
        title: t('errorDeletingEvent') || 'Error deleting event',
        description: error.message,
        variant: 'destructive',
        duration: 5000
      });
      return false;
    }
  }, [t, toast, closeEventDialog]);

  return {
    // Dialog states
    isEventDialogOpen,
    isReviewDialogOpen,
    
    // Event data
    selectedEvent,
    selectedTimeSlot,
    reviewData,
    
    // Loading states
    isProcessing,
    isSaving,
    
    // Context data (for passing to dialogs)
    familyMembers,
    familyId,
    
    // Actions
    openNewEventDialog,
    openEditEventDialog,
    closeEventDialog,
    closeReviewDialog,
    processEventSave,
    confirmWithTasks,
    skipReview,
    deleteEvent,
    
    // Direct setters for advanced use cases
    setIsEventDialogOpen,
    setSelectedEvent,
    setSelectedTimeSlot,
  };
}

export default useEventCreation;
