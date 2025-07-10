
import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckSquare, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useLanguage } from "@/components/common/LanguageProvider";
import { format, parseISO } from "date-fns";

export default function UpcomingTasks({ tasks, familyMembers }) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  
  const getAssigneeColor = (ids) => {
    if (!ids || ids.length === 0) return '#64748b'; // Default for "all members"
    const member = familyMembers.find(m => ids.includes(m.id));
    return member?.color || '#6366f1'; // Default member color
  };

  return (
    <Card id="upcoming-tasks-card" className="h-full">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <CheckSquare className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-600">{t('upcomingTasks')}</span>
        </div>
        <div className="space-y-3">
          {tasks.length > 0 ? (
            tasks.map(task => (
              <div key={task.id} className="flex items-start gap-3">
                <div className="w-1 h-full rounded-full mt-1" style={{ backgroundColor: getAssigneeColor(task.assigned_to), alignSelf: 'stretch' }}></div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-800 break-words">{task.title}</p>
                  <p className="text-xs text-gray-500">
                    {task.due_date ? `${t('due')} ${format(parseISO(task.due_date), 'P')}` : t('noDueDate')}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-center text-gray-500 py-4">{t('noUpcomingTasks')}</p>
          )}
        </div>
        <Button variant="ghost" size="sm" className="w-full mt-4 text-blue-600 hover:text-blue-700" onClick={() => navigate(createPageUrl('Tasks'))}>
          {t('viewAllTasks')} <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </CardContent>
    </Card>
  );
}
