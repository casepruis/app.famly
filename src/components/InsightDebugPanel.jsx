import React from 'react';
import { Button } from "@/components/ui/button";
import { useFamilyData } from '../hooks/FamilyDataContext';
import { clearDismissedInsights, debugInsightTracking, getDismissedInsights, getActedInsights } from '../utils/insightTracking';

export default function InsightDebugPanel() {
  const { family } = useFamilyData();
  
  if (!family?.id) return null;
  
  const handleClearDismissed = () => {
    clearDismissedInsights(family.id);
    // Changes will be reflected automatically via WebSocket or natural re-renders
    console.log('[InsightDebugPanel] Cleared dismissed insights, relying on natural updates');
  };
  
  const handleDebugInfo = () => {
    debugInsightTracking(family.id);
    
    // Also show in alert for quick viewing
    const dismissed = Array.from(getDismissedInsights(family.id));
    const acted = getActedInsights(family.id);
    
    alert(`
Dismissed insights (${dismissed.length}):
${dismissed.slice(0, 5).join('\n')}
${dismissed.length > 5 ? '...' : ''}

Acted insights: ${acted.size}
    `.trim());
  };
  
  return (
    <div className="fixed bottom-4 right-4 bg-white border border-gray-300 rounded-lg p-3 shadow-lg z-50">
      <div className="text-xs font-mono mb-2">Insight Debug</div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={handleDebugInfo}>
          Show Status
        </Button>
        <Button variant="outline" size="sm" onClick={handleClearDismissed}>
          Clear Dismissed
        </Button>
      </div>
    </div>
  );
}