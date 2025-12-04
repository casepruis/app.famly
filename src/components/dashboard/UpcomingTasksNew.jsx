/**
 * UpcomingTasks Component (Refactored)
 * 
 * Displays upcoming tasks in a card format.
 * Task creation is now handled by parent component via useTaskCreation hook.
 */

import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckSquare, ArrowRight, Plus, Circle, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useLanguage } from "@/components/common/LanguageProvider";
import { format, parseISO } from "date-fns";

export default function UpcomingTasks({ 
  tasks, 
  familyMembers,
  onAddTask,           // () => void - Opens new task dialog
  onTaskClick,         // (task) => void - Opens edit task dialog
  onToggleComplete     // (task) => void - Toggles task completion
}) {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const getAssigneeColor = (ids) => {
    if (!ids || ids.length === 0) return '#64748b'; // Default for "all members"
    const member = familyMembers?.find(m => ids.includes(m.id));
    return member?.color || '#6366f1'; // Default member color
  };

  const handleAddClick = () => {
    if (onAddTask) {
      onAddTask();
    } else {
      // Fallback: navigate to tasks page with new action
      navigate(createPageUrl('Tasks') + '?action=new');
    }
  };

  const handleTaskClick = (task) => {
    if (onTaskClick) {
      onTaskClick(task);
    } else {
      // Fallback: navigate to tasks page
      navigate(createPageUrl('Tasks'));
    }
  };

  const handleToggleClick = (e, task) => {
    e.stopPropagation();
    if (onToggleComplete) {
      onToggleComplete(task);
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'text-red-500';
      case 'medium': return 'text-yellow-500';
      case 'low': return 'text-green-500';
      default: return 'text-gray-400';
    }
  };

  return (
    <Card id="upcoming-tasks-card" className="h-full">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-600">
              {t('upcomingTasks') || 'Upcoming Tasks'}
            </span>
          </div>

          <Button
            variant="outline"
            size="icon"
            className="h-6 w-6 p-0 border-blue-200 text-blue-600 hover:bg-blue-50"
            onClick={handleAddClick}
            title={t('addTask') || 'Add Task'}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>

        <div className="space-y-3">
          {tasks && tasks.length > 0 ? (
            tasks.map(task => {
              const isCompleted = task.status === 'completed';
              
              return (
                <div 
                  key={task.id} 
                  className="flex items-start gap-3 p-2 rounded-lg transition-colors hover:bg-gray-50/50 cursor-pointer"
                  onClick={() => handleTaskClick(task)}
                >
                  {/* Completion toggle */}
                  <button
                    className="mt-0.5 flex-shrink-0"
                    onClick={(e) => handleToggleClick(e, task)}
                    title={isCompleted ? t('markIncomplete') : t('markComplete')}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    ) : (
                      <Circle className={`w-5 h-5 ${getPriorityColor(task.priority)}`} />
                    )}
                  </button>

                  {/* Task content */}
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold text-sm break-words ${isCompleted ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                      {task.title}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                      {task.due_date && (
                        <span>
                          {t('due') || 'Due'} {format(parseISO(task.due_date), 'MMM d')}
                        </span>
                      )}
                      {task.assigned_to?.length > 0 && familyMembers && (
                        <>
                          {task.due_date && <span className="text-gray-300">•</span>}
                          <div className="flex items-center gap-1">
                            <div 
                              className="w-2 h-2 rounded-full" 
                              style={{ backgroundColor: getAssigneeColor(task.assigned_to) }}
                            />
                            <span>
                              {task.assigned_to.length === 1 
                                ? familyMembers.find(m => m.id === task.assigned_to[0])?.name 
                                : `${task.assigned_to.length} ${t('members') || 'members'}`}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Points badge */}
                  {task.points > 0 && (
                    <span className="text-xs font-medium text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                      +{task.points}
                    </span>
                  )}
                </div>
              );
            })
          ) : (
            <p className="text-sm text-center text-gray-500 py-4">
              {t('noUpcomingTasks') || 'No upcoming tasks'}
            </p>
          )}
        </div>

        <div className="flex gap-2 mt-4">
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full text-blue-600 hover:text-blue-700" 
            onClick={() => navigate(createPageUrl('Tasks'))}
          >
            {t('viewAllTasks') || 'View All Tasks'} 
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
