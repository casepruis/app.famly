import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Sparkles, Gift } from "lucide-react";
import { useLanguage } from "@/components/common/LanguageProvider";

export default function AIReviewDialog({ isOpen, onClose, reviewData, onConfirm }) {
  const [selectedTaskIndices, setSelectedTaskIndices] = useState([]);
  const { t } = useLanguage();

  useEffect(() => {
    if (reviewData) {
      // Always start with no tasks selected when the dialog opens with new data
      setSelectedTaskIndices([]);
    }
  }, [reviewData]);

  const handleTaskToggle = (taskIndex, checked) => {
    if (checked) {
      setSelectedTaskIndices(prev => [...prev, taskIndex]);
    } else {
      setSelectedTaskIndices(prev => prev.filter(index => index !== taskIndex));
    }
  };

  const handleConfirm = () => {
    let finalEvent = { ...reviewData.originalEvent };
    
    const tasksToCreate = selectedTaskIndices.map(index => reviewData.aiResult.suggestedTasks[index]);
    console.log('Tasks being created:', tasksToCreate);
    onConfirm(finalEvent, tasksToCreate);
  };
  
  if (!isOpen || !reviewData) return null;

  const { aiResult } = reviewData;
  const totalTasks = aiResult.suggestedTasks?.length || 0;
  const selectedCount = selectedTaskIndices.length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-500"/>
            AI Suggesties ({selectedCount}/{totalTasks} geselecteerd)
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {aiResult.aiMessage && (
            <p className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
              {aiResult.aiMessage}
            </p>
          )}

          {aiResult.suggestedTasks?.length > 0 ? (
            <div className="space-y-3">
              <h4 className="font-semibold text-gray-800">Voorgestelde taken ({totalTasks}):</h4>
              {aiResult.suggestedTasks.map((task, index) => (
                <div key={index} className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <Checkbox 
                    id={`task-${index}`} 
                    checked={selectedTaskIndices.includes(index)}
                    onCheckedChange={(checked) => handleTaskToggle(index, checked)}
                    className="mt-1"
                  />
                  <Label htmlFor={`task-${index}`} className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2 font-medium text-blue-900 mb-1">
                      <Gift className="w-4 h-4" />
                      {task.title}
                    </div>
                    {task.description && (
                      <p className="text-sm text-blue-700 mb-1">{task.description}</p>
                    )}
                    {task.due_date && (
                      <p className="text-xs text-gray-600">Vervalt op: {new Date(task.due_date).toLocaleDateString()}</p>
                    )}
                  </Label>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 py-8">Geen taken voorgesteld</p>
          )}
        </div>
        
        <DialogFooter className="flex-shrink-0 border-t pt-4 gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Annuleren
          </Button>
          <Button onClick={handleConfirm} className="flex-1">
            {selectedCount > 0 ? `${selectedCount} taken bevestigen` : 'Alleen evenement opslaan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}