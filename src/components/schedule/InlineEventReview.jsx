import React, { useState, useEffect } from 'react';
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { useLanguage } from '@/components/common/LanguageProvider';
import { Calendar, Clock } from 'lucide-react';
import { parseISO, format } from 'date-fns';
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

// Helper functions for date/time handling with timezone awareness
const getDateFromDateTime = (isoString) => getDateFromISO(isoString);
const getTimeFromDateTime = (isoString) => getTimeFromISO(isoString);
const combineDateAndTime = (dateStr, timeStr) => combineDateTimeToISO(dateStr, timeStr);

// Helper function to format event date and time for display
const formatEventDateTimeDisplay = (startTime, endTime) => {
  if (!startTime) return null;
  try {
    // Use parseISO to properly handle UTC timestamps
    const start = parseISO(startTime);
    const end = endTime ? parseISO(endTime) : null;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const eventDate = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    
    const diffTime = eventDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    let dateStr;
    if (diffDays === 0) dateStr = 'Today';
    else if (diffDays === 1) dateStr = 'Tomorrow';
    else if (diffDays === -1) dateStr = 'Yesterday';
    else if (diffDays > 0 && diffDays <= 7) dateStr = `In ${diffDays} days`;
    else if (diffDays < 0 && diffDays >= -7) dateStr = `${Math.abs(diffDays)} days ago`;
    else dateStr = start.toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: 'short', 
      year: start.getFullYear() !== now.getFullYear() ? 'numeric' : undefined 
    });
    
    const timeStr = format(start, 'HH:mm');
    const endTimeStr = end ? format(end, 'HH:mm') : null;
    
    return {
      date: dateStr,
      time: endTimeStr ? `${timeStr} - ${endTimeStr}` : timeStr
    };
  } catch {
    return { date: startTime, time: endTime };
  }
};

// Helper function to format datetime for input field
const toDateTimeLocal = (dateString) => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch {
    return '';
  }
};

const fromDateTimeLocal = (localValue) => {
  if (!localValue) return null;
  // Create a date from the datetime-local value which interprets it as local time
  // Then convert to ISO string which gives us UTC
  const date = new Date(localValue);
  return date.toISOString();
};

export default function InlineEventReview({ event, eventIndex, familyMembers, onEventUpdate }) {
  const { t } = useLanguage();

  // Debug logging for assignment issues
  console.log(`🔍 InlineEventReview - Event ${eventIndex}:`, {
    title: event.title,
    assigned_to: event.assigned_to,
    family_member_ids: event.family_member_ids,
    familyMembers: familyMembers?.map(m => ({ id: m.id, name: m.name }))
  });

  const handleUpdate = (field, value) => {
    onEventUpdate(eventIndex, { ...event, [field]: value });
  };

  const handleMemberAssignmentChange = (memberId, checked) => {
    const currentAssignments = event.assigned_to || [];
    const newAssignments = checked 
      ? [...currentAssignments, memberId]
      : currentAssignments.filter(id => id !== memberId);
    handleUpdate('assigned_to', newAssignments);
  };

  const eventDateTime = formatEventDateTimeDisplay(event.start_time, event.end_time);

  return (
    <div className="flex flex-col gap-3 p-3 sm:p-4 bg-emerald-50/80 border border-emerald-200/90 rounded-lg text-sm w-full shadow-sm">
      <div className="flex items-start gap-3 min-w-0">
        <Checkbox
          id={`event-select-${eventIndex}`}
          checked={event.selected || false}
          onCheckedChange={(checked) => handleUpdate('selected', checked)}
          className="h-4 w-4 flex-shrink-0 mt-2"
        />
        <div className="flex-1 min-w-0">
          <Input
            value={event.title}
            onChange={(e) => handleUpdate('title', e.target.value)}
            className="w-full h-8 sm:h-9 text-sm border-emerald-300 bg-white mb-3"
            placeholder={t('eventTitle') || 'Event title'}
          />
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-700 flex-shrink-0" />
            <div className="grid grid-cols-2 gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-start text-left font-normal h-8 sm:h-9 text-sm">
                    <Calendar className="mr-2 h-4 w-4" />
                    {getDateFromDateTime(event.start_time) ? format(new Date(getDateFromDateTime(event.start_time)), 'MMM dd') : 'Start date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <CalendarPicker
                    mode="single"
                    selected={getDateFromDateTime(event.start_time) ? new Date(getDateFromDateTime(event.start_time)) : undefined}
                    onSelect={(date) => handleUpdate('start_time', combineDateAndTime(date ? format(date, 'yyyy-MM-dd') : '', getTimeFromDateTime(event.start_time)))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <TimePicker
                value={getTimeFromDateTime(event.start_time)}
                onChange={(time) => handleUpdate('start_time', combineDateAndTime(getDateFromDateTime(event.start_time), time))}
                placeholder="Start time"
              />
            </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-700 flex-shrink-0" />
            <div className="grid grid-cols-2 gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-start text-left font-normal h-8 sm:h-9 text-sm">
                    <Clock className="mr-2 h-4 w-4" />
                    {getDateFromDateTime(event.end_time) ? format(new Date(getDateFromDateTime(event.end_time)), 'MMM dd') : 'End date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <CalendarPicker
                    mode="single"
                    selected={getDateFromDateTime(event.end_time) ? new Date(getDateFromDateTime(event.end_time)) : undefined}
                    onSelect={(date) => handleUpdate('end_time', combineDateAndTime(date ? format(date, 'yyyy-MM-dd') : '', getTimeFromDateTime(event.end_time)))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <TimePicker
                value={getTimeFromDateTime(event.end_time)}
                onChange={(time) => handleUpdate('end_time', combineDateAndTime(getDateFromDateTime(event.end_time), time))}
                placeholder="End time"
              />
            </div>
            </div>
            {eventDateTime && (
              <div className="text-sm text-emerald-600 italic pl-6">
                {eventDateTime.date} {eventDateTime.time && `• ${eventDateTime.time}`}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 pl-7">
        <span className="text-xs text-emerald-700 font-medium">Assign to:</span>
        {familyMembers.map(member => {
          const isChecked = (event.assigned_to || []).includes(member.id);
          console.log(`🔍 Checkbox for ${member.name} (${member.id}):`, {
            assigned_to: event.assigned_to,
            memberId: member.id,
            isChecked: isChecked
          });
          
          return (
            <div key={member.id} className="flex items-center gap-1.5 whitespace-nowrap">
              <Checkbox
                id={`event-${eventIndex}-member-${member.id}`}
                checked={isChecked}
                onCheckedChange={(checked) => handleMemberAssignmentChange(member.id, checked)}
                className="h-4 w-4"
              />
              <label htmlFor={`event-${eventIndex}-member-${member.id}`} className="text-sm font-medium text-emerald-800 cursor-pointer">{member.name}</label>
            </div>
          );
        })}
      </div>
    </div>
  );
}
