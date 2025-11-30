// src/api/aiAgent.js
import { fetchWithAuth } from './entities';

export const AIAgent = {
  // Analyze a new event for insights and task suggestions  
  analyzeEvent: async (familyId, eventData) => {
    console.log('🤖 [AI-AGENT] analyzeEvent called with:', {
      familyId,
      eventData
    });
    
    if (!familyId) {
      throw new Error('familyId is required for AI analysis');
    }
    
    try {
      console.log('🤖 [AI-AGENT] Making API call to:', `/ai-agent/analyze-event/${familyId}`);
      console.log('🤖 [AI-AGENT] Request body:', JSON.stringify(eventData));
      
      const result = await fetchWithAuth(`/ai-agent/analyze-event/${familyId}`, {
        method: 'POST',
        body: JSON.stringify(eventData)
      });
      
      console.log('🤖 [AI-AGENT] API response received:', result);
      return result;
    } catch (error) {
      console.error('🚨 [AI-AGENT] API call failed:', error);
      console.error('🚨 [AI-AGENT] Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      throw error;
    }
  },

  // Quick analysis of family schedule
  quickAnalyze: async (familyId, { daysAhead = 7, analysisType = 'problems' } = {}) => {
    const params = new URLSearchParams({ 
      days_ahead: daysAhead.toString(),
      analysis_type: analysisType 
    });
    return await fetchWithAuth(`/ai-agent/quick-analyze/${familyId}?${params}`);
  },

  // Get AI agent status
  getStatus: async () => {
    return await fetchWithAuth('/ai-agent/status');
  }
};