// src/pages/PlanningAgent.jsx
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Brain, Clock, Users, Calendar, Settings } from 'lucide-react';
import { useFamilyData } from '../hooks/FamilyDataContext';
import PlanningAgentInsights from '../components/agent/PlanningAgentInsights';

const PlanningAgent = () => {
  const { family: familyData, user, isLoading } = useFamilyData();
  const [analysisType, setAnalysisType] = useState('full');
  const [analysisWindowWeeks, setAnalysisWindowWeeks] = useState(8);  // Default 8 weeks
  const [daysAhead, setDaysAhead] = useState(56); // Derived from weeks * 7
  const [agentStatus, setAgentStatus] = useState(null);

  // Update daysAhead when weeks change
  React.useEffect(() => {
    setDaysAhead(analysisWindowWeeks * 7);
  }, [analysisWindowWeeks]);

  React.useEffect(() => {
    // Get agent status
    const API_BASE = (import.meta?.env?.VITE_API_BASE) || "/api";
    fetch(`${API_BASE}/agent/status`)
      .then(res => res.json())
      .then(data => setAgentStatus(data))
      .catch(err => console.error('Failed to get agent status:', err));
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-gray-600">Loading family data...</span>
      </div>
    );
  }

  const familyId = user?.family_id || familyData?.id;
  const hasFamily = !!(familyId && familyData);

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Page Header */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
            <Brain className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Planning Agent</h1>
            <p className="text-gray-600">AI-powered family schedule analysis and suggestions</p>
          </div>
        </div>

        {/* Agent Status */}
        {agentStatus && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-green-700 font-medium">Agent Active</span>
                <span className="text-green-600 text-sm">v{agentStatus.version}</span>
              </div>
              <div className="text-sm text-green-600">
                Capabilities: {agentStatus.capabilities?.length || 0} detection algorithms
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* Family Status & Instructions */}
      {!hasFamily && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Users className="w-4 h-4 text-yellow-600" />
              </div>
              <div>
                <h3 className="font-medium text-yellow-800 mb-2">Family Setup Required</h3>
                <p className="text-yellow-700 mb-3">
                  The Planning Agent needs family data to analyze your schedule and provide insights.
                </p>
                <div className="text-sm text-yellow-600">
                  <p className="mb-2"><strong>To get started:</strong></p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Create or join a family from the Dashboard</li>
                    <li>Add family members</li>
                    <li>Create some schedule events</li>
                    <li>Return here to see AI-powered insights</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Analysis Controls */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6"
      >
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Analysis Settings</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Analysis Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Analysis Focus
            </label>
            <select
              value={analysisType}
              onChange={(e) => setAnalysisType(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="full">Full Analysis</option>
              <option value="problems">Problems Only</option>
              <option value="opportunities">Opportunities Only</option>
              <option value="conflicts">Schedule Conflicts</option>
            </select>
          </div>

          {/* Analysis Window */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Analysis Window
            </label>
            <select
              value={analysisWindowWeeks}
              onChange={(e) => setAnalysisWindowWeeks(Number(e.target.value))}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value={4}>4 weeks (1 month)</option>
              <option value={8}>8 weeks (2 months)</option>
              <option value={12}>12 weeks (3 months)</option>
              <option value={16}>16 weeks (4 months)</option>
              <option value={24}>24 weeks (6 months)</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              How far ahead to analyze ({daysAhead} days)
            </p>
          </div>

          {/* Family Stats */}
          <div className="bg-gray-50 rounded-md p-3">
            <div className="text-sm font-medium text-gray-700 mb-2">Family Overview</div>
            <div className="space-y-1 text-sm text-gray-600">
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4" />
                <span>{hasFamily ? `${familyData?.name || 'Family'}` : 'No family'}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4" />
                <span>Analyzing {analysisWindowWeeks} weeks ({daysAhead} days)</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Agent Insights */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-800">Agent Insights</h2>
          <div className="text-sm text-gray-500 flex items-center space-x-1">
            <Clock className="w-4 h-4" />
            <span>Real-time analysis</span>
          </div>
        </div>

        {hasFamily ? (
          <PlanningAgentInsights 
            familyId={familyId}
            analysisType={analysisType}
            analysisWindowWeeks={analysisWindowWeeks}
            daysAhead={daysAhead}
          />
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Brain className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-lg font-medium mb-2">Agent Ready</p>
            <p className="text-sm">Set up your family to start receiving AI-powered insights</p>
          </div>
        )}
      </motion.div>

      {/* Usage Tips */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4"
      >
        <h3 className="font-medium text-blue-800 mb-2">💡 How the Planning Agent helps:</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• <strong>Childcare Detection:</strong> Identifies when children need supervision but parents are unavailable</li>
          <li>• <strong>Schedule Conflicts:</strong> Finds overlapping appointments for family members</li>
          <li>• <strong>Family Opportunities:</strong> Suggests activities during school breaks and free weekends</li>
          <li>• <strong>Proactive Planning:</strong> Recommends actions before problems become urgent</li>
        </ul>
      </motion.div>
    </div>
  );
};

export default PlanningAgent;