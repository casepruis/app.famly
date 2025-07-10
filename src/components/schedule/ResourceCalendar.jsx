
import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { format, startOfWeek, addDays, addWeeks, subWeeks, parseISO, isToday } from "date-fns";
import { nl, es, fr, de, it, pt } from 'date-fns/locale';
import { useLanguage } from "@/components/common/LanguageProvider";

const locales = { nl, es, fr, de, it, pt, en: undefined };

// Renamed DetailedEventCard to EventCard and added familyMembers prop as per changes
const EventCard = ({ event, onEventClick, familyMembers }) => {
    // Ensure event.originalEvent exists before proceeding
    if (!event.originalEvent?.start_time) {
        return null;
    }

    try {
        const startTime = parseISO(event.originalEvent.start_time);
        
        return (
            <div
                className="rounded p-1.5 mb-1 cursor-pointer hover:shadow-sm transition-all bg-white/90 border-l-2"
                style={{ borderColor: event.assigneeColor || '#9ca3af' }}
                onClick={(e) => { e.stopPropagation(); onEventClick(event.originalEvent); }}
            >
                <div className="text-xs font-semibold text-gray-800 leading-tight whitespace-normal">
                    {event.originalEvent.short_title || event.originalEvent.title || 'Untitled Event'}
                </div>
                <div className="text-[11px] text-gray-600">
                    {format(startTime, 'HH:mm')}
                </div>
                {/* Potential area for inline datetime editing features
                    The 'familyMembers' prop is now available here if needed for editing context.
                */}
            </div>
        );
    } catch (error) {
        console.error('Error parsing event dates:', error, event.originalEvent);
        return null;
    }
};

