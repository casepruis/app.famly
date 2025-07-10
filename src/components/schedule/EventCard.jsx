import React from 'react';
import { format, parseISO } from "date-fns";
import { useLanguage } from "@/components/common/LanguageProvider";

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
            className={`rounded p-1.5 mb-1 cursor-pointer hover:shadow-sm transition-all border-l-2 ${
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

export default EventCard;