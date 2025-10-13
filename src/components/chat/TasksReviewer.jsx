import React, { useEffect, useState } from 'react';
import { useLanguage } from '@/components/common/LanguageProvider';
import InlineTaskReview from './InlineTaskReview';

// Pure editor: no confirm/cancel buttons, just edit and propagate up
export default function TasksReviewer({ tasks, familyMembers, onChange }) {
    const { t } = useLanguage();
    const [editableTasks, setEditableTasks] = useState(
        tasks.map(task => ({ ...task, selected: task.selected !== false }))
    );

    useEffect(() => {
        if (onChange) onChange(editableTasks);
        // eslint-disable-next-line
    }, [editableTasks]);

    const handleTaskUpdate = (index, updatedTask) => {
        setEditableTasks(currentTasks => 
            currentTasks.map((task, i) => i === index ? updatedTask : task)
        );
    };

    return (
        <div className="space-y-2">
            <h4 className="font-semibold text-sm text-green-800 mb-2">
                {t('aiSuggestedTasksTitle') || 'AI Suggested Tasks:'}
            </h4>
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
    );
}