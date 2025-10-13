
import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckSquare, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import TaskForm from "@/components/tasks/TaskForm";
import { Task } from "@/api/entities";
import { useToast } from "@/components/ui/use-toast";
import { useLanguage } from "@/components/common/LanguageProvider";
import { format, parseISO } from "date-fns";

export default function UpcomingTasks({ tasks, familyMembers }) {
  const [showDialog, setShowDialog] = useState(false);
  const [dialogData, setDialogData] = useState(null);
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { toast } = useToast();
  // Try to get reload from window context (Dashboard passes it via FamilyDataContext)
  const reload = (window.__famly_reload || (() => {}));
  
  const getAssigneeColor = (ids) => {
    if (!ids || ids.length === 0) return '#64748b'; // Default for "all members"
    const member = familyMembers.find(m => ids.includes(m.id));
    return member?.color || '#6366f1'; // Default member color
  };

  const handleAddTask = () => {
    setDialogData(null);
    setShowDialog(true);
  };
  const handleDialogClose = () => setShowDialog(false);
  const handleDialogSave = async (taskData) => {
    try {
      // Try to get user from localStorage (or pass as prop/context if available)
      const user = JSON.parse(localStorage.getItem("famlyai_user"));
      if (!user) throw new Error("User not loaded");
      let taskToSave = { ...taskData, family_id: user.family_id };
      await Task.create(taskToSave);
      toast({ title: t("task.createdTitle") || "Task created", description: taskToSave.title, duration: 5000 });
      setShowDialog(false);
      if (typeof reload === "function") reload();
    } catch (err) {
      toast({ title: t("errorSavingTask") || "Error saving task", description: err.message, variant: "destructive", duration: 5000 });
    }
  };

  return (
    <Card id="upcoming-tasks-card" className="h-full">
      <CardContent className="p-4">
        {showDialog && (
          <TaskForm
            isOpen={showDialog}
            onClose={handleDialogClose}
            onSave={handleDialogSave}
            familyMembers={familyMembers}
            task={dialogData}
          />
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-600">{t('upcomingTasks')}</span>
          </div>

          <Button
            variant="outline"
            size="icon"
            className="h-6 w-6 p-0 border-blue-200 text-blue-600 hover:bg-blue-50"
            onClick={handleAddTask}
          >
            +
          </Button>
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
        <div className="flex gap-2 mt-4">
          <Button variant="ghost" size="sm" className="w-full text-blue-600 hover:text-blue-700" onClick={() => navigate(createPageUrl('Tasks'))}>
            {t('viewAllTasks')} <ArrowRight className="w-4 h-4 ml-2" />
          </Button>

        </div>
      </CardContent>
    </Card>
  );
}
