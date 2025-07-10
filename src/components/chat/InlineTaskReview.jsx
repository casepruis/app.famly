import React from 'react';
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useLanguage } from '@/components/common/LanguageProvider';

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
    <div className="flex items-center gap-3 p-2 bg-green-50/80 border border-green-200/90 rounded-lg text-xs w-full shadow-sm">
      <Checkbox
        id={`task-select-${taskIndex}`}
        checked={task.selected || false}
        onCheckedChange={(checked) => handleUpdate('selected', checked)}
        className="h-4 w-4"
      />
      <Input
        value={task.title}
        onChange={(e) => handleUpdate('title', e.target.value)}
        className="flex-1 h-7 text-xs border-green-300 bg-white"
        placeholder={t('taskTitle') || 'Task title'}
      />
      <div className="flex items-center gap-4">
        {familyMembers.map(member => (
          <div key={member.id} className="flex items-center gap-1.5">
            <Checkbox
              id={`task-${taskIndex}-member-${member.id}`}
              checked={(task.assigned_to || []).includes(member.id)}
              onCheckedChange={(checked) => handleMemberAssignmentChange(member.id, checked)}
              className="h-4 w-4"
            />
            <label htmlFor={`task-${taskIndex}-member-${member.id}`} className="text-xs font-medium text-green-800 cursor-pointer">{member.name}</label>
          </div>
        ))}
      </div>
    </div>
  );
}