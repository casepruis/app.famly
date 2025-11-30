// src/services/eventCreationService.js
import { InvokeLLMNormalized } from "@/api/integrations";
import { AIAgent } from "@/api/aiAgent";

/**
 * Shared event creation service with AI processing
 * Used by both Schedule page and Dashboard components
 */
export class EventCreationService {
  constructor(familyId, familyMembers = []) {
    this.familyId = familyId;
    this.familyMembers = familyMembers;
  }

  /**
   * Process and save an event with AI suggestions and planning insights
   */
  async processAndSaveEvent(eventData, editType = "single") {
    console.log('🔄 [EVENT-SERVICE] Processing event:', eventData?.title);
    
    try {
      // FIRST: Save the event to the database
      console.log('🔄 [EVENT-SERVICE] Saving event to database first...');
      const { ScheduleEvent } = await import("@/api/entities");
      const savedEvent = await ScheduleEvent.create(eventData);
      console.log('🔄 [EVENT-SERVICE] Event saved with ID:', savedEvent?.id);
      
      // SECOND: Generate AI task suggestions
      console.log('🔄 [EVENT-SERVICE] Starting AI task generation...');
      
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

      console.log('🔄 [EVENT-SERVICE] LLM response:', llm);

      const normalizedSuggestedTasks = (llm.suggestedTasks || []).map((t) =>
        typeof t === "string" ? { title: t } : t
      );
      
      console.log('🔄 [EVENT-SERVICE] Normalized tasks:', normalizedSuggestedTasks);

      // Fetch planning insights from AI agent
      let planningInsights = [];
      try {
        console.log('🤖 [EVENT-SERVICE] Fetching planning insights...');
        console.log('🤖 [EVENT-SERVICE] familyId:', this.familyId);
        console.log('🤖 [EVENT-SERVICE] AIAgent available?', typeof AIAgent?.analyzeEvent);
        
        if (!this.familyId) {
          throw new Error('familyId is required for AI analysis');
        }

        const eventDataForAnalysis = {
          title: savedEvent.title,
          description: savedEvent.description,
          start_time: savedEvent.start_time,
          end_time: savedEvent.end_time,
          family_member_ids: savedEvent.family_member_ids,
          category: savedEvent.category
        };
        
        console.log('🤖 [EVENT-SERVICE] Calling AIAgent.analyzeEvent with data:', eventDataForAnalysis);
        
        // Longer delay to ensure event is fully indexed in database
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const aiAnalysis = await AIAgent.analyzeEvent(this.familyId, eventDataForAnalysis);
        console.log('🤖 [EVENT-SERVICE] AI analysis response:', aiAnalysis);
        planningInsights = aiAnalysis?.insights || [];
        console.log('🤖 [EVENT-SERVICE] Planning insights:', planningInsights.length);
        
      } catch (planningError) {
        console.error('🚨 [EVENT-SERVICE] Planning insights failed:', planningError);
        // Continue without planning insights
      }

      // Prepare review payload with saved event data
      const reviewPayload = {
        originalEvent: {
          ...savedEvent,
          short_title: savedEvent.short_title || llm.short_title || savedEvent.title
        },
        aiResult: {
          ...llm,
          suggestedTasks: normalizedSuggestedTasks
        },
        planningInsights: planningInsights,
        initialData: null,
        editType,
        isNew: true
      };

      console.log('🔄 [EVENT-SERVICE] Review payload prepared:', {
        eventId: savedEvent?.id,
        tasks: normalizedSuggestedTasks.length,
        insights: planningInsights.length,
        aiResult: reviewPayload.aiResult
      });

      return reviewPayload;

    } catch (err) {
      console.error("🚨 [EVENT-SERVICE] Processing failed:", err);
      
      // Return simple payload without AI processing
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
   * Simple event save without AI processing (fallback)
   */
  async saveEventDirectly(eventData) {
    console.log('🔄 [EVENT-SERVICE] Direct save:', eventData?.title);
    
    try {
      const { ScheduleEvent } = await import("@/api/entities");
      await ScheduleEvent.create(eventData);
      return { success: true };
    } catch (error) {
      console.error('🚨 [EVENT-SERVICE] Direct save failed:', error);
      throw error;
    }
  }
}

/**
 * Factory function to create event service instance
 */
export function createEventService(familyId, familyMembers = []) {
  return new EventCreationService(familyId, familyMembers);
}