export default function ResourceCalendar({ events, familyMembers, onEventClick, onTimeSlotClick, initialDate }) {
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

  const filteredFamilyMembers = useMemo(() => familyMembers.filter(m => m && m.role !== 'ai_assistant'), [familyMembers]);

  const rows = useMemo(() => [
    ...filteredFamilyMembers,
    { id: 'family-unassigned', name: t('family') || 'Family', color: '#64748b' }
  ], [filteredFamilyMembers, t]);

  const eventsByDayAndMember = useMemo(() => {
    const grouped = {}; // For single-day events
    const multiDayEventsByMember = {}; // For multi-day events (stored on their effective start day in the week)
    
    for (const day of weekDays) {
      const dayKey = format(day, 'yyyy-MM-dd');
      grouped[dayKey] = {};
      multiDayEventsByMember[dayKey] = {}; // Initialize for current day

      for (const member of rows) {
        grouped[dayKey][member.id] = [];
        multiDayEventsByMember[dayKey][member.id] = []; // Initialize for current member
      }

      const dayEvents = (events || []).filter(event => {
        if (!event.start_time || !event.end_time) return false;
        try {
          const eventStartDate = format(parseISO(event.start_time), 'yyyy-MM-dd');
          const eventEndDate = format(parseISO(event.end_time), 'yyyy-MM-dd');
          
          // Include if event starts on this day OR spans through this day
          return eventStartDate <= dayKey && eventEndDate >= dayKey;
        } catch (error) {
          console.error("Error parsing event start/end time for filtering:", error, event);
          return false;
        }
      });

      for (const event of dayEvents) {
        const eventStartDateFormatted = format(parseISO(event.start_time), 'yyyy-MM-dd');
        const eventEndDateFormatted = format(parseISO(event.end_time), 'yyyy-MM-dd');
        const isMultiDay = eventStartDateFormatted !== eventEndDateFormatted;
        
        const processEventForMember = (memberId, color) => {
          if (grouped[dayKey][memberId]) { // Ensure memberId exists for this day
            if (isMultiDay) {
              const eventStartInWeekIndex = weekDays.findIndex(d => format(d, 'yyyy-MM-dd') === eventStartDateFormatted);
              const eventEndInWeekIndex = weekDays.findIndex(d => format(d, 'yyyy-MM-dd') === eventEndDateFormatted);
              
              const currentDayIndex = weekDays.findIndex(d => format(d, 'yyyy-MM-dd') === dayKey);

              // Calculate span within the visible week (0-6)
              const spanStart = Math.max(0, eventStartInWeekIndex);
              const spanEnd = Math.min(6, eventEndInWeekIndex === -1 ? 6 : eventEndInWeekIndex); // If event ends after week, span till end of week.
              
              // Only add the multi-day event to `multiDayEventsByMember` on its first visible day in the week.
              // This is either its actual start day if it's within the week, or the first day of the week if it started before.
              if (currentDayIndex === spanStart) {
                multiDayEventsByMember[dayKey][memberId].push({
                  originalEvent: event,
                  assigneeColor: color,
                  _spanStart: spanStart,
                  _spanEnd: spanEnd,
                  _spanLength: spanEnd - spanStart + 1,
                  _isMultiDay: true
                });
              }
            } else {
              // Add single-day events to the grouped object
              grouped[dayKey][memberId].push({ originalEvent: event, assigneeColor: color });
            }
          }
        };

        if (event.family_member_ids && event.family_member_ids.length > 0) {
          event.family_member_ids.forEach(memberId => {
            const member = filteredFamilyMembers.find(m => m.id === memberId);
            if (member) { // Ensure member exists
              processEventForMember(memberId, member.color);
            }
          });
        } else {
          processEventForMember('family-unassigned', '#64748b');
        }
      }

      // Sort single-day events for each member and day
      Object.keys(grouped[dayKey]).forEach(memberId => {
        try {
          grouped[dayKey][memberId].sort((a, b) => parseISO(a.originalEvent.start_time) - parseISO(b.originalEvent.start_time));
        } catch (error) {
          console.error('Error sorting events for day ' + dayKey + ' and member ' + memberId + ':', error);
        }
      });
      // Multi-day events don't need sorting per day as they are banners.
    }
    return { grouped, multiDayEventsByMember };
  }, [events, weekDays, rows, filteredFamilyMembers]);

  /**
   * Calculates the required height for a member's row.
   * The height is determined by the day with the maximum number of single-day events in that row,
   * plus the vertical space required for multi-day event banners.
   * @param {string} memberId - The ID of the family member.
   * @param {object} allMultiDayEventsByMember - The full multiDayEventsByMember object from useMemo.
   * @returns {number} The calculated height in pixels.
   */
  const getRowHeight = (memberId, allMultiDayEventsByMember) => {
    let maxSingleDayEvents = 0;
    weekDays.forEach(day => {
      const dayKey = format(day, 'yyyy-MM-dd');
      // Get count of single-day events for this member on this day
      const eventCount = eventsByDayAndMember.grouped[dayKey]?.[memberId]?.length || 0;
      maxSingleDayEvents = Math.max(maxSingleDayEvents, eventCount);
    });

    // Collect all unique multi-day events for this specific member across the week
    const multiDayEventsForMember = Object.values(allMultiDayEventsByMember)
      .flatMap(dayData => dayData[memberId] || [])
      .filter((event, index, self) => 
          index === self.findIndex((e) => e.originalEvent.id === event.originalEvent.id)
      );

    const multiDayEventsVerticalSpace = (multiDayEventsForMember.length * 28) + (multiDayEventsForMember.length > 0 ? 16 : 0); // 24px height + 4px margin = 28px per event. + 16px base padding
    
    const baseHeight = 60; // Minimum height for a row if no single-day events are present
    const eventHeight = 50; // Height per single-day event card (includes margins and padding)
    const extraPadding = 10; // Extra padding for single-day event content to ensure they don't overflow

    // Calculate height needed for single-day events part
    const singleDayContentHeight = Math.max(baseHeight, (maxSingleDayEvents * eventHeight) + extraPadding);
    
    // Total row height is the sum of space for multi-day banners and space for single-day events.
    return multiDayEventsVerticalSpace + singleDayContentHeight;
  };

  return (
    <Card className="shadow-sm border-famly-accent bg-white flex flex-col">
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
      
      <CardContent className="p-0 flex-1 overflow-hidden">
        <div className="h-full flex flex-col">
          {/* Header row - Fixed widths using CSS Grid */}
          <div className="grid grid-cols-[64px_1fr_1fr_1fr_1fr_1fr_1fr_1fr] border-b border-famly-accent bg-gray-50/50 flex-shrink-0">
            <div className="border-r border-famly-accent"></div>
            {weekDays.map(day => {
              const isTodayResult = isToday(day);
              return (
                <div key={format(day, 'yyyy-MM-dd')} className={`p-1 text-center border-r border-famly-accent ${isTodayResult ? 'bg-blue-50' : ''}`}>
                  <div className={`text-[10px] font-medium ${isTodayResult ? 'text-blue-600' : 'text-gray-600'}`}>{format(day, 'E', { locale })}</div>
                  <div className={`text-sm font-light ${isTodayResult ? 'text-blue-700' : 'text-gray-800'}`}>{format(day, 'd')}.</div>
                </div>
              );
            })}
          </div>

          {/* Member rows - Matching grid structure */}
          <div className="flex-1 overflow-y-auto">
            {rows.map(member => {
              const rowHeight = getRowHeight(member.id, eventsByDayAndMember.multiDayEventsByMember);
              const multiDayEventsForMember = Object.values(eventsByDayAndMember.multiDayEventsByMember)
                .flatMap(dayData => dayData[member.id] || [])
                .filter((event, index, self) => 
                    index === self.findIndex((e) => e.originalEvent.id === event.originalEvent.id)
                );
              
              return (
                <div key={member.id} className="relative" style={{ height: `${rowHeight}px` }}>
                  {/* Multi-day events overlay for this member */}
                  <div className="absolute inset-0 pointer-events-none z-10">
                    {multiDayEventsForMember.map((event, index) => (
                      <div
                        key={`multi-${event.originalEvent.id}-${member.id}`}
                        className="absolute bg-blue-100 border border-blue-300 rounded p-1 cursor-pointer pointer-events-auto hover:bg-blue-200 transition-colors"
                        style={{
                          // The `64` in `64 + ...` assumes a fixed pixel width for the first column.
                          // The remaining `(100 - 64/7)` might be a percentage scaling logic. This blend of units can be tricky.
                          // It's implemented as per the outline:
                          left: `calc(64px + ((100% - 64px) / 7 * ${event._spanStart}))`,
                          width: `calc(((100% - 64px) / 7 * ${event._spanLength}))`,
                          top: `${index * 28 + 8}px`, // 24px event height + 4px margin = 28px per event, plus 8px top offset
                          height: '24px',
                          borderLeftColor: event.assigneeColor,
                          zIndex: 20 // Ensure banners are above grid background
                        }}
                        onClick={(e) => { e.stopPropagation(); onEventClick(event.originalEvent); }}
                      >
                        <div className="text-xs font-semibold truncate" style={{ color: event.assigneeColor }}>
                          {event.originalEvent.short_title || event.originalEvent.title || 'Untitled Event'}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Regular grid for single-day events */}
                  <div 
                    className="grid grid-cols-[64px_1fr_1fr_1fr_1fr_1fr_1fr_1fr] border-b border-gray-200 h-full" 
                    style={{ paddingTop: `${multiDayEventsForMember.length * 28 + (multiDayEventsForMember.length > 0 ? 16 : 0)}px` }}
                  >
                    <div className="border-r border-famly-accent bg-gray-50/30 p-1 flex items-start pt-2">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: member.color }}/>
                        <span className="text-xs font-medium text-gray-700 truncate">{member.name}</span>
                      </div>
                    </div>
                    {weekDays.map(day => {
                      const dayKey = format(day, 'yyyy-MM-dd');
                      const cellEvents = eventsByDayAndMember.grouped[dayKey]?.[member.id] || [];
                      const isTodayResult = isToday(day);
                      
                      return (
                        <div 
                          key={dayKey} 
                          className={`border-r border-famly-accent p-1 hover:bg-gray-50/50 cursor-pointer transition-colors overflow-hidden ${isTodayResult ? 'bg-blue-50/30' : ''}`}
                          onClick={() => onTimeSlotClick(day, 9, member.id === 'family-unassigned' ? null : member.id)}
                        >
                            {/* Implementation of the outline starts here */}
                            <div className="flex-1 overflow-y-auto">
                                <div className="space-y-1 p-1">
                                    {cellEvents.map((event, index) => (
                                        <EventCard 
                                            key={`${event.originalEvent.id}-${member.id}-${index}`}
                                            event={event} 
                                            onEventClick={onEventClick} 
                                            familyMembers={familyMembers} // Added familyMembers prop
                                        />
                                    ))}
                                    {cellEvents.length === 0 && (
                                       <div className="h-full flex items-center justify-center opacity-0 hover:opacity-30 transition-opacity">
                                          <Plus className="w-3 h-3 text-gray-400" />
                                      </div>
                                    )}
                                </div>
                            </div>
                            {/* Implementation of the outline ends here */}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
