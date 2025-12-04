// src/api/aiAgent.js
import { fetchWithAuth } from './entities';

export const AIAgent = {
  /**
   * Chat with the agent system (routes through RootAgent to specialist agents)
   * @param {string} familyId - Family ID
   * @param {string} message - User message
   * @param {string} conversationId - Optional conversation ID for multi-turn
   * @param {string} language - User's preferred language (e.g., 'nl', 'en')
   * @returns {Promise<{agent: string, message: string, suggestions: array, tool_calls: array, requires_confirmation: boolean}>}
   */
  chat: async (familyId, message, { conversationId = null, language = 'en' } = {}) => {
    console.log('🤖 [AI-AGENT] chat called with:', { familyId, message: message.substring(0, 50), language });
    
    if (!familyId) {
      throw new Error('familyId is required for agent chat');
    }
    
    try {
      const result = await fetchWithAuth(`/agents/chat/${familyId}`, {
        method: 'POST',
        body: JSON.stringify({
          message,
          conversation_id: conversationId,
          language // Pass language preference to backend
        })
      });
      
      console.log('🤖 [AI-AGENT] chat response:', result);
      return result;
    } catch (error) {
      console.error('🚨 [AI-AGENT] chat failed:', error);
      throw error;
    }
  },

  /**
   * Chat directly with a specific agent (bypassing root routing)
   */
  chatWithAgent: async (familyId, agentName, message, { conversationId = null, language = 'en' } = {}) => {
    console.log('🤖 [AI-AGENT] chatWithAgent called:', { familyId, agentName, message: message.substring(0, 50) });
    
    try {
      const result = await fetchWithAuth(`/agents/chat/${familyId}/${agentName}`, {
        method: 'POST',
        body: JSON.stringify({
          message,
          conversation_id: conversationId,
          language
        })
      });
      
      console.log('🤖 [AI-AGENT] chatWithAgent response:', result);
      return result;
    } catch (error) {
      console.error('🚨 [AI-AGENT] chatWithAgent failed:', error);
      throw error;
    }
  },

  /**
   * Get proactive suggestions from all agents
   */
  getSuggestions: async (familyId) => {
    console.log('🤖 [AI-AGENT] getSuggestions called for family:', familyId);
    return await fetchWithAuth(`/agents/suggestions/${familyId}`);
  },

  /**
   * Get agent system status
   */
  getAgentStatus: async () => {
    return await fetchWithAuth('/agents/status');
  },

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