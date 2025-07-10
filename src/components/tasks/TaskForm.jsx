
import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Calendar as CalendarIcon, X, Users, Repeat } from "lucide-react"; 
import { useLanguage } from "@/components/common/LanguageProvider";

export default function TaskForm({ isOpen, onClose, task, onSave, familyMembers }) {
  const { t } = useLanguage();
  
  const defaultTaskState = {
    title: "",
    description: "",
    status: "todo",
    priority: "medium",
    category: "personal",
    assigned_to: [],
    due_date: "",
    estimated_duration: 30,
    points: 5,
    is_recurring: false,
    recurrence_pattern: "weekly"
  };
  
  const [currentTask, setCurrentTask] = useState(defaultTaskState);

  useEffect(() => {
    if (isOpen) {
      if (task) {
        // Properly merge existing task data with defaults, preserving all existing values
        setCurrentTask({
          title: task.title || "",
          description: task.description || "",
          status: task.status || "todo",
          priority: task.priority || "medium",
          category: task.category || "personal",
          assigned_to: task.assigned_to || [],
          due_date: task.due_date || "",
          estimated_duration: task.estimated_duration || 30,
          points: task.points || 5,
          is_recurring: task.is_recurring || false,
          recurrence_pattern: task.recurrence_pattern || "weekly"
        });
      } else {
        // Reset to default state for a new task
        setCurrentTask(defaultTaskState);
      }
    }
  }, [isOpen, task]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(currentTask);
  };

  const handleMemberToggle = (memberId) => {
    setCurrentTask(prev => ({
      ...prev,
      assigned_to: prev.assigned_to.includes(memberId)
        ? prev.assigned_to.filter(id => id !== memberId)
        : [...prev.assigned_to, memberId]
    }));
  };

  const removeMember = (memberId) => {
    setCurrentTask(prev => ({
      ...prev,
      assigned_to: prev.assigned_to.filter(id => id !== memberId)
    }));
  };

  const getSelectedMemberNames = () => {
    if (currentTask.assigned_to.length === 0) return t('assignToDefault');
    return t('membersSelected', { count: currentTask.assigned_to.length });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {task ? t('editTask') : t('createNewTask')}
          </DialogTitle>
        </DialogHeader>
        
        <form id="task-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto pr-2 space-y-4 p-1">
          <Input
            placeholder={t('taskPlaceholder')}
            value={currentTask.title}
            onChange={(e) => setCurrentTask({...currentTask, title: e.target.value})}
            className="text-lg"
            required
          />
          
          <Textarea
            placeholder={t('addDetails')}
            value={currentTask.description}
            onChange={(e) => setCurrentTask({...currentTask, description: e.target.value})}
            className="h-24"
          />

          <div>
            <Label>{t('assignToMembers')}</Label>
            {currentTask.assigned_to.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {currentTask.assigned_to.map(memberId => {
                  const member = familyMembers?.find(m => m.id === memberId);
                  return member ? (
                    <Badge
                      key={memberId}
                      variant="secondary"
                      className="flex items-center gap-1"
                    >
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: member.color }}
                      />
                      {member.name}
                      <button
                        type="button"
                        onClick={() => removeMember(memberId)}
                        className="ml-1 hover:bg-gray-200 rounded-full p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ) : null;
                })}
              </div>
            )}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <Users className="mr-2 h-4 w-4" />
                  {getSelectedMemberNames()}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-3">
                <div className="space-y-3">
                  <div className="font-medium text-sm">{t('selectMembers')}:</div>
                  {familyMembers?.map(member => (
                    <div key={member.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`task-member-${member.id}`}
                        checked={currentTask.assigned_to.includes(member.id)}
                        onCheckedChange={() => handleMemberToggle(member.id)}
                      />
                      <label
                        htmlFor={`task-member-${member.id}`}
                        className="flex items-center gap-2 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        <div 
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: member.color }}
                        />
                        {member.name}
                      </label>
                    </div>
                  ))}
                   <div className="text-xs text-gray-500 mt-2">
                      {t('leaveEmptyHint')}
                    </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex gap-4 flex-wrap">
            <Select
              value={currentTask.priority}
              onValueChange={(value) => setCurrentTask({...currentTask, priority: value})}
            >
              <SelectTrigger className="w-32">
                <SelectValue placeholder={t('priority')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">{t('low')}</SelectItem>
                <SelectItem value="medium">{t('medium')}</SelectItem>
                <SelectItem value="high">{t('high')}</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={currentTask.category}
              onValueChange={(value) => setCurrentTask({...currentTask, category: value})}
            >
              <SelectTrigger className="w-32">
                <SelectValue placeholder={t('category')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="chores">{t('chores')}</SelectItem>
                <SelectItem value="homework">{t('homework')}</SelectItem>
                <SelectItem value="shopping">{t('shopping')}</SelectItem>
                <SelectItem value="errands">{t('errands')}</SelectItem>
                <SelectItem value="personal">{t('personal')}</SelectItem>
                <SelectItem value="family">{t('family')}</SelectItem>
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {currentTask.due_date ? format(new Date(currentTask.due_date), 'PPP') : t('setDueDate')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <CalendarPicker
                  mode="single"
                  selected={currentTask.due_date ? new Date(currentTask.due_date) : undefined}
                  onSelect={(date) => setCurrentTask({...currentTask, due_date: date ? date.toISOString() : ""})}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="task_is_recurring"
                checked={currentTask.is_recurring}
                onCheckedChange={(checked) => setCurrentTask({...currentTask, is_recurring: !!checked})}
              />
              <Label htmlFor="task_is_recurring" className="flex items-center gap-2">
                <Repeat className="w-4 h-4" />
                {t('recurringTask')}
              </Label>
            </div>

            {currentTask.is_recurring && (
              <Select
                value={currentTask.recurrence_pattern}
                onValueChange={(value) => setCurrentTask({...currentTask, recurrence_pattern: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('selectRecurrence')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">{t('daily')}</SelectItem>
                  <SelectItem value="weekly">{t('weekly')}</SelectItem>
                  <SelectItem value="monthly">{t('monthly')}</SelectItem>
                  <SelectItem value="yearly">{t('yearly')}</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="duration">{t('estimatedDuration')}</Label>
              <Input
                id="duration"
                type="number"
                value={currentTask.estimated_duration}
                onChange={(e) => setCurrentTask({...currentTask, estimated_duration: parseInt(e.target.value) || 0})}
                min="0"
              />
            </div>
            <div>
              <Label htmlFor="points">{t('points')}</Label>
              <Input
                id="points"
                type="number"
                value={currentTask.points}
                onChange={(e) => setCurrentTask({...currentTask, points: parseInt(e.target.value) || 0})}
                min="0"
              />
            </div>
          </div>
        </form>
        
        <DialogFooter className="flex-shrink-0 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button type="submit" form="task-form" className="bg-blue-600 hover:bg-blue-700">
            {task ? t('updateTask') : t('createTask')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
