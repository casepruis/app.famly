
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

    // Delay LLM call by 2s to let UI render instantly
    const timeout = setTimeout(() => {
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
              });
              if (canceled) return;
              const data = result && result.data;
              const value =
                (data && (data.insight || data.tip || data.suggestion)) ||
                (typeof result?.summary === "string" ? result.summary : null) ||
                pickFirstString(data);
              setInsight(value || getFallbackInsight());
              return;
            } catch (err) {
              // If error, try next delay
              if (i === delays.length - 1) {
                setInsight(getFallbackInsight());
              }
            }
          }
        } catch (err) {
          setInsight(getFallbackInsight());
        } finally {
          setIsLoading(false);
        }
      };

      run();
    }, 2000);

    return () => {
      canceled = true;
      clearTimeout(timeout);
    };
  }, [user, familyMembers, familyContext, currentLanguage, retryCount]); // include dependencies

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
              <span className="flex items-center gap-2 text-gray-400"><Loader2 className="w-4 h-4 animate-spin" /> {t('loading') || 'Loading...'}</span>
            ) : (
              insight
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
