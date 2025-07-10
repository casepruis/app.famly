
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Plus, Trash2, Save } from "lucide-react";

const TRIGGERS = [
  { id: 'email_received', name: 'Email Received', app: 'Gmail' },
  { id: 'calendar_event', name: 'Calendar Event Created', app: 'Google Calendar' },
  { id: 'task_completed', name: 'Task Completed', app: 'FamilySync' },
  { id: 'new_family_member', name: 'New Family Member Added', app: 'FamilySync' }
];

const ACTIONS = [
  { id: 'create_task', name: 'Create Task', app: 'FamilySync' },
  { id: 'send_notification', name: 'Send Notification', app: 'FamilySync' },
  { id: 'add_calendar_event', name: 'Add Calendar Event', app: 'Google Calendar' },
  { id: 'send_email', name: 'Send Email', app: 'Gmail' }
];

const CONDITIONS = [
  { id: 'contains_keyword', name: 'Contains Keyword' },
  { id: 'from_sender', name: 'From Specific Sender' },
  { id: 'time_range', name: 'Within Time Range' },
  { id: 'priority_level', name: 'Priority Level' }
];

export default function FlowBuilder({ isOpen, onClose, onSave, editingFlow = null }) {
  const [flow, setFlow] = useState(editingFlow || {
    name: '',
    description: '',
    trigger: '',
    conditions: [],
    actions: [],
    active: true
  });

  const handleSave = async () => {
    try {
      const response = await fetch('/api/automation/flows', {
        method: editingFlow ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...flow,
          id: editingFlow?.id
        })
      });
      
      if (response.ok) {
        onSave(flow);
        onClose();
      }
    } catch (error) {
      console.error('Failed to save flow:', error);
    }
  };

  const addCondition = () => {
    setFlow({
      ...flow,
      conditions: [...flow.conditions, { type: '', value: '', operator: 'equals' }]
    });
  };

  const addAction = () => {
    setFlow({
      ...flow,
      actions: [...flow.actions, { type: '', config: {} }]
    });
  };

  const removeCondition = (index) => {
    setFlow({
      ...flow,
      conditions: flow.conditions.filter((_, i) => i !== index)
    });
  };

  const removeAction = (index) => {
    setFlow({
      ...flow,
      actions: flow.actions.filter((_, i) => i !== index)
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingFlow ? 'Edit automation flow' : 'Create new automation flow'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Flow name</Label>
              <Input
                value={flow.name}
                onChange={(e) => setFlow({...flow, name: e.target.value})}
                placeholder="My Automation Flow"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={flow.description}
                onChange={(e) => setFlow({...flow, description: e.target.value})}
                placeholder="What does this flow do?"
              />
            </div>
          </div>

          {/* Trigger Section */}
          <Card>
            <CardContent className="p-4">
              <h4 className="font-medium mb-3">When this happens (trigger)</h4>
              <Select 
                value={flow.trigger} 
                onValueChange={(value) => setFlow({...flow, trigger: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a trigger" />
                </SelectTrigger>
                <SelectContent>
                  {TRIGGERS.map(trigger => (
                    <SelectItem key={trigger.id} value={trigger.id}>
                      {trigger.name} ({trigger.app})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Conditions Section */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium">If these conditions are met (optional)</h4>
                <Button variant="outline" size="sm" onClick={addCondition}>
                  <Plus className="w-4 h-4 mr-1" />
                  Add condition
                </Button>
              </div>
              
              {flow.conditions.map((condition, index) => (
                <div key={index} className="flex items-center gap-2 mb-2 p-3 bg-gray-50 rounded-lg">
                  <Select
                    value={condition.type}
                    onValueChange={(value) => {
                      const newConditions = [...flow.conditions];
                      newConditions[index] = {...condition, type: value};
                      setFlow({...flow, conditions: newConditions});
                    }}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Condition" />
                    </SelectTrigger>
                    <SelectContent>
                      {CONDITIONS.map(cond => (
                        <SelectItem key={cond.id} value={cond.id}>
                          {cond.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Input
                    placeholder="Value"
                    value={condition.value}
                    onChange={(e) => {
                      const newConditions = [...flow.conditions];
                      newConditions[index] = {...condition, value: e.target.value};
                      setFlow({...flow, conditions: newConditions});
                    }}
                  />
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeCondition(index)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Actions Section */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium">Then do this (actions)</h4>
                <Button variant="outline" size="sm" onClick={addAction}>
                  <Plus className="w-4 h-4 mr-1" />
                  Add action
                </Button>
              </div>
              
              {flow.actions.map((action, index) => (
                <div key={index} className="flex items-center gap-2 mb-2 p-3 bg-gray-50 rounded-lg">
                  <Select
                    value={action.type}
                    onValueChange={(value) => {
                      const newActions = [...flow.actions];
                      newActions[index] = {...action, type: value};
                      setFlow({...flow, actions: newActions});
                    }}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Action" />
                    </SelectTrigger>
                    <SelectContent>
                      {ACTIONS.map(act => (
                        <SelectItem key={act.id} value={act.id}>
                          {act.name} ({act.app})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Input
                    placeholder="Configuration (JSON)"
                    value={JSON.stringify(action.config)}
                    onChange={(e) => {
                      try {
                        const newActions = [...flow.actions];
                        newActions[index] = {...action, config: JSON.parse(e.target.value || '{}')};
                        setFlow({...flow, actions: newActions});
                      } catch (err) {
                        // Invalid JSON, ignore
                      }
                    }}
                  />
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeAction(index)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              
              {flow.actions.length === 0 && (
                <p className="text-gray-500 text-sm">No actions configured yet</p>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} className="gap-2">
              <Save className="w-4 h-4" />
              {editingFlow ? 'Update flow' : 'Create flow'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
