
import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { format, startOfWeek, addDays, addWeeks, subWeeks, parseISO, isToday as checkIsToday } from "date-fns";
import { nl, es, fr, de, it, pt } from 'date-fns/locale';
import { useLanguage } from "@/components/common/LanguageProvider";

const locales = { nl, es, fr, de, it, pt, en: undefined };

const EventCard = ({ event, onEventClick, familyMembers }) => {
    const { t } = useLanguage();
    
    const getAssigneeColor = (ids) => {
        if (!ids || ids.length === 0) return '#9ca3af';
        const member = familyMembers.find(m => ids.includes(m.id));
        return member?.color || '#9ca3af';
    };

    const eventStart = parseISO(event.start_time);
    const eventEnd = parseISO(event.end_time);
    const color = getAssigneeColor(event.family_member_ids);
    
    const isMultiDay = format(eventStart, 'yyyy-MM-dd') !== format(eventEnd, 'yyyy-MM-dd');
    const isContinuation = event._isContinuation;
    const isFirstDay = event._isFirstDay;
    const isLastDay = event._isLastDay;
    
    return (
        <div
            className={`rounded p-1.5 cursor-pointer hover:shadow-sm transition-all border-l-2 ${
                isContinuation ? 'bg-gray-100/90 border-l-gray-400' : 'bg-white/90'
            } ${isMultiDay ? (isFirstDay ? 'rounded-r-none' : isLastDay ? 'rounded-l-none' : 'rounded-none') : ''}`}
            style={{ borderColor: isContinuation ? '#9ca3af' : color }}
            onClick={(e) => { e.stopPropagation(); onEventClick(event); }}
        >
            <div className="text-xs font-semibold text-gray-800 leading-tight whitespace-normal">
                {isContinuation ? `↳ ${event.short_title || event.title}` : (event.short_title || event.title)}
            </div>
            {isFirstDay && (
                <div className="text-[11px] text-gray-600">
                    {isMultiDay ? 
                        `${format(eventStart, 'HH:mm')} - ${format(eventEnd, 'dd/MM HH:mm')}` :
                        format(eventStart, 'HH:mm')
                    }
                </div>
            )}
            {isContinuation && !isLastDay && (
                <div className="text-[11px] text-gray-500">
                    {t('continues') || 'continues...'}
                </div>
            )}
            {isLastDay && !isFirstDay && (
                <div className="text-[11px] text-gray-600">
                    {t('until') || 'until'} {format(eventEnd, 'HH:mm')}
                </div>
            )}
        </div>
    );
};

