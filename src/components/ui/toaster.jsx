import React, { useState, useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";

export function Toaster() {
  const { toasts, dismiss } = useToast();
  const [dismissed, setDismissed] = useState(new Set());

  const handleOpenChange = (open, id) => {
    if (!open) {
      dismiss(id); // Trigger global dismissal
      setDismissed(prev => new Set(prev).add(id)); // Track locally to prevent re-render
    }
  };

  const visibleToasts = toasts.filter(t => !dismissed.has(t.id));

  return (
    <ToastProvider>
      {visibleToasts.map(({ id, title, description, action, ...props }) => (
        <Toast
          key={id}
          open={props.open}
          onOpenChange={(open) => handleOpenChange(open, id)}
          {...props}
        >
          <div className="grid gap-1">
            {title && <ToastTitle>{title}</ToastTitle>}
            {description && <ToastDescription>{description}</ToastDescription>}
          </div>
          {action}
          <ToastClose onClick={() => handleOpenChange(false, id)} />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  );
}
