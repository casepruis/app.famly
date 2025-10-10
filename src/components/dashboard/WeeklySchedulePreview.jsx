
import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import { format, startOfWeek, addDays, addWeeks, subWeeks, parseISO, isToday } from "date-fns";
import { nl, es, fr, de, it, pt } from 'date-fns/locale';
import { useLanguage } from "@/components/common/LanguageProvider";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { User } from '@/api/entities';
import ResourceCalendar from '../schedule/ResourceCalendar'; // WeeklyCalendar is no longer used directly in this component

const locales = { nl, es, fr, de, it, pt, en: undefined };

const EventCard = ({ event, familyMembers }) => {
    const getAssigneeColor = (ids) => {
        if (!ids || ids.length === 0) return '#9ca3af';
        const member = familyMembers.find(m => ids.includes(m.id));
        return member?.color || '#9ca3af';
    };

    const eventStart = parseISO(event.start_time);
    const color = getAssigneeColor(event.family_member_ids);
    
    return (
        <div
            className="rounded p-1 mb-1 bg-white/90 border-l-2"
            style={{ borderColor: color }}
        >
            <div className="text-xs font-semibold text-gray-800 leading-tight">
                {event.short_title || event.title}
            </div>
            <div className="text-[10px] text-gray-600">
                {format(eventStart, 'HH:mm')}
            </div>
        </div>
    );
};

export default function WeeklySchedulePreview({ events, familyMembers, onDayClick, onEventClick }) {
    const [currentWeek, setCurrentWeek] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
    const [calendarView, setCalendarView] = useState('weekly');
    const [useDashboardFavorite, setUseDashboardFavorite] = useState(false);
    const { t, currentLanguage } = useLanguage();
    const navigate = useNavigate();
    const locale = useMemo(() => locales[currentLanguage] || undefined, [currentLanguage]);

    useEffect(() => {
        const loadUserPreference = async () => {
            try {
                const user = await User.me();
                if (user) {
                    // Use dashboard favorite view if set, otherwise fall back to general preference
                    if (user.dashboard_favorite_view) {
                        setCalendarView(user.dashboard_favorite_view);
                        setUseDashboardFavorite(true);
                    } else if (user.preferred_calendar_view) {
                        setCalendarView(user.preferred_calendar_view);
                    }
                }
            } catch (error) {
                console.warn("Could not load user preference for schedule preview:", error);
            }
        };
        loadUserPreference();
    }, []);

    const navigateWeek = (direction) => {
        setCurrentWeek(prev => direction === 'next' ? addWeeks(prev, 1) : subWeeks(prev, 1));
    };

    const weekDays = useMemo(() => Array.from({ length: 7 }).map((_, i) => addDays(currentWeek, i)), [currentWeek]);

    const eventsByDay = useMemo(() => {
        const grouped = {};
        weekDays.forEach(day => {
            const dayKey = format(day, 'yyyy-MM-dd');
            grouped[dayKey] = (events || [])
                .filter(event => format(parseISO(event.start_time), 'yyyy-MM-dd') === dayKey)
                .sort((a, b) => parseISO(a.start_time) - parseISO(b.start_time));
        });
        return grouped;
    }, [events, weekDays]);

    return (
        <Card className="h-full border-famly-accent bg-white flex flex-col">
            <CardHeader className="pb-3 flex-shrink-0">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base font-semibold text-famly-text-primary">
                        <Calendar className="w-5 h-5 text-blue-500" />
                        {t('weeklySchedule') || 'Weekly Schedule'}
                    </CardTitle>
                    <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => navigateWeek('prev')}>
                            <ChevronLeft className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => navigateWeek('next')}>
                            <ChevronRight className="w-3 h-3" />
                        </Button>
                    </div>
                </div>
                <div className="text-sm text-gray-600">
                    {format(currentWeek, 'MMMM yyyy', { locale })}
                </div>
            </CardHeader>
            <CardContent className="pt-0 flex-1 overflow-hidden">
                {calendarView === 'weekly' ? (
                    // Weekly view with proper grid layout
                    <div className="h-full flex flex-col">
                        <div className="grid grid-cols-7 border-b border-gray-200 flex-shrink-0">
                            {weekDays.map(day => {
                                const isTodayCheck = isToday(day);
                                return (
                                    <div key={day.toString()} className={`text-center py-1 border-r border-gray-200 last:border-r-0 ${isTodayCheck ? 'bg-blue-50' : ''}`}>
                                        <div className={`text-[10px] font-medium ${isTodayCheck ? 'text-blue-600' : 'text-gray-500'}`}>{format(day, 'E', { locale })}</div>
                                        <div className={`text-sm font-light ${isTodayCheck ? 'text-blue-700' : 'text-gray-800'}`}>{format(day, 'd')}</div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="grid grid-cols-7 flex-1">
                            {weekDays.map(day => {
                                const dayKey = format(day, 'yyyy-MM-dd');
                                const dayEvents = eventsByDay[dayKey] || [];
                                return (
                                    <div
                                        key={dayKey}
                                        className="border-r border-gray-200 last:border-r-0 p-1 overflow-hidden cursor-pointer group"
                                        onClick={e => {
                                            // Only trigger add if clicking empty space (not on event)
                                            if (onDayClick && e.target === e.currentTarget) {
                                                onDayClick(day);
                                            }
                                        }}
                                    >
                                        {dayEvents.map((event, idx) => (
                                            <div
                                                key={event.id || `${dayKey}-${idx}`}
                                                onClick={ev => {
                                                    ev.stopPropagation();
                                                    if (onEventClick) onEventClick(event);
                                                }}
                                            >
                                                <EventCard event={event} familyMembers={familyMembers} />
                                            </div>
                                        ))}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    // Resource view - compact fit for dashboard
                    <div className="h-full w-full overflow-hidden">
                        <ResourceCalendar 
                            events={events} 
                            familyMembers={familyMembers} 
                            onEventClick={(e) => navigate(createPageUrl('Schedule'))} 
                            onTimeSlotClick={() => navigate(createPageUrl('Schedule'))} 
                            initialDate={currentWeek} 
                        />
                    </div>
                )}
            </CardContent>
            <CardFooter className="p-3 border-t flex-shrink-0">
                <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full text-blue-600 hover:text-blue-700" 
                    onClick={() => navigate(createPageUrl('Schedule'))}
                >
                    {t('viewFullSchedule') || 'View full schedule'} 
                    <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
            </CardFooter>
        </Card>
    );
}
