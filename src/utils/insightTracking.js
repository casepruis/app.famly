// Utility functions for tracking AI insights and suggestions

export const getDismissedInsights = (familyId) => {
  const key = `dismissed-insights-${familyId}`;
  return new Set(JSON.parse(localStorage.getItem(key) || '[]'));
};

export const dismissInsight = (familyId, insight) => {
  const key = `dismissed-insights-${familyId}`;
  const existingDismissed = JSON.parse(localStorage.getItem(key) || '[]');
  const insightKey = insight.id || `${insight.title}-${insight.type}`;
  const updatedDismissed = [...existingDismissed, insightKey];
  
  localStorage.setItem(key, JSON.stringify(updatedDismissed));
  return insightKey;
};

export const clearDismissedInsights = (familyId) => {
  const key = `dismissed-insights-${familyId}`;
  localStorage.removeItem(key);
  console.log('Cleared dismissed insights for family:', familyId);
};

export const getActedInsights = (familyId) => {
  const key = `acted-insights-${familyId}`;
  return new Set(JSON.parse(localStorage.getItem(key) || '[]'));
};

export const markInsightAsActed = (familyId, insight, actionType = 'scheduled') => {
  const key = `acted-insights-${familyId}`;
  const existingActed = JSON.parse(localStorage.getItem(key) || '[]');
  const insightKey = insight.id || `${insight.title}-${insight.type}`;
  const actionRecord = {
    insightKey,
    actionType,
    timestamp: new Date().toISOString(),
    insightTitle: insight.title,
    insightType: insight.type
  };
  
  const updatedActed = [...existingActed, actionRecord];
  localStorage.setItem(key, JSON.stringify(updatedActed));
  
  // Also dismiss the insight since we acted on it
  dismissInsight(familyId, insight);
  
  return actionRecord;
};

// For debugging/testing
export const debugInsightTracking = (familyId) => {
  console.log('=== Insight Tracking Debug ===');
  console.log('Dismissed insights:', getDismissedInsights(familyId));
  console.log('Acted insights:', getActedInsights(familyId));
  console.log('================================');
};