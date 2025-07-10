import React from 'react';
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function VacationEventsReview({ events, onEventsUpdate }) {
  const handleEventUpdate = (index, field, value) => {
    const updatedEvents = [...events];
    updatedEvents[index] = { ...updatedEvents[index], [field]: value };
    onEventsUpdate(updatedEvents);
  };

  const handleEventToggle = (index, selected) => {
    const updatedEvents = [...events];
    updatedEvents[index] = { ...updatedEvents[index], selected };
    onEventsUpdate(updatedEvents);
  };

  const handleRemoveEvent = (index) => {
    const updatedEvents = events.filter((_, i) => i !== index);
    onEventsUpdate(updatedEvents);
  };

  const formatDateForInput = (isoString) => {
    return isoString ? isoString.substring(0, 16) : '';
  };

  const handleDateChange = (index, field, value) => {
    const isoString = value ? new Date(value).toISOString() : '';
    handleEventUpdate(index, field, isoString);
  };

  const selectedCount = events.filter(e => e.selected).length;

  return (
    <div className="space-y-3 max-h-80 overflow-y-auto">
      <div className="text-xs font-semibold text-green-700 mb-2">
        Gevonden gebeurtenissen ({selectedCount}/{events.length} geselecteerd):
      </div>
      
      {events.map((event, index) => (
        <div key={index} className="flex items-center gap-2 p-3 bg-white border border-green-200 rounded-lg text-xs">
          <Checkbox
            checked={event.selected || false}
            onCheckedChange={(checked) => handleEventToggle(index, checked)}
            className="h-4 w-4"
          />
          
          <Input
            value={event.title}
            onChange={(e) => handleEventUpdate(index, 'title', e.target.value)}
            className="flex-1 h-7 text-xs border-gray-300"
            placeholder="Gebeurtenis naam"
          />
          
          <Select
            value={event.category}
            onValueChange={(value) => handleEventUpdate(index, 'category', value)}
          >
            <SelectTrigger className="w-20 h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="family">Familie</SelectItem>
              <SelectItem value="school">School</SelectItem>
              <SelectItem value="work">Werk</SelectItem>
              <SelectItem value="other">Overig</SelectItem>
            </SelectContent>
          </Select>
          
          <div className="flex items-center gap-1">
            <Input
              type="datetime-local"
              value={formatDateForInput(event.start_time)}
              onChange={(e) => handleDateChange(index, 'start_time', e.target.value)}
              className="w-36 h-7 text-xs border-gray-300"
            />
            <span className="text-gray-400">-</span>
            <Input
              type="datetime-local"
              value={formatDateForInput(event.end_time)}
              onChange={(e) => handleDateChange(index, 'end_time', e.target.value)}
              className="w-36 h-7 text-xs border-gray-300"
            />
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleRemoveEvent(index)}
            className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ))}
    </div>
  );
}