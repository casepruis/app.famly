/**
 * UpcomingEvents Component (Refactored)
 * 
 * Displays upcoming events in a card format.
 * Event creation is now handled by parent component via useEventCreation hook.
 */

import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, ArrowRight, Briefcase, GraduationCap, Heart, Stethoscope, Coffee, Home, Info, Cake, Plus } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useLanguage } from "@/components/common/LanguageProvider";

const getEventAppearance = (event) => {
  if (event.event_type === 'birthday') {
    return {
      Icon: Cake,
      color: '#ec4899', // pink-500
    };
  }

  const appearances = {
    school: { Icon: GraduationCap, color: '#3b82f6' }, // blue-500
    work: { Icon: Briefcase, color: '#8b5cf6' }, // violet-500
    sports: { Icon: Heart, color: '#22c55e' }, // green-500
    medical: { Icon: Stethoscope, color: '#ef4444' }, // red-500
    social: { Icon: Coffee, color: '#ec4899' }, // pink-500
    family: { Icon: Home, color: '#f97316' }, // orange-500
    other: { Icon: Info, color: '#6b7280' }, // gray-500
  };

  return appearances[event.category] || appearances.other;
};

export default function UpcomingEvents({ 
  events, 
  familyMembers, 
  onAddEvent,      // () => void - Opens new event dialog
  onEventClick     // (event) => void - Opens edit event dialog
}) {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const handleAddClick = () => {
    if (onAddEvent) {
      onAddEvent();
    } else {
      // Fallback: navigate to schedule page with new event action
      navigate(createPageUrl('Schedule') + '?action=new');
    }
  };

  const handleEventClick = (event) => {
    if (onEventClick) {
      onEventClick(event);
    } else {
      // Fallback: navigate to schedule page
      navigate(createPageUrl('Schedule'));
    }
  };

  return (
    <Card id="upcoming-events-card" className="h-full">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-600">{t('upcomingEvents') || 'Upcoming Events'}</span>
          </div>

          <Button
            variant="outline"
            size="icon"
            className="h-6 w-6 p-0 border-blue-200 text-blue-600 hover:bg-blue-50"
            onClick={handleAddClick}
            title={t('addEvent') || 'Add Event'}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>

        <div className="space-y-3">
          {events && events.length > 0 ? (
            events.map(event => {
              const { Icon, color } = getEventAppearance(event);
              
              const isAllFamilyEvent = !event.family_member_ids || 
                event.family_member_ids.length === 0 || 
                (familyMembers?.length > 0 && event.family_member_ids.length === familyMembers.length);

              const assignee = !isAllFamilyEvent && familyMembers
                ? familyMembers.find(m => m.id === event.family_member_ids?.[0])
                : null;

              return (
                <div 
                  key={event.id} 
                  className="flex items-start gap-3 p-2 rounded-lg transition-colors hover:bg-gray-50/50 cursor-pointer"
                  onClick={() => handleEventClick(event)}
                >
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" 
                    style={{ 
                      backgroundColor: `${isAllFamilyEvent ? '#64748b' : color}1A`, 
                      color: isAllFamilyEvent ? '#64748b' : color 
                    }}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-800 break-words">
                      {event.short_title || event.title}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                      <span>{format(parseISO(event.start_time), 'MMM d, p')}</span>
                      {isAllFamilyEvent ? (
                        <>
                          <span className="text-gray-300">•</span>
                          <div className="flex items-center gap-1">
                            <Home className="w-3 h-3 text-gray-400" />
                            <span className="break-words">{t('allFamily') || 'All Family'}</span>
                          </div>
                        </>
                      ) : assignee && (
                        <>
                          <span className="text-gray-300">•</span>
                          <div className="flex items-center gap-1">
                            <div 
                              className="w-2 h-2 rounded-full" 
                              style={{ backgroundColor: assignee.color || '#6b7280' }}
                            />
                            <span className="break-words">{assignee.name}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-center text-gray-500 py-4">
              {t('noUpcomingEvents') || 'No upcoming events'}
            </p>
          )}
        </div>

        <div className="flex gap-2 mt-4">
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full text-blue-600 hover:text-blue-700" 
            onClick={() => navigate(createPageUrl('Schedule'))}
          >
            {t('viewFullSchedule') || 'View Full Schedule'} 
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
