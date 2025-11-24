import React, { useState, useEffect } from 'react';
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { useLanguage } from '@/components/common/LanguageProvider';
import { Calendar, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { getDateFromISO, getTimeFromISO, combineDateTimeToISO } from '@/utils/timezone';

// TimePicker component with 5-minute intervals (same as EventDialog)
const TimePicker = ({ value, onChange, placeholder }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [view, setView] = useState('HOUR'); // 'HOUR' or 'MINUTE'
    const [hour, setHour] = useState('09');
    const { t } = useLanguage();

    const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
    const minutes = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55']; // 5-minute intervals

    useEffect(() => {
        if (value) {
            const [h] = value.split(':');
            setHour(h);
        } else {
            setHour('09'); // Default to 09 if no value
        }
    }, [value]);

    useEffect(() => {
        if (!isOpen) {
            setTimeout(() => setView('HOUR'), 150);
        }
    }, [isOpen]);

    const handleHourSelect = (h) => {
        setHour(h);
        setView('MINUTE');
    };

    const handleMinuteSelect = (m) => {
        const newTime = `${hour}:${m}`;
        onChange(newTime);
        setIsOpen(false);
    };

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start text-left font-normal h-8 sm:h-9 text-sm flex-1">
                    <Clock className="mr-2 h-4 w-4" />
                    {value || placeholder}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-2">
                {view === 'HOUR' && (
                    <div>
                        <div className="text-center font-medium mb-2">{t('selectHour') || 'Select Hour'}</div>
                        <div className="grid grid-cols-6 gap-1">
                            {hours.map(h => (
                                <Button key={h} variant={h === hour ? 'default' : 'ghost'} size="sm" className="text-center" onClick={() => handleHourSelect(h)}>
                                    {h}
                                </Button>
                            ))}
                        </div>
                    </div>
                )}
                {view === 'MINUTE' && (
                    <div>
                        <div className="text-center font-medium mb-2 text-lg">{hour}:__</div>
                        <div className="grid grid-cols-4 gap-1 max-h-40 overflow-y-auto">
                            {minutes.map(m => (
                                <Button key={m} variant="outline" size="sm" className="text-sm" onClick={() => handleMinuteSelect(m)}>
                                    {m}
                                </Button>
                            ))}
                        </div>
                        <Button variant="link" size="sm" onClick={() => setView('HOUR')} className="w-full mt-2">
                            {t('backToHours') || 'Back to hours'}
                        </Button>
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
};

// Helper function to format due date for display  
const formatDueDateDisplay = (dueDate) => {
  if (!dueDate) return null;
  try {
    const date = new Date(dueDate);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const taskDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    const diffTime = taskDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays > 0 && diffDays <= 7) return `In ${diffDays} days`;
    if (diffDays < 0 && diffDays >= -7) return `${Math.abs(diffDays)} days ago`;
    
    return date.toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: 'short', 
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined 
    });
  } catch {
    return '';
  }
};

// Helper functions for date/time handling with timezone awareness
const getDateFromDateTime = (isoString) => getDateFromISO(isoString);
const getTimeFromDateTime = (isoString) => getTimeFromISO(isoString);
const combineDateAndTime = (dateStr, timeStr) => combineDateTimeToISO(dateStr, timeStr);

export default function InlineTaskReview({ task, taskIndex, familyMembers, onTaskUpdate }) {
  const { t } = useLanguage();

  const handleUpdate = (field, value) => {
    onTaskUpdate(taskIndex, { ...task, [field]: value });
  };

  const handleMemberAssignmentChange = (memberId, checked) => {
    const currentAssignments = task.assigned_to || [];
    const newAssignments = checked 
      ? [...currentAssignments, memberId]
      : currentAssignments.filter(id => id !== memberId);
    handleUpdate('assigned_to', newAssignments);
  };

  return (
    <div className="flex flex-col gap-3 p-3 sm:p-4 bg-blue-50/80 border border-blue-200/90 rounded-lg text-sm w-full shadow-sm">
      <div className="flex items-start gap-3 min-w-0">
        <Checkbox
          id={`task-select-${taskIndex}`}
          checked={task.selected || false}
          onCheckedChange={(checked) => handleUpdate('selected', checked)}
          className="h-4 w-4 flex-shrink-0 mt-2"
        />
        <div className="flex-1 min-w-0">
          <Input
            value={task.title}
            onChange={(e) => handleUpdate('title', e.target.value)}
            className="w-full h-8 sm:h-9 text-sm border-blue-300 bg-white mb-3"
            placeholder={t('taskTitle') || 'Task title'}
          />
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-700 flex-shrink-0" />
          <div className="grid grid-cols-2 gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start text-left font-normal h-8 sm:h-9 text-sm">
                  <Calendar className="mr-2 h-4 w-4" />
                  {getDateFromDateTime(task.due_date) ? format(new Date(getDateFromDateTime(task.due_date)), 'MMM dd') : 'Select date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <CalendarPicker
                  mode="single"
                  selected={getDateFromDateTime(task.due_date) ? new Date(getDateFromDateTime(task.due_date)) : undefined}
                  onSelect={(date) => handleUpdate('due_date', combineDateAndTime(date ? format(date, 'yyyy-MM-dd') : '', getTimeFromDateTime(task.due_date)))}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <TimePicker
              value={getTimeFromDateTime(task.due_date)}
              onChange={(time) => handleUpdate('due_date', combineDateAndTime(getDateFromDateTime(task.due_date), time))}
              placeholder="Select time"
            />
          </div>
            {task.due_date && (
              <span className="text-sm text-blue-600 whitespace-nowrap">({formatDueDateDisplay(task.due_date)})</span>
            )}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 pl-7">
        <span className="text-xs text-blue-700 font-medium">Assign to:</span>
        {familyMembers.map(member => (
          <div key={member.id} className="flex items-center gap-1.5 whitespace-nowrap">
            <Checkbox
              id={`task-${taskIndex}-member-${member.id}`}
              checked={(task.assigned_to || []).includes(member.id)}
              onCheckedChange={(checked) => handleMemberAssignmentChange(member.id, checked)}
              className="h-4 w-4"
            />
            <label htmlFor={`task-${taskIndex}-member-${member.id}`} className="text-sm font-medium text-blue-800 cursor-pointer">{member.name}</label>
          </div>
        ))}
      </div>
    </div>
  );
}