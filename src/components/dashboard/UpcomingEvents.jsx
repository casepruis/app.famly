
import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, ArrowRight, Briefcase, GraduationCap, Heart, Stethoscope, Coffee, Home, Info, Cake } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import EventDialog from "@/components/schedule/EventDialog";
import AIReviewDialog from "@/components/schedule/AIReviewDialog";
import { createEventService } from "@/services/eventCreationService";
import { ScheduleEvent } from "@/api/entities";
import { useToast } from "@/components/ui/use-toast";
import { useLanguage } from "@/components/common/LanguageProvider";

const getEventAppearance = (event) => {
  if (event.event_type === 'birthday') {
    return {
      Icon: Cake,
      color: '#ec4899', // pink-500
    };
  }

  const appearances = {
    school: { Icon: GraduationCap, color: '#3b82f6' }, // blue-500
    work: { Icon: Briefcase, color: '#8b5cf6' }, // violet-500
    sports: { Icon: Heart, color: '#22c55e' }, // green-500
    medical: { Icon: Stethoscope, color: '#ef4444' }, // red-500
    social: { Icon: Coffee, color: '#ec4899' }, // pink-500
    family: { Icon: Home, color: '#f97316' }, // orange-500
    other: { Icon: Info, color: '#6b7280' }, // gray-500
  };

  return appearances[event.category] || appearances.other;
};

