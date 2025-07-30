
import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Loader2 } from "lucide-react";
import { useLanguage } from "@/components/common/LanguageProvider";
import { InvokeLLM } from "@/api/integrations";
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

    const generateInsight = async () => {
      setIsLoading(true);
      try {
        // Add delay to prevent rapid requests, increasing with retry count
        await new Promise(resolve => setTimeout(resolve, 2000 + (retryCount * 3000))); // Increased base delay
        
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
            properties: {
              insight: { type: "string" }
            },
            required: ["insight"]
          }
        });
        setInsight(result.insight);
        setRetryCount(0); // Reset retry count on success
      } catch (error) {
        console.error("Error generating insight:", error);
        
        // If it's a rate limit error, wait longer before retrying
        if (error.response?.status === 429 && retryCount < 2) {
          setRetryCount(prev => prev + 1);
          setTimeout(() => generateInsight(), 10000 + (retryCount * 5000)); // Much longer backoff
          return;
        }
        
        // Use fallback insight if retries exhausted or other error
        setInsight(getFallbackInsight());
      } finally {
        setIsLoading(false); // Ensure loading state is turned off only after final attempt
      }
    };
    
    generateInsight();

  }, [familyContext, currentLanguage, t, user, familyMembers, retryCount]); // Added retryCount to dependencies

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
