// src/services/eventCreationService.js
import { AIAgent } from "@/api/aiAgent";

/**
 * Shared event creation service
 * 
 * IMPORTANT: Frontend NEVER calls LLM directly.
 * All AI processing happens on the backend via AIAgent API.
 */
export class EventCreationService {
  constructor(familyId, familyMembers = []) {
    this.familyId = familyId;
    this.familyMembers = familyMembers;
  }

  /**
   * Process and save an event with AI suggestions
   * Makes ONE backend call that:
   * 1. Saves the event
   * 2. Generates task suggestions
   * 3. Returns planning insights
   */
  async processAndSaveEvent(eventData, editType = "single") {
    try {
      // FIRST: Save the event to the database
      const { ScheduleEvent } = await import("@/api/entities");
      const savedEvent = await ScheduleEvent.create(eventData);
      
      // SECOND: Call backend AI agent for analysis (ONE call for everything)
      let aiResult = { suggestedTasks: [] };
      let planningInsights = [];
      
      if (this.familyId) {
        try {
          const analysis = await AIAgent.analyzeEvent(this.familyId, {
            title: savedEvent.title,
            description: savedEvent.description,
            start_time: savedEvent.start_time,
            end_time: savedEvent.end_time,
            family_member_ids: savedEvent.family_member_ids,
            category: savedEvent.category
          });
          
          // Extract suggested tasks from backend response
          aiResult.suggestedTasks = (analysis?.suggested_tasks || []).map(t => 
            typeof t === "string" ? { title: t } : t
          );
          aiResult.aiMessage = analysis?.summary;
          
          // Extract planning insights
          planningInsights = analysis?.insights || [];
          
        } catch (aiError) {
          console.warn('[EventService] AI analysis failed:', aiError.message);
        }
      }

      // Prepare review payload
      return {
        originalEvent: savedEvent,
        aiResult,
        planningInsights,
        initialData: null,
        editType,
        isNew: true
      };

    } catch (err) {
      console.error("[EventService] Processing failed:", err);
      
      return {
        originalEvent: eventData,
        aiResult: { suggestedTasks: [] },
        planningInsights: [],
        initialData: null,
        editType,
        error: err.message
      };
    }
  }

  /**
   * Simple event save without AI processing
   */
  async saveEventDirectly(eventData) {
    const { ScheduleEvent } = await import("@/api/entities");
    await ScheduleEvent.create(eventData);
    return { success: true };
  }
}

/**
 * Factory function to create event service instance
 */
export function createEventService(familyId, familyMembers = []) {
  return new EventCreationService(familyId, familyMembers);
}