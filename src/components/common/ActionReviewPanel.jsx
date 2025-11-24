import React, { useState } from "react";

import { Button } from "@/components/ui/button";

import InlineTaskReview from "../chat/InlineTaskReview";
import InlineEventReview from "../schedule/InlineEventReview";
import InlineWishlistReview from "../familymembers/InlineWishlistReview";

// Unified review panel for tasks, events, wishlist
export default function ActionReviewPanel({
  tasks = [],
  events = [],
  wishlist = [],
  familyMembers = [],
  onCancel,
  onConfirm,
  confirmLabel = "Add selected",
  cancelLabel = "Cancel",
}) {
  // Local selection state

  // Tasks: use InlineTaskReview for inline editing/assignment
  const [editableTasks, setEditableTasks] = useState(
    tasks.map(task => ({ ...task, selected: task.selected !== false }))
  );
  const handleTaskUpdate = (index, updatedTask) => {
    setEditableTasks(currentTasks =>
      currentTasks.map((task, i) => i === index ? updatedTask : task)
    );
  };

  // Events: prepare for inline editing/assignment (future)
  const [editableEvents, setEditableEvents] = useState(
    events.map(event => ({ ...event, selected: event.selected !== false }))
  );
  const handleEventUpdate = (index, updatedEvent) => {
    setEditableEvents(currentEvents =>
      currentEvents.map((event, i) => i === index ? updatedEvent : event)
    );
  };

  // Wishlist: prepare for inline editing/assignment (future)
  const [editableWishlist, setEditableWishlist] = useState(
    wishlist.map(item => ({ ...item, selected: item.selected !== false }))
  );
  const handleWishlistUpdate = (index, updatedItem) => {
    setEditableWishlist(currentItems =>
      currentItems.map((item, i) => i === index ? updatedItem : item)
    );
  };

  return (
    <div className="rounded-xl border-2 border-blue-200 bg-blue-50/60 shadow-lg p-3 sm:p-4 space-y-4 sm:space-y-5 max-w-2xl w-full">
      <h3 className="font-bold text-sm sm:text-base text-blue-900 mb-2">AI Suggestions: select what you want to add</h3>
      {editableTasks.length > 0 && (
        <div className="border border-blue-200 rounded-lg p-3 mb-2">
          <h4 className="font-semibold text-sm sm:text-base text-green-800 mb-3">Tasks</h4>
          {editableTasks.map((task, i) => (
            <InlineTaskReview
              key={i}
              task={task}
              taskIndex={i}
              familyMembers={familyMembers}
              onTaskUpdate={handleTaskUpdate}
            />
          ))}
        </div>
      )}
      {editableEvents.length > 0 && (
        <div className="border border-emerald-200 rounded-lg p-3 mb-2">
          <h4 className="font-semibold text-sm sm:text-base text-emerald-800 mb-3">Events</h4>
          {editableEvents.map((event, i) => (
            <InlineEventReview
              key={i}
              event={event}
              eventIndex={i}
              familyMembers={familyMembers}
              onEventUpdate={handleEventUpdate}
            />
          ))}
        </div>
      )}
      {editableWishlist.length > 0 && (
        <div className="border border-purple-200 rounded-lg p-3 mb-2">
          <h4 className="font-semibold text-sm sm:text-base text-purple-800 mb-3">Wishlist Items</h4>
          {editableWishlist.map((item, i) => (
            <InlineWishlistReview
              key={i}
              item={item}
              itemIndex={i}
              familyMembers={familyMembers}
              onWishlistUpdate={handleWishlistUpdate}
            />
          ))}
        </div>
      )}
      <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-2 pt-4 border-t border-blue-100 mt-4">
        <Button variant="ghost" size="sm" onClick={onCancel} className="w-full sm:w-auto">{cancelLabel}</Button>
        <Button
          size="sm"
          className="bg-blue-600 hover:bg-blue-700 font-semibold px-6 w-full sm:w-auto"
          onClick={() => {
            onConfirm({
              tasks: editableTasks.filter(t => t.selected).map(({ selected, ...rest }) => rest),
              events: editableEvents.filter(e => e.selected).map(({ selected, ...rest }) => rest),
              items: editableWishlist.filter(w => w.selected).map(({ selected, ...rest }) => rest),
            });
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </div>
  );
}
