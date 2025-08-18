
import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Loader2 } from "lucide-react";
import { useLanguage } from "@/components/common/LanguageProvider";
import { InvokeLLM, getLLMEstimatedCost } from "@/api/integrations";

import { User } from '@/api/entities';

export default function AIInsights({ tasks, events, familyMembers }) {
  const [insight, setInsight] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [retryCount, setRetryCount] = useState(0); // Added retryCount state

  const { t, currentLanguage } = useLanguage();

  useEffect(() => {
    const fetchUser = async () => {
        try {
            const currentUser = await User.me();
            setUser(currentUser);
        } catch (e) {
            setUser(null);
        }
    }
    fetchUser();
  }, []);

  const familyContext = useMemo(() => {
    const memberNames = familyMembers.map(m => m.name).join(', ');
    const upcomingEvents = events.slice(0, 5).map(e => e.title).join('; ');
    const openTasks = tasks.filter(t => t.status !== 'completed').slice(0, 5).map(t => t.title).join('; ');
    
    // More detailed context for AI
    const tasksByStatus = {
      overdue: tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed').length,
      dueToday: tasks.filter(t => t.due_date && new Date(t.due_date).toDateString() === new Date().toDateString() && t.status !== 'completed').length,
      completed: tasks.filter(t => t.status === 'completed').length
    };
    
    const eventsByCategory = events.reduce((acc, event) => {
      acc[event.category] = (acc[event.category] || 0) + 1;
      return acc;
    }, {});

    return `Family Members: ${memberNames}. 
    Tasks: ${tasksByStatus.overdue} overdue, ${tasksByStatus.dueToday} due today, ${tasksByStatus.completed} completed recently. 
    Upcoming Events: ${upcomingEvents}. 
    Event Types: ${Object.entries(eventsByCategory).map(([cat, count]) => `${count} ${cat}`).join(', ')}.
    Open Tasks: ${openTasks}.`;
  }, [tasks, events, familyMembers]);

  // Added getFallbackInsight function
  const getFallbackInsight = () => {
    const overdueTasks = tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed').length;
    const todayTasks = tasks.filter(t => t.due_date && new Date(t.due_date).toDateString() === new Date().toDateString() && t.status !== 'completed').length;
    const upcomingEventsCount = events.filter(e => new Date(e.start_time) > new Date()).length;

    if (currentLanguage === 'nl') {
      if (overdueTasks > 3) {
        return `Je hebt ${overdueTasks} achterstallige taken. Misschien tijd om prioriteiten te stellen?`;
      }
      if (todayTasks > 0) {
        return `${todayTasks} taken staan voor vandaag gepland. Je kunt dit!`;
      }
      if (upcomingEventsCount > 5) {
        return `Drukke week vooruit met ${upcomingEventsCount} evenementen. Plan wat ontspanning in.`;
      }
      return 'Jullie agenda ziet er goed georganiseerd uit. Blijf zo doorgaan!';
    } else {
      if (overdueTasks > 3) {
        return `You have ${overdueTasks} overdue tasks. Time to prioritize?`;
      }
      if (todayTasks > 0) {
        return `${todayTasks} tasks scheduled for today. You've got this!`;
      }
      if (upcomingEventsCount > 5) {
        return `Busy week ahead with ${upcomingEventsCount} events. Schedule some relaxation.`;
      }
      return 'Your schedule looks well organized. Keep up the good work!';
    }
  };

useEffect(() => {
  if (!user || familyMembers.length === 0) return;

  let canceled = false;

  const pickFirstString = (obj) => {
    if (!obj || typeof obj !== "object") return null;
    for (const v of Object.values(obj)) {
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    return null;
  };

  const run = async () => {
    setIsLoading(true);
    const delays = [0, 2000, 5000, 10000]; // try immediately, then 2s → 5s → 10s

    try {
      for (let i = 0; i < delays.length; i++) {
        try {
          if (delays[i] > 0) await new Promise((res) => setTimeout(res, delays[i]));

          const result = await InvokeLLM({
            prompt: `You are a helpful family assistant AI. Based on this family's data, provide ONE concise, actionable insight or suggestion (under 25 words) that would genuinely help them. 

Context: ${familyContext}

Be specific and avoid generic advice like "make a schedule" since they already use a scheduling system. Focus on:
- Task management optimization
- Schedule conflicts or gaps
- Family coordination opportunities
- Productivity improvements
- Work-life balance suggestions

IMPORTANT: Respond ONLY in ${currentLanguage}. Use proper grammar and natural phrasing for ${currentLanguage}. Be encouraging and positive.`,
            response_json_schema: {
              type: "object",
              properties: { insight: { type: "string" } },
              required: ["insight"],
            },
            // strict: false, // default soft validation
            // temperature: 0.2,
            // deployment: "your-deployment-name",
            // system: "Respond only in JSON.",
          });

          if (canceled) return;

          // tolerate variant keys & shapes
          const data = result && result.data;
          const value =
            (data && (data.insight || data.tip || data.suggestion)) ||
            (typeof result?.summary === "string" ? result.summary : null) ||
            pickFirstString(data);

          setInsight(value || getFallbackInsight());

          // optional: inspect cost or validation drift
          // console.debug("usage≈", result?.meta?.usage?.estimated_cost, result?.meta?.usage?.currency);
          // console.debug("schema drift:", result?.meta?.validation_error);

          return; // success — stop retrying
        } catch (err) {
          if (canceled) return;
          const isLast = i === delays.length - 1;
          const msg = (err && err.message ? err.message : "").toLowerCase();
          const maybeRateLimited = msg.includes("429") || msg.includes("rate");
          console.warn(`Insight attempt ${i + 1} failed${maybeRateLimited ? " (rate limit?)" : ""}:`, err);
          if (isLast) setInsight(getFallbackInsight());
          // else continue to next delay
        }
      }
    } finally {
      if (!canceled) setIsLoading(false); // ✅ always clear spinner
    }
  };

  run();
  return () => { canceled = true; };
  // keep deps minimal; re-run only when inputs truly change
}, [familyContext, currentLanguage, user && user.id, familyMembers.length]);

// Added retryCount to dependencies

  return (
    <Card className="h-full border-famly-accent bg-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-famly-text-primary">
          <Sparkles className="w-5 h-5 text-purple-500" />
          {t('aiInsights') || 'AI Insights'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="min-h-[50px] flex items-start">
          <div className="text-sm text-famly-text-secondary leading-relaxed">
            {isLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                {retryCount > 0 && <span className="text-xs">{t('retrying') || 'Retrying...'}</span>}
              </div>
            ) : (
              <p>{insight}</p> // Optional, if insight is plain text
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