export default function WeeklyCalendar({ events, familyMembers, onEventClick, onTimeSlotClick, initialDate }) {
  const [currentWeek, setCurrentWeek] = useState(startOfWeek(initialDate || new Date(), { weekStartsOn: 1 }));
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const { t, currentLanguage } = useLanguage();
  const locale = useMemo(() => locales[currentLanguage] || undefined, [currentLanguage]);

  useEffect(() => {
    setCurrentWeek(startOfWeek(initialDate || new Date(), { weekStartsOn: 1 }));
  }, [initialDate]);

  const navigateWeek = (direction) => {
    setCurrentWeek(prev => direction === 'next' ? addWeeks(prev, 1) : subWeeks(prev, 1));
  };
  
  const goToToday = () => {
    setCurrentWeek(startOfWeek(new Date(), { weekStartsOn: 1 }));
  };
  
  const handleDateSelect = (date) => {
    setCurrentWeek(startOfWeek(date, { weekStartsOn: 1 }));
    setIsPickerOpen(false);
  };

  const weekDays = useMemo(() => Array.from({ length: 7 }).map((_, i) => addDays(currentWeek, i)), [currentWeek]);

  const eventsByDay = useMemo(() => {
    const grouped = {};
    const multiDayEvents = [];
    
    weekDays.forEach(day => {
      const dayKey = format(day, 'yyyy-MM-dd');
      grouped[dayKey] = [];
    });

    (events || []).forEach(event => {
      const startDate = parseISO(event.start_time);
      const endDate = parseISO(event.end_time);
      
      const startDateKey = format(startDate, 'yyyy-MM-dd');
      const endDateKey = format(endDate, 'yyyy-MM-dd');
      
      // Check if this is a multi-day event
      if (startDateKey !== endDateKey) {
        // Calculate span across visible week days
        const eventStartInWeek = weekDays.findIndex(day => format(day, 'yyyy-MM-dd') === startDateKey);
        const eventEndInWeek = weekDays.findIndex(day => format(day, 'yyyy-MM-dd') === endDateKey);
        
        if (eventStartInWeek >= 0 || eventEndInWeek >= 0) {
          // Event spans within visible week
          const spanStart = Math.max(0, eventStartInWeek >= 0 ? eventStartInWeek : 0);
          const spanEnd = Math.min(6, eventEndInWeek >= 0 ? eventEndInWeek : 6);
          
          multiDayEvents.push({
            ...event,
            _spanStart: spanStart,
            _spanEnd: spanEnd,
            _spanLength: spanEnd - spanStart + 1,
            _isMultiDay: true
          });
        }
      } else {
        // Single day event
        if (grouped[startDateKey]) {
          grouped[startDateKey].push(event);
        }
      }
    });

    // Sort events within each day
    Object.keys(grouped).forEach(dayKey => {
      grouped[dayKey].sort((a, b) => parseISO(a.start_time) - parseISO(b.start_time));
    });

    return { grouped, multiDayEvents };
  }, [events, weekDays]);

  return (
    <Card className="shadow-sm border-famly-accent bg-white flex flex-col h-full">
      <CardHeader className="py-3 px-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <Popover open={isPickerOpen} onOpenChange={setIsPickerOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" className="text-lg font-semibold text-gray-700 p-1">
                {format(currentWeek, 'MMMM yyyy', { locale })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <CalendarPicker
                mode="single"
                selected={currentWeek}
                onSelect={handleDateSelect}
                initialFocus
              />
            </PopoverContent>
          </Popover>
            
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goToToday}>{t('today')}</Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigateWeek('prev')}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigateWeek('next')}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0 flex-1 flex flex-col">
        {/* Day Headers - Fixed column structure */}
        <div className="grid grid-cols-7 border-b border-famly-accent flex-shrink-0">
            {weekDays.map(day => {
                const isToday = checkIsToday(day);
                return (
                    <div key={day.toString()} className={`text-center py-2 border-r border-famly-accent last:border-r-0 ${isToday ? 'bg-blue-50' : ''}`}>
                        <div className={`text-xs font-medium ${isToday ? 'text-blue-600' : 'text-gray-500'}`}>{format(day, 'E', { locale })}</div>
                        <div className={`text-2xl font-light ${isToday ? 'text-blue-700' : 'text-gray-800'}`}>{format(day, 'd')}</div>
                    </div>
                );
            })}
        </div>
        
        {/* Event Grid - Matching column structure */}
        <div className="relative">
          {/* Multi-day events overlay */}
          <div className="absolute inset-0 pointer-events-none z-10">
            {eventsByDay.multiDayEvents.map((event, index) => (
              <div
                key={`multi-${event.id}`}
                className="absolute bg-blue-100 border border-blue-300 rounded p-1 cursor-pointer pointer-events-auto hover:bg-blue-200 transition-colors"
                style={{
                  left: `${(event._spanStart / 7) * 100}%`,
                  width: `${(event._spanLength / 7) * 100}%`,
                  top: `${index * 28 + 8}px`,
                  height: '24px',
                  borderLeftColor: event.family_member_ids?.length ? 
                    (familyMembers.find(m => event.family_member_ids.includes(m.id))?.color || '#3b82f6') : 
                    '#3b82f6'
                }}
                onClick={(e) => { e.stopPropagation(); onEventClick(event); }}
              >
                <div className="text-xs font-semibold text-blue-900 truncate">
                  {event.short_title || event.title}
                </div>
              </div>
            ))}
          </div>
          
          {/* Single day events grid */}
          <div className="grid grid-cols-7 flex-1" style={{ paddingTop: `${eventsByDay.multiDayEvents.length * 28 + 16}px` }}>
            {weekDays.map(day => {
              const dayKey = format(day, 'yyyy-MM-dd');
              const dayEvents = eventsByDay.grouped[dayKey] || [];
              // Calculate minimum height based on number of events
              const minHeight = Math.max(300, dayEvents.length * 40 + 20);
              return (
                <div 
                  key={dayKey} 
                  className="border-r border-famly-accent last:border-r-0 p-1 overflow-hidden"
                  style={{ minHeight: `${minHeight}px` }}
                  onClick={() => onTimeSlotClick(day, 9)}
                >
                  {dayEvents.length > 0 ? (
                    <div className="space-y-1">
                      {dayEvents.map(event => (
                        <EventCard 
                            key={event.id}
                            event={event} 
                            onEventClick={onEventClick} 
                            familyMembers={familyMembers}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="h-full w-full"></div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