export default function UpcomingEvents({ events, familyMembers }) {
  const [showDialog, setShowDialog] = useState(false);
  const [dialogData, setDialogData] = useState(null);
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const [reviewData, setReviewData] = useState(null);
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { toast } = useToast();
  // Try to get reload from window context (Dashboard passes it via FamilyDataContext)
  const reload = (window.__famly_reload || (() => {}));

  const handleAddEvent = () => {
    // Prefill with today's date for new event, and ensure no id property is present
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const start_time = `${year}-${month}-${day}T09:00:00`;
    const end_time = `${year}-${month}-${day}T10:00:00`;
    setDialogData({ start_time, end_time }); // no id property
    setShowDialog(true);
  };
  const handleDialogClose = () => setShowDialog(false);
  
  const handleDialogSave = async (eventData, aiResult, editType) => {
    try {
      // Get user and family context
      const user = JSON.parse(localStorage.getItem("famlyai_user"));
      if (!user) throw new Error("User not loaded");
      
      const eventToSave = { ...eventData, family_id: user.family_id };
      
      console.log('🔄 [DASHBOARD] Processing event with AI:', eventToSave.title);
      console.log('🔄 [DASHBOARD] AI result provided?', !!aiResult);
      
      let reviewPayload;
      
      if (aiResult) {
        // Event was edited in dialog, already has AI analysis
        console.log('🔄 [DASHBOARD] Using existing AI analysis from dialog');
        reviewPayload = {
          originalEvent: eventToSave,
          aiResult: aiResult,
          planningInsights: [], // Dialog doesn't generate insights
          type: 'event',
          isNew: !eventData.id
        };
        
        // Still need to save the event
        const savedEvent = await ScheduleEvent.create(eventToSave);
        reviewPayload.originalEvent = savedEvent;
      } else {
        // New event - use shared event service for full AI processing
        console.log('🔄 [DASHBOARD] Using event service for full AI processing');
        const eventService = createEventService(user.family_id, familyMembers);
        reviewPayload = await eventService.processAndSaveEvent(eventToSave);
      }
      
      console.log('🔄 [DASHBOARD] Event processing completed, payload:', reviewPayload);
      
      setReviewData(reviewPayload);
      setShowDialog(false);

      // Show review dialog if there are suggestions or insights
      const hasSuggestions = reviewPayload.aiResult?.suggestedTasks?.length > 0;
      const hasInsights = reviewPayload.planningInsights?.length > 0;
      
      if (hasSuggestions || hasInsights) {
        console.log('🔍 [DASHBOARD] Opening review dialog with:', {
          tasks: reviewPayload.aiResult?.suggestedTasks?.length || 0,
          insights: reviewPayload.planningInsights?.length || 0
        });
        setIsReviewDialogOpen(true);
      } else {
        console.log('🔍 [DASHBOARD] No suggestions, proceeding to direct save');
        handleConfirmSave(reviewPayload.originalEvent, []);
      }
      
    } catch (err) {
      console.error('🚨 [DASHBOARD] Event processing failed:', err);
      console.error('🚨 [DASHBOARD] Error details:', err.message, err.stack);
      toast({ 
        title: t("errorSavingEvent") || "Error saving event", 
        description: err.message, 
        variant: "destructive", 
        duration: 5000 
      });
    }
  };

  const handleConfirmSave = async (finalEventData, tasksToCreate) => {
    try {
      console.log('🔍 [DASHBOARD] Final save with tasks:', tasksToCreate?.length || 0);
      
      // Save the event
      await ScheduleEvent.create(finalEventData);
      
      // Save tasks if any
      if (tasksToCreate && tasksToCreate.length > 0) {
        const { Task } = await import("@/api/entities");
        for (const task of tasksToCreate) {
          await Task.create({
            ...task,
            family_id: finalEventData.family_id
          });
        }
      }

      toast({ 
        title: t("eventCreated") || "Event created", 
        description: finalEventData.title, 
        duration: 5000 
      });
      
      if (typeof reload === "function") reload();
      setIsReviewDialogOpen(false);
      
    } catch (err) {
      console.error('🚨 [DASHBOARD] Final save failed:', err);
      toast({ 
        title: t("errorSavingEvent") || "Error saving event", 
        description: err.message, 
        variant: "destructive", 
        duration: 5000 
      });
    }
  };
  const handleDialogDelete = () => setShowDialog(false);

  return (
    <Card id="upcoming-events-card" className="h-full">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
    <div className="flex items-center gap-2">
      <Calendar className="w-4 h-4 text-gray-400" />
      <span className="text-sm font-medium text-gray-600">{t('upcomingEvents')}</span>
    </div>

    <Button
      variant="outline"
      size="icon"
      className="h-6 w-6 p-0 border-blue-200 text-blue-600 hover:bg-blue-50"
      onClick={handleAddEvent}
    >
      +
    </Button>
  </div>

  
  <div className="space-y-3">
          {events.length > 0 ? (
            events.map(event => {
              const { Icon, color } = getEventAppearance(event);
              
              const isAllFamilyEvent = !event.family_member_ids || event.family_member_ids.length === 0 || (familyMembers.length > 0 && event.family_member_ids.length === familyMembers.length);

              const assignee = !isAllFamilyEvent
                ? familyMembers.find(m => m.id === event.family_member_ids[0])
                : null;

              return (
                <div key={event.id} className="flex items-start gap-3 p-2 rounded-lg transition-colors hover:bg-gray-50/50">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${isAllFamilyEvent ? '#64748b' : color}1A`, color: isAllFamilyEvent ? '#64748b' : color }}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-800 break-words">{event.title}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                      <span>{format(parseISO(event.start_time), 'MMM d, p')}</span>
                      {isAllFamilyEvent ? (
                          <>
                            <span className="text-gray-300">•</span>
                            <div className="flex items-center gap-1">
                               <Home className="w-3 h-3 text-gray-400" />
                               <span className="break-words">{t('allFamily')}</span>
                            </div>
                          </>
                      ) : assignee && (
                        <>
                          <span className="text-gray-300">•</span>
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: assignee.color }}/>
                            <span className="break-words">{assignee.name}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-center text-gray-500 py-4">{t('noUpcomingEvents')}</p>
          )}
        </div>
        <div className="flex gap-2 mt-4">
          <Button variant="ghost" size="sm" className="w-full text-blue-600 hover:text-blue-700" onClick={() => navigate(createPageUrl('Schedule'))}>
            {t('viewFullSchedule')} <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
          
        </div>
      </CardContent>
      
      {/* Event Creation Dialog */}
      {showDialog && (
        <EventDialog
          isOpen={showDialog}
          onClose={handleDialogClose}
          onSave={handleDialogSave}
          onDelete={handleDialogDelete}
          initialData={dialogData}
          familyMembers={familyMembers}
        />
      )}

      {/* AI Review Dialog */}
      {isReviewDialogOpen && reviewData && (
        <AIReviewDialog
          isOpen={isReviewDialogOpen}
          onClose={() => setIsReviewDialogOpen(false)}
          onConfirm={handleConfirmSave}
          reviewData={reviewData}
        />
      )}
    </Card>
  );
}
