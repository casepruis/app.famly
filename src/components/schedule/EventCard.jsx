
import React, { useState } from 'react';
import { format, parseISO } from "date-fns";
import { useLanguage } from "@/components/common/LanguageProvider";
import { motion } from "framer-motion";
import { Edit, Trash2 } from "lucide-react";

// onEdit and onDelete are optional props for swipe actions
const EventCard = ({ event, onEventClick, familyMembers, onEdit, onDelete }) => {
    const { t } = useLanguage();
    const [dragX, setDragX] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [exitX, setExitX] = useState(0);

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

    const handleDragEnd = (eventObj, info) => {
        setIsDragging(false);
        const threshold = 80;
        if (info.offset.x < -threshold && onEdit) {
            setExitX(-500);
            onEdit(event);
        } else if (info.offset.x > threshold && onDelete) {
            setExitX(500);
            onDelete(event);
        }
        setDragX(0);
    };

    const handleDrag = (eventObj, info) => {
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
                className="absolute inset-y-0 left-full w-20 bg-blue-500 flex items-center justify-start pl-5 rounded-l-lg"
                style={{ right: '-5rem' }}
                animate={{ opacity: isDragging && dragX < -40 ? 1 : 0 }}
            >
                <Edit className="w-5 h-5 text-white" />
            </motion.div>
            <motion.div
                className="absolute inset-y-0 right-full w-20 bg-red-500 flex items-center justify-end pr-5 rounded-r-lg"
                style={{ left: '-5rem' }}
                animate={{ opacity: isDragging && dragX > 40 ? 1 : 0 }}
            >
                <Trash2 className="w-5 h-5 text-white" />
            </motion.div>

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
        </motion.div>
    );
};

export default EventCard;