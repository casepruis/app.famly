import React from 'react';
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useLanguage } from '@/components/common/LanguageProvider';

export default function InlineEventReview({ event, eventIndex, familyMembers, onEventUpdate }) {
  const { t } = useLanguage();

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

  return (
    <div className="flex items-center gap-3 p-2 bg-emerald-50/80 border border-emerald-200/90 rounded-lg text-xs w-full shadow-sm">
      <Checkbox
        id={`event-select-${eventIndex}`}
        checked={event.selected || false}
        onCheckedChange={(checked) => handleUpdate('selected', checked)}
        className="h-4 w-4"
      />
      <Input
        value={event.title}
        onChange={(e) => handleUpdate('title', e.target.value)}
        className="flex-1 h-7 text-xs border-emerald-300 bg-white"
        placeholder={t('eventTitle') || 'Event title'}
      />
      <div className="flex items-center gap-4">
        {familyMembers.map(member => (
          <div key={member.id} className="flex items-center gap-1.5">
            <Checkbox
              id={`event-${eventIndex}-member-${member.id}`}
              checked={(event.assigned_to || []).includes(member.id)}
              onCheckedChange={(checked) => handleMemberAssignmentChange(member.id, checked)}
              className="h-4 w-4"
            />
            <label htmlFor={`event-${eventIndex}-member-${member.id}`} className="text-xs font-medium text-emerald-800 cursor-pointer">{member.name}</label>
          </div>
        ))}
      </div>
    </div>
  );
}
