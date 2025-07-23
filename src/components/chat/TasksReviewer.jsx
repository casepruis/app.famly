import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { useLanguage } from '@/components/common/LanguageProvider';
import InlineTaskReview from './InlineTaskReview';

export default function TasksReviewer({ tasks, familyMembers, onConfirm, onCancel }) {
    const { t } = useLanguage();
    // Initialize tasks with a 'selected' property
    const [editableTasks, setEditableTasks] = useState(
        tasks.map(task => ({ ...task, selected: true }))
    );

    const handleTaskUpdate = (index, updatedTask) => {
        setEditableTasks(currentTasks => 
            currentTasks.map((task, i) => i === index ? updatedTask : task)
        );
    };

    const handleConfirm = () => {
        // Filter only the selected tasks to be created
        const confirmedTasks = editableTasks.filter(task => task.selected);
        onConfirm(confirmedTasks);
    };

    return (
        <div className="p-3 bg-green-50/50 border border-green-200 rounded-lg shadow-sm space-y-3">
            <h4 className="font-semibold text-sm text-green-800">
                {t('aiSuggestedTasksTitle') || 'AI Suggested Tasks:'}
            </h4>
            <div className="space-y-2">
                {editableTasks.map((task, index) => (
                    <InlineTaskReview
                        key={index}
                        task={task}
                        taskIndex={index}
                        familyMembers={familyMembers}
                        onTaskUpdate={handleTaskUpdate}
                    />
                ))}
            </div>
            <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" onClick={onCancel}>
                    {t('cancel') || 'Cancel'}
                </Button>
                <Button size="sm" onClick={handleConfirm} className="bg-green-600 hover:bg-green-700">
                    {t('confirm') || 'Confirm'}
                </Button>
            </div>
        </div>
    );
}