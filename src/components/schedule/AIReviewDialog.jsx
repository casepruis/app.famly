import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Sparkles, Gift, Brain, AlertTriangle, Lightbulb, Calendar, Clock } from "lucide-react";
import { useLanguage } from "@/components/common/LanguageProvider";
import { useFamilyData } from '../../hooks/FamilyDataContext';
import { getDismissedInsights, dismissInsight, markInsightAsActed } from '../../utils/insightTracking';

export default function AIReviewDialog({ isOpen, onClose, reviewData, onConfirm }) {
  const [selectedTaskIndices, setSelectedTaskIndices] = useState([]);
  const [selectedInsightIndices, setSelectedInsightIndices] = useState([]);
  const [planningInsights, setPlanningInsights] = useState([]);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [dismissedInsights, setDismissedInsights] = useState(new Set());
  const { t } = useLanguage();
  const { family } = useFamilyData();

  useEffect(() => {
    if (reviewData && isOpen) {
      // Reset selections when dialog opens with new data
      setSelectedTaskIndices([]);
      setSelectedInsightIndices([]);
      
      // Use planning insights from backend response
      if (reviewData.planningInsights && reviewData.planningInsights.length > 0) {
        setPlanningInsights(reviewData.planningInsights);
      } else {
        setPlanningInsights([]);
      }
      setLoadingInsights(false);
    }
  }, [reviewData, isOpen]);

  // Remove the separate fetchPlanningInsights function since we get everything in one call

  const handleInsightToggle = (insightIndex, actionIndex, checked) => {
    const key = `${insightIndex}-${actionIndex}`;
    if (checked) {
      setSelectedInsightIndices(prev => [...prev, key]);
    } else {
      setSelectedInsightIndices(prev => prev.filter(k => k !== key));
    }
  };

  const handleTaskToggle = (taskIndex, checked) => {
    if (checked) {
      setSelectedTaskIndices(prev => [...prev, taskIndex]);
    } else {
      setSelectedTaskIndices(prev => prev.filter(index => index !== taskIndex));
    }
  };

  const handleDismissInsight = (insight) => {
    const insightKey = dismissInsight(family.id, insight);
    setDismissedInsights(prev => new Set([...prev, insightKey]));
    
    // Remove from current insights
    setPlanningInsights(prev => prev.filter(i => (i.id || `${i.title}-${i.type}`) !== insightKey));
  };
  
  const handleConfirm = () => {
    try {
      let finalEvent = { ...reviewData.originalEvent };
    
      const tasksToCreate = selectedTaskIndices.map(index => {
        const task = reviewData.aiResult?.suggestedTasks?.[index];
        if (!task) return null;
      
        // Ensure task has family_id and all required schema fields
        const normalizedTask = {
          title: task.title || task, // Handle both string and object formats
          description: task.description || '',
          family_id: family?.id || reviewData?.originalEvent?.family_id || (typeof window !== 'undefined' && JSON.parse(localStorage.getItem('famlyai_user') || '{}')?.family_id),
          status: task.status || 'todo',
          assigned_to: Array.isArray(task.assigned_to) ? task.assigned_to : [],
          priority: task.priority || 'medium',
          category: task.category || 'family',
          points: Number(task.points) || 0,
          estimated_duration: Number(task.estimated_duration) || 0,
          is_recurring: Boolean(task.is_recurring) || false,
          ai_suggested: true,
          due_date: task.due_date || null,
          related_event_id: task.related_event_id || null
        };
      
        // Validate required fields
        if (!normalizedTask.title || !normalizedTask.family_id) {
          return null;
        }
      
        return normalizedTask;
      }).filter(Boolean);
    
    // Add planning insight actions as tasks
    const insightTasks = selectedInsightIndices.map(key => {
      const [insightIndex, actionIndex] = key.split('-').map(Number);
      const insight = planningInsights[insightIndex];
      const action = insight.actions[actionIndex];
      
      // Convert planning action to task format with proper date handling
      const dueDate = action.deadline ? new Date(action.deadline) : null;
      
      // Map insight categories to valid task categories
      const categoryMapping = {
        'childcare': 'family',
        'scheduling': 'errands',
        'opportunities': 'personal',
        'conflicts': 'errands',
        'family_time': 'family',
        'health': 'personal',
        'education': 'homework',
        'finance': 'errands'
      };
      const taskCategory = categoryMapping[action.category] || 'family';
      
      return {
        title: action.title,
        description: action.description,
        family_id: family?.id || reviewData?.originalEvent?.family_id || (typeof window !== 'undefined' && JSON.parse(localStorage.getItem('famlyai_user') || '{}')?.family_id),
        ai_suggested: true,
        priority: action.priority || 'medium',
        due_date: dueDate ? dueDate.toISOString() : null, // Send full ISO string for backend
        category: taskCategory,
        status: 'todo', // Ensure status is set
        assigned_to: [], // Ensure assigned_to is array
        points: 0, // Set default points
        estimated_duration: 0, // Set default duration
        is_recurring: false, // Set default recurring
        related_event_id: null // Will be set by backend
      };
    });
    
    // Track insights that were acted upon
    selectedInsightIndices.forEach(key => {
      const [insightIndex] = key.split('-').map(Number);
      const insight = planningInsights[insightIndex];
      markInsightAsActed(family.id, insight, 'task_created');
      handleDismissInsight(insight);
    });
    
    const allTasks = [...tasksToCreate, ...insightTasks];
    onConfirm(finalEvent, allTasks);
    
    } catch (error) {
      console.error('[AIReviewDialog] Error in handleConfirm:', error);
      // Still call onConfirm but with empty tasks to at least save the event
      onConfirm({ ...reviewData.originalEvent }, []);
    }
  };
  
  if (!isOpen || !reviewData) {
    return null;
  }

  const { aiResult } = reviewData;
  
  const totalTasks = aiResult?.suggestedTasks?.length || 0;
  const totalInsightActions = planningInsights.reduce((sum, insight) => sum + (insight.actions?.length || 0), 0);
  const totalSuggestions = totalTasks + totalInsightActions;
  const selectedCount = selectedTaskIndices.length + selectedInsightIndices.length;
  
  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'critical':
      case 'high':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'medium':
        return <Brain className="w-4 h-4 text-orange-500" />;
      default:
        return <Lightbulb className="w-4 h-4 text-blue-500" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-500"/>
            AI Suggesties ({selectedCount}/{totalSuggestions} geselecteerd)
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {aiResult.aiMessage && (
            <p className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
              {aiResult.aiMessage}
            </p>
          )}

          {aiResult?.suggestedTasks?.length > 0 ? (
            <div className="space-y-3">
              <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                <Gift className="w-4 h-4" />
                Voorgestelde taken ({totalTasks}):
              </h4>
              {aiResult?.suggestedTasks?.map((task, index) => (
                <div key={index} className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <Checkbox 
                    id={`task-${index}`} 
                    checked={selectedTaskIndices.includes(index)}
                    onCheckedChange={(checked) => handleTaskToggle(index, checked)}
                    className="mt-1"
                  />
                  <Label htmlFor={`task-${index}`} className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2 font-medium text-blue-900 mb-1">
                      <Gift className="w-4 h-4" />
                      {task.title}
                    </div>
                    {task.description && (
                      <p className="text-sm text-blue-700 mb-1">{task.description}</p>
                    )}
                    {task.due_date && (
                      <p className="text-xs text-gray-600">Vervalt op: {new Date(task.due_date).toLocaleDateString()}</p>
                    )}
                  </Label>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-500 py-4">Geen taken voorgesteld</div>
          )}
          
          {/* Planning insights section - now enabled again */}
          {loadingInsights ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500 mx-auto"></div>
              <p className="text-sm text-gray-500 mt-2">Analyzing schedule...</p>
            </div>
          ) : planningInsights.length > 0 ? (
            <div className="space-y-3">
              <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                <Brain className="w-4 h-4 text-purple-500" />
                Planning inzichten ({planningInsights.length}):
              </h4>
              {planningInsights.map((insight, insightIndex) => (
                <div key={insightIndex} className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getSeverityIcon(insight.severity)}
                      <h5 className="font-medium text-purple-900">{insight.title}</h5>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDismissInsight(insight)}
                      className="text-gray-400 hover:text-gray-600 p-1"
                    >
                      ×
                    </Button>
                  </div>
                  {/* Show description if present */}
                  {insight.description && (
                    <p className="text-sm text-purple-700 mb-2">{insight.description}</p>
                  )}
                  {insight.message && (
                    <p className="text-sm text-purple-700 mb-2">{insight.message}</p>
                  )}
                  {insight.actions?.map((action, actionIndex) => (
                    <div key={actionIndex} className="flex items-start gap-3 mt-2">
                      <Checkbox
                        id={`insight-${insightIndex}-${actionIndex}`}
                        checked={selectedInsightIndices.includes(`${insightIndex}-${actionIndex}`)}
                        onCheckedChange={(checked) => handleInsightToggle(insightIndex, actionIndex, checked)}
                        className="mt-1"
                      />
                      <Label htmlFor={`insight-${insightIndex}-${actionIndex}`} className="flex-1 cursor-pointer">
                        <div className="flex items-center gap-2 font-medium text-purple-900 mb-1">
                          <Calendar className="w-4 h-4" />
                          {action.title}
                        </div>
                        {action.description && (
                          <p className="text-sm text-purple-700 mb-1">{action.description}</p>
                        )}
                        {action.deadline && (
                          <p className="text-xs text-gray-600 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Deadline: {new Date(action.deadline).toLocaleDateString()}
                          </p>
                        )}
                      </Label>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                <Brain className="w-4 h-4 text-purple-500" />
                Planning suggesties (0):
              </h4>
              <div className="text-center py-4 text-sm text-gray-500">
                <div className="font-medium">No planning suggestions</div>
                <div className="mt-1">Your schedule looks well-organized for this event.</div>
              </div>
            </div>
          )}
        </div>
        
        <DialogFooter className="flex-shrink-0 border-t pt-4 gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Annuleren
          </Button>
          <Button onClick={handleConfirm} className="flex-1">
            {selectedCount > 0 ? `${selectedCount} taken bevestigen` : 'Alleen evenement opslaan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}