import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bot, AlertTriangle, Lightbulb, Clock } from "lucide-react";
import { useFamilyData } from "@/hooks/FamilyDataContext";
import UnifiedInsightDialog from "./UnifiedInsightDialog";
import { toast } from "@/components/ui/use-toast";

export default function PlanningInsightNotification({ className = "" }) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { planningInsights } = useFamilyData();

  if (!planningInsights || planningInsights.length === 0) {
    return null;
  }

  // Extract task suggestions from planning insight actions
  const taskSuggestions = [];
  planningInsights.forEach(insight => {
    if (insight.actions) {
      insight.actions.forEach(action => {
        if (action.type === 'suggestion' && action.category && action.title) {
          // Convert insight action to task suggestion format
          taskSuggestions.push({
            title: action.title,
            description: action.description,
            due_date: action.deadline,
            priority: action.priority,
            category: action.category,
            action_items: action.action_items || [],
            source: 'planning_agent'
          });
        }
      });
    }
  });

  const criticalCount = planningInsights.filter(i => i.severity === 'critical').length;
  const highCount = planningInsights.filter(i => i.severity === 'high').length;
  const opportunityCount = planningInsights.filter(i => i.type === 'opportunity').length;
  const problemCount = planningInsights.filter(i => i.type === 'problem').length;

  const handleConfirm = (results) => {
    const taskCount = results.filter(r => r.type === 'task').length;
    const eventCount = results.filter(r => r.type === 'event').length;
    
    if (taskCount > 0 || eventCount > 0) {
      toast({
        title: "✅ Actions completed",
        description: `Created ${taskCount} tasks and ${eventCount} events from AI insights.`,
        duration: 5000
      });
    }
  };

  const getButtonVariant = () => {
    if (criticalCount > 0) return "destructive";
    if (highCount > 0) return "outline";
    return "default";
  };

  const getIcon = () => {
    if (criticalCount > 0) return <AlertTriangle className="w-4 h-4" />;
    if (opportunityCount > 0) return <Lightbulb className="w-4 h-4" />;
    return <Bot className="w-4 h-4" />;
  };

  return (
    <>
      <div className={`relative ${className}`}>
        <Button
          variant={getButtonVariant()}
          size="sm"
          onClick={() => setIsDialogOpen(true)}
          className="flex items-center gap-2"
        >
          {getIcon()}
          AI Insights
          <Badge variant="secondary" className="ml-1">
            {planningInsights.length + taskSuggestions.length}
          </Badge>
        </Button>

        {/* Show severity indicators */}
        <div className="absolute -top-2 -right-2 flex flex-col gap-0.5">
          {criticalCount > 0 && (
            <Badge variant="destructive" className="text-xs px-1 py-0 min-w-[16px] h-4">
              {criticalCount}
            </Badge>
          )}
          {opportunityCount > 0 && (
            <Badge variant="outline" className="text-xs px-1 py-0 min-w-[16px] h-4 bg-green-50 text-green-700 border-green-200">
              {opportunityCount}
            </Badge>
          )}
        </div>
      </div>

      <UnifiedInsightDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        taskSuggestions={taskSuggestions}
        showPlanningInsights={true}
        onTasksConfirmed={handleConfirm}
      />
    </>
  );
}