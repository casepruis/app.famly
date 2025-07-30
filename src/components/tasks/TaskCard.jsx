import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, Clock, Star, Users, Edit, Calendar, Trash2, Check, ChevronDown, ChevronUp } from "lucide-react";
import { format, isPast, isToday } from "date-fns";
import { motion } from "framer-motion";
import { useLanguage } from "@/components/common/LanguageProvider";

export default function TaskCard({ task, familyMembers, onStatusChange, onEdit, onDelete }) {
  const { t } = useLanguage();
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [exitX, setExitX] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);

  const getAssigneeInfo = (ids) => {
    if (!ids || ids.length === 0) return { names: t('allMembers'), colors: ['#64748b'] };
    const members = (familyMembers || []).filter(m => ids.includes(m.id));
    if (members.length === 0) return { names: t('allMembers'), colors: ['#64748b'] };
    return {
      names: members.map(m => m.name).join(', '),
      colors: members.map(m => m.color || '#6366f1')
    };
  };

  const { names: assigneeNames, colors: assigneeColors } = getAssigneeInfo(task.assigned_to);

  const getPriorityColor = (priority) => ({
    low: 'bg-blue-100 text-blue-800',
    medium: 'bg-yellow-100 text-yellow-800',
    high: 'bg-red-100 text-red-800'
  }[priority] || 'bg-gray-100');

  const isDue = task.due_date && isPast(new Date(task.due_date)) && task.status !== 'completed';
  const isDueToday = task.due_date && isToday(new Date(task.due_date));
  const cardBorderColor = task.status === 'completed' ? 'border-l-green-500' : isDue ? 'border-l-red-500' : isDueToday ? 'border-l-yellow-500' : 'border-l-blue-500';

  const handleDragEnd = (event, info) => {
    setIsDragging(false);
    const threshold = 100;

    if (info.offset.x < -threshold) {
      setExitX(-500);
      onStatusChange(task, 'completed');
    } else if (info.offset.x > threshold) {
      setExitX(500);
      onDelete(task.id, task);
    }

    setDragX(0);
  };

  const handleDrag = (event, info) => {
    setDragX(info.offset.x);
  };

  return (
    <motion.div
      layout
      initial={{ scale: 1, opacity: 1 }}
      exit={{ x: exitX, opacity: 0, transition: { duration: 0.3 } }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      onDragStart={() => setIsDragging(true)}
      onDrag={handleDrag}
      onDragEnd={handleDragEnd}
      className="relative"
    >
      {/* Action indicators */}
      <motion.div
        className="absolute inset-y-0 left-full w-24 bg-green-500 flex items-center justify-start pl-6 rounded-l-lg"
        style={{ right: '-6rem' }}
        animate={{ opacity: isDragging && dragX < -50 ? 1 : 0 }}
      >
        <Check className="w-6 h-6 text-white" />
      </motion.div>
      <motion.div
        className="absolute inset-y-0 right-full w-24 bg-red-500 flex items-center justify-end pr-6 rounded-r-lg"
        style={{ left: '-6rem' }}
        animate={{ opacity: isDragging && dragX > 50 ? 1 : 0 }}
      >
        <Trash2 className="w-6 h-6 text-white" />
      </motion.div>

      <Card className={`hover:shadow-md transition-all duration-300 border-l-4 ${cardBorderColor} ${task.status === 'completed' ? 'opacity-60' : ''} bg-white`}>
        <CardContent className="p-4">
          {/* Main content - always visible */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1">
              <button
                onClick={() => {
                  const nextStatus = task.status === 'todo' ? 'in_progress' :
                                   task.status === 'in_progress' ? 'completed' : 'todo';
                  onStatusChange(task, nextStatus);
                }}
                className="hover:opacity-70 transition-opacity flex-shrink-0"
              >
                {task.status === 'completed' ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                ) : task.status === 'in_progress' ? (
                  <Clock className="w-5 h-5 text-blue-500" />
                ) : (
                  <Circle className="w-5 h-5 text-gray-400" />
                )}
              </button>

              <div className="flex-1 min-w-0">
                <h3 className={`font-medium text-gray-900 text-sm leading-relaxed ${task.status === 'completed' ? 'line-through text-gray-500' : ''}`}>
                  {task.ai_suggested ? t(task.title) : task.title}
                </h3>
                
                <div className="flex items-center gap-2 mt-1">
                  <Badge className={`${getPriorityColor(task.priority)} text-xs px-2 py-0.5 font-medium`}>
                    {t(task.priority)}
                  </Badge>
                  {task.due_date && (
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-gray-400" />
                      <span className={`text-xs font-medium ${
                        isDue ? 'text-red-600' :
                        isDueToday ? 'text-yellow-600' :
                        'text-gray-500'
                      }`}>
                        {format(new Date(task.due_date), 'MMM d')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(task)}
                className="text-gray-400 hover:text-gray-600 h-7 w-7 p-0"
              >
                <Edit className="w-3 h-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-gray-400 hover:text-gray-600 h-7 w-7 p-0"
              >
                {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </Button>
            </div>
          </div>

          {/* Expanded details */}
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 pt-3 border-t border-gray-100 space-y-2"
            >
              {task.description && (
                <p className="text-sm text-gray-600 leading-relaxed">{task.description}</p>
              )}

              <div className="flex flex-wrap gap-2">
                <Badge className={`bg-green-100 text-green-800 text-xs px-2 py-0.5 font-medium`}>
                  {t(task.category)}
                </Badge>
                {task.ai_suggested && (
                  <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-xs px-2 py-0.5">
                    <Star className="w-3 h-3 mr-1" />AI
                  </Badge>
                )}
                {task.related_event_id && (
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs px-2 py-0.5">
                    <Calendar className="w-3 h-3 mr-1" />Event
                  </Badge>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-1">
                    {assigneeColors.slice(0, 3).map((color, index) => (
                      <div key={index} className="w-5 h-5 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: color }}></div>
                    ))}
                    {assigneeColors.length > 3 && (
                      <div className="w-5 h-5 rounded-full border-2 border-white bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600 shadow-sm">
                        +{assigneeColors.length - 3}
                      </div>
                    )}
                  </div>
                  <span className="text-gray-600 text-xs font-medium">{assigneeNames}</span>
                </div>
                
                {task.points > 0 && (
                  <div className="flex items-center gap-1">
                    <Star className="w-3 h-3 text-yellow-500" />
                    <span className="text-xs text-yellow-600 font-medium">{task.points} {t('points')}</span>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}