// src/components/agent/PlanningAgentInsights.jsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, AlertTriangle, Lightbulb, CheckCircle, X, Calendar, Users, MapPin, Plus } from 'lucide-react';
import { useFamilyData } from '../../hooks/FamilyDataContext';
import { Task, ScheduleEvent } from '../../api/entities';

const PlanningAgentInsights = ({ familyId, analysisType = 'full', analysisWindowWeeks = 8, daysAhead = 56 }) => {
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  
  const { familyData } = useFamilyData();

  const analyzeSchedule = async (type = 'full') => {
    if (!familyId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const endpoint = type === 'problems' ? 
        `/agent/analyze/${familyId}/quick?days_ahead=${daysAhead}&analysis_type=${type}` :
        `/agent/analyze/${familyId}`;
      
      const requestBody = type !== 'problems' ? {
        family_id: familyId,
        analysis_type: type,
        analysis_window_weeks: analysisWindowWeeks,
        date_range_start: new Date().toISOString(),
        date_range_end: new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString()
      } : null;
      
      const API_BASE = (import.meta?.env?.VITE_API_BASE) || "/api";
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: type === 'problems' ? 'GET' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: requestBody ? JSON.stringify(requestBody) : null,
      });
      
      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.statusText}`);
      }
      
      const result = await response.json();
      setAnalysisResult(result);
      setInsights(result.insights || []);
    } catch (err) {
      console.error('Agent analysis error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const dismissInsight = async (insightId) => {
    try {
      const API_BASE = (import.meta?.env?.VITE_API_BASE) || "/api";
      await fetch(`${API_BASE}/agent/insights/${insightId}/dismiss`, {
        method: 'PATCH',
      });
      
      // Remove from local state
      setInsights(prev => prev.filter(insight => insight.id !== insightId));
    } catch (err) {
      console.error('Failed to dismiss insight:', err);
    }
  };

  const resolveInsight = async (insightId, feedback = null) => {
    try {
      const API_BASE = (import.meta?.env?.VITE_API_BASE) || "/api";
      const response = await fetch(`${API_BASE}/agent/insights/${insightId}/resolve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback }),
      });
      
      if (response.ok) {
        // Remove from local state
        setInsights(prev => prev.filter(insight => insight.id !== insightId));
      }
    } catch (err) {
      console.error('Failed to resolve insight:', err);
    }
  };

  const executeAction = async (action, insight) => {
    try {
      if (action.category === 'childcare') {
        // Create a task for finding childcare
        await Task.create({
          family_id: familyId,
          title: action.title,
          description: action.description,
          due_date: action.deadline,
          status: 'pending',
          priority: action.priority,
          category: 'childcare',
          created_by: familyData?.user?.id || 'agent',
          assigned_to: [], // Can be assigned later
        });
        
        // Show success message
        alert('Task created successfully! Check your Tasks page.');
        
      } else if (action.category === 'family_time') {
        // Create a calendar event for family activities
        const eventDate = insight.metadata?.start_date ? new Date(insight.metadata.start_date) : new Date();
        const startTime = new Date(eventDate);
        startTime.setHours(10, 0, 0, 0); // Default to 10 AM
        const endTime = new Date(startTime);
        endTime.setHours(endTime.getHours() + 2); // 2 hour duration
        
        await ScheduleEvent.create({
          family_id: familyId,
          title: action.title,
          description: action.description,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          category: 'family',
          family_member_ids: [], // Can be assigned to family members
          location: null,
        });
        
        // Show success message
        alert('Family event created successfully! Check your Schedule.');
        
      } else if (action.category === 'scheduling') {
        // Create a task for resolving scheduling conflicts
        await Task.create({
          family_id: familyId,
          title: action.title,
          description: action.description,
          due_date: action.deadline,
          status: 'pending',
          priority: action.priority,
          category: 'planning',
          created_by: familyData?.user?.id || 'agent',
          assigned_to: [],
        });
        
        // Show success message
        alert('Planning task created successfully! Check your Tasks page.');
      }
      
      // Mark the insight as resolved after action is taken
      await resolveInsight(insight.id, `Action taken: ${action.title}`);
      
    } catch (err) {
      console.error('Failed to execute action:', err);
      alert('Failed to create task/event. Please try again.');
    }
  };

  useEffect(() => {
    if (familyId) {
      analyzeSchedule(analysisType);
    }
  }, [familyId, analysisType, daysAhead]);

  const getInsightIcon = (type, severity) => {
    if (type === 'problem' || type === 'warning') {
      return <AlertTriangle className={`w-5 h-5 ${severity === 'critical' ? 'text-red-500' : severity === 'high' ? 'text-orange-500' : 'text-yellow-500'}`} />;
    }
    if (type === 'opportunity') {
      return <Lightbulb className="w-5 h-5 text-blue-500" />;
    }
    return <CheckCircle className="w-5 h-5 text-green-500" />;
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return 'bg-red-50 border-red-200';
      case 'high': return 'bg-orange-50 border-orange-200';
      case 'medium': return 'bg-yellow-50 border-yellow-200';
      case 'low': return 'bg-blue-50 border-blue-200';
      default: return 'bg-gray-50 border-gray-200';
    }
  };

  const getActionIcon = (category) => {
    switch (category) {
      case 'childcare': return <Users className="w-4 h-4" />;
      case 'scheduling': return <Calendar className="w-4 h-4" />;
      case 'opportunities': return <Lightbulb className="w-4 h-4" />;
      case 'family_time': return <Users className="w-4 h-4" />;
      default: return <CheckCircle className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-2 text-gray-600">Analyzing your family schedule...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center space-x-2">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <span className="text-red-700">Analysis Error: {error}</span>
        </div>
        <button 
          onClick={() => analyzeSchedule(analysisType)}
          className="mt-2 px-3 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Analysis Summary */}
      {analysisResult && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4"
        >
          <h3 className="font-semibold text-gray-800 mb-2">Planning Agent Analysis</h3>
          <p className="text-gray-600 text-sm mb-3">{analysisResult.summary}</p>
          <div className="flex items-center space-x-4 text-xs text-gray-500">
            <span>📊 {analysisResult.total_problems} Issues</span>
            <span>💡 {analysisResult.total_opportunities} Opportunities</span>
            <span>🕒 {new Date(analysisResult.analysis_timestamp).toLocaleString()}</span>
          </div>
        </motion.div>
      )}

      {/* Quick Actions */}
      <div className="flex space-x-2 mb-4">
        <button 
          onClick={() => analyzeSchedule('problems')}
          className="px-3 py-1 bg-orange-100 text-orange-700 rounded-md text-sm hover:bg-orange-200"
          disabled={loading}
        >
          🚨 Check Problems
        </button>
        <button 
          onClick={() => analyzeSchedule('opportunities')}
          className="px-3 py-1 bg-blue-100 text-blue-700 rounded-md text-sm hover:bg-blue-200"
          disabled={loading}
        >
          💡 Find Opportunities
        </button>
        <button 
          onClick={() => analyzeSchedule('full')}
          className="px-3 py-1 bg-purple-100 text-purple-700 rounded-md text-sm hover:bg-purple-200"
          disabled={loading}
        >
          🔍 Full Analysis
        </button>
      </div>

      {/* Insights List */}
      <AnimatePresence>
        {insights.length === 0 && !loading ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-8 text-gray-500"
          >
            <Lightbulb className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No insights to show right now.</p>
            <p className="text-sm">Your family schedule looks well organized!</p>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {insights.map((insight, index) => (
              <motion.div
                key={insight.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: index * 0.1 }}
                className={`rounded-lg border-2 p-4 ${getSeverityColor(insight.severity)}`}
              >
                {/* Insight Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    {getInsightIcon(insight.type, insight.severity)}
                    <div>
                      <h4 className="font-semibold text-gray-800">{insight.title}</h4>
                      <p className="text-sm text-gray-600 capitalize">
                        {insight.type} • {insight.severity} priority • {Math.round(insight.confidence * 100)}% confidence
                      </p>
                    </div>
                  </div>
                  <div className="flex space-x-1">
                    <button
                      onClick={() => resolveInsight(insight.id)}
                      className="p-1 text-green-600 hover:bg-green-100 rounded"
                      title="Mark as resolved"
                    >
                      <CheckCircle className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => dismissInsight(insight.id)}
                      className="p-1 text-gray-500 hover:bg-gray-100 rounded"
                      title="Dismiss"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Insight Description */}
                <p className="text-gray-700 text-sm mb-3">{insight.description}</p>
                
                {/* Reasoning */}
                {insight.reasoning && (
                  <p className="text-xs text-gray-500 italic mb-3">💭 {insight.reasoning}</p>
                )}

                {/* Action Items */}
                {insight.actions && insight.actions.length > 0 && (
                  <div className="space-y-2">
                    <h5 className="text-sm font-medium text-gray-700">Suggested Actions:</h5>
                    {insight.actions.map((action) => (
                      <motion.div
                        key={action.id}
                        className="flex items-center space-x-2 bg-white bg-opacity-50 rounded-md p-2"
                      >
                        <div className="text-gray-500">
                          {getActionIcon(action.category)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium">{action.title}</span>
                            <span className={`px-1.5 py-0.5 text-xs rounded ${
                              action.priority === 'high' ? 'bg-red-100 text-red-700' :
                              action.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {action.priority}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600">{action.description}</p>
                          {action.deadline && (
                            <p className="text-xs text-gray-500">
                              ⏰ By {new Date(action.deadline).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => executeAction(action, insight)}
                          className="px-3 py-1 bg-blue-500 text-white text-xs rounded-md hover:bg-blue-600 transition-colors flex items-center space-x-1"
                          title={`Create ${action.category === 'family_time' ? 'event' : 'task'} for this suggestion`}
                        >
                          <Plus className="w-3 h-3" />
                          <span>{action.category === 'family_time' ? 'Create Event' : 'Create Task'}</span>
                        </button>
                      </motion.div>
                    ))}
                  </div>
                )}

                {/* Expiry */}
                {insight.expires_at && (
                  <div className="mt-3 text-xs text-gray-500 flex items-center space-x-1">
                    <Clock className="w-3 h-3" />
                    <span>Relevant until {new Date(insight.expires_at).toLocaleDateString()}</span>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PlanningAgentInsights;