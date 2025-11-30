import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Sparkles, Bot, AlertTriangle, Calendar, Clock } from "lucide-react";
import { useLanguage } from "@/components/common/LanguageProvider";
import { useFamilyData } from "@/hooks/FamilyDataContext";
import { Task, ScheduleEvent } from "@/api/entities";

export default function UnifiedInsightDialog({ 
  isOpen, 
  onClose, 
  taskSuggestions = [], 
  showPlanningInsights = true,
  onTasksConfirmed 
}) {
  const [selectedTaskIndices, setSelectedTaskIndices] = useState([]);
  const [selectedInsightActions, setSelectedInsightActions] = useState([]);
  const { t } = useLanguage();
  const { planningInsights, user } = useFamilyData();

  // Filter insights that have actionable suggestions
  const actionableInsights = planningInsights?.filter(insight => 
    insight.actions && insight.actions.length > 0
  ) || [];

  useEffect(() => {
    if (isOpen) {
      // Reset selections when dialog opens
      setSelectedTaskIndices([]);
      setSelectedInsightActions([]);
    }
  }, [isOpen]);

  const handleTaskToggle = (taskIndex, checked) => {
    if (checked) {
      setSelectedTaskIndices(prev => [...prev, taskIndex]);
    } else {
      setSelectedTaskIndices(prev => prev.filter(index => index !== taskIndex));
    }
  };

  const handleInsightActionToggle = (insightId, actionIndex, checked) => {
    const actionKey = `${insightId}-${actionIndex}`;
    if (checked) {
      setSelectedInsightActions(prev => [...prev, actionKey]);
    } else {
      setSelectedInsightActions(prev => prev.filter(key => key !== actionKey));
    }
  };

  const handleConfirm = async () => {
    const results = [];

    // Create tasks from task suggestions
    const tasksToCreate = selectedTaskIndices.map(index => taskSuggestions[index]);
    for (const taskData of tasksToCreate) {
      try {
        const task = await Task.create({
          ...taskData,
          family_id: user.family_id,
          created_by: user.id
        });
        results.push({ type: 'task', item: task });
      } catch (error) {
        console.error('Failed to create task:', error);
      }
    }

    // Execute planning agent actions
    for (const actionKey of selectedInsightActions) {
      const [insightId, actionIndexStr] = actionKey.split('-');
      const actionIndex = parseInt(actionIndexStr);
      
      const insight = actionableInsights.find(i => i.id === insightId);
      if (insight && insight.actions[actionIndex]) {
        const action = insight.actions[actionIndex];
        
        try {
          if (action.type === 'create_task') {
            const task = await Task.create({
              title: action.data.title,
              description: action.data.description || '',
              family_id: user.family_id,
              created_by: user.id,
              due_date: action.data.due_date || null,
              assigned_to: action.data.assigned_to || null
            });
            results.push({ type: 'task', item: task, source: 'planning_agent' });
          } else if (action.type === 'create_event') {
            const event = await ScheduleEvent.create({
              title: action.data.title,
              description: action.data.description || '',
              family_id: user.family_id,
              start_time: action.data.start_time,
              end_time: action.data.end_time,
              category: action.data.category || 'other',
              family_member_ids: action.data.family_member_ids || []
            });
            results.push({ type: 'event', item: event, source: 'planning_agent' });
          }
        } catch (error) {
          console.error('Failed to execute planning agent action:', error);
        }
      }
    }

    if (onTasksConfirmed) {
      onTasksConfirmed(results);
    }
    
    onClose();
  };
  
  if (!isOpen) return null;

  const totalSuggestions = taskSuggestions.length + actionableInsights.reduce((sum, insight) => sum + insight.actions.length, 0);
  const selectedCount = selectedTaskIndices.length + selectedInsightActions.length;

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'high': return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      default: return <Bot className="w-4 h-4 text-blue-500" />;
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return 'border-red-200 bg-red-50';
      case 'high': return 'border-orange-200 bg-orange-50';
      case 'medium': return 'border-yellow-200 bg-yellow-50';
      default: return 'border-blue-200 bg-blue-50';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-500"/>
            AI Insights & Suggestions ({selectedCount}/{totalSuggestions} selected)
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto space-y-6">
          {/* Task Suggestions */}
          {taskSuggestions.length > 0 && (
            <div>
              <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-500" />
                Task Suggestions ({taskSuggestions.length})
              </h3>
              <div className="space-y-2">
                {taskSuggestions.map((task, index) => (
                  <div key={index} className="flex items-start space-x-3 p-3 rounded-lg border bg-purple-50 border-purple-200">
                    <Checkbox
                      id={`task-${index}`}
                      checked={selectedTaskIndices.includes(index)}
                      onCheckedChange={(checked) => handleTaskToggle(index, checked)}
                    />
                    <div className="flex-1">
                      <Label htmlFor={`task-${index}`} className="font-medium cursor-pointer">
                        {task.title}
                      </Label>
                      {task.description && (
                        <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                      )}
                      {task.due_date && (
                        <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Due: {new Date(task.due_date).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Planning Agent Insights */}
          {showPlanningInsights && actionableInsights.length > 0 && (
            <div>
              <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                <Bot className="w-4 h-4 text-blue-500" />
                Planning Agent Insights ({actionableInsights.length})
              </h3>
              <div className="space-y-3">
                {actionableInsights.map((insight) => (
                  <div key={insight.id} className={`p-4 rounded-lg border ${getSeverityColor(insight.severity)}`}>
                    <div className="flex items-start gap-3 mb-3">
                      {getSeverityIcon(insight.severity)}
                      <div className="flex-1">
                        <h4 className="font-medium">{insight.title}</h4>
                        <p className="text-sm text-gray-600 mt-1">{insight.description}</p>
                      </div>
                    </div>
                    
                    <div className="space-y-2 ml-7">
                      <p className="text-xs font-medium text-gray-700 uppercase tracking-wide">Suggested Actions:</p>
                      {insight.actions.map((action, actionIndex) => (
                        <div key={actionIndex} className="flex items-start space-x-3 p-2 rounded bg-white border border-gray-200">
                          <Checkbox
                            id={`action-${insight.id}-${actionIndex}`}
                            checked={selectedInsightActions.includes(`${insight.id}-${actionIndex}`)}
                            onCheckedChange={(checked) => handleInsightActionToggle(insight.id, actionIndex, checked)}
                          />
                          <div className="flex-1">
                            <Label htmlFor={`action-${insight.id}-${actionIndex}`} className="font-medium cursor-pointer text-sm">
                              {action.type === 'create_task' ? '📝' : '📅'} {action.data.title}
                            </Label>
                            {action.data.description && (
                              <p className="text-xs text-gray-600 mt-1">{action.data.description}</p>
                            )}
                            {(action.data.start_time || action.data.due_date) && (
                              <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {action.data.start_time ? new Date(action.data.start_time).toLocaleString() : 
                                 action.data.due_date ? `Due: ${new Date(action.data.due_date).toLocaleDateString()}` : ''}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {totalSuggestions === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Bot className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No AI suggestions available at the moment.</p>
              <p className="text-sm mt-1">Create some events to get intelligent insights!</p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-shrink-0">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={selectedCount === 0}
          >
            Create Selected ({selectedCount})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}