// src/pages/Insights.jsx
import React from 'react';
import { motion } from 'framer-motion';
import { Lightbulb, Users } from 'lucide-react';
import { useFamilyData } from '../hooks/FamilyDataContext';
import { useLanguage } from '../components/common/LanguageProvider';
import PlanningAgentInsights from '../components/agent/PlanningAgentInsights';

const Insights = () => {
  const { family: familyData, user, isLoading } = useFamilyData();
  const { t } = useLanguage();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
        <span className="ml-3 text-gray-600">{t('loading') || 'Loading...'}</span>
      </div>
    );
  }

  const familyId = user?.family_id || familyData?.id;
  const hasFamily = !!(familyId && familyData);

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6">
      {/* Simple Header */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-lg flex items-center justify-center">
            <Lightbulb className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{t('insights') || 'Insights'}</h1>
            <p className="text-sm text-gray-500">{t('insightsSubtitle') || 'AI-powered suggestions for your family'}</p>
          </div>
        </div>
      </motion.div>

      {/* No Family State */}
      {!hasFamily && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-amber-50 border border-amber-200 rounded-lg p-5"
        >
          <div className="flex items-start space-x-3">
            <Users className="w-5 h-5 text-amber-600 mt-0.5" />
            <div>
              <h3 className="font-medium text-amber-800">{t('familySetupRequired') || 'Family Setup Required'}</h3>
              <p className="text-sm text-amber-700 mt-1">
                {t('insightsRequireFamily') || 'Create a family and add events to see AI-powered insights.'}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Insights List */}
      {hasFamily && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <PlanningAgentInsights 
            familyId={familyId}
            analysisType="full"
            analysisWindowWeeks={8}
            daysAhead={56}
          />
        </motion.div>
      )}
    </div>
  );
};

export default Insights;
