
import React, { useState, useEffect, useMemo } from "react";
import { ScheduleEvent, FamilyMember, User } from "@/api/entities";
import { motion } from "framer-motion";
import { useLanguage } from "@/components/common/LanguageProvider";
import { useToast } from "@/components/ui/use-toast";
import { format, parseISO } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Tag, Users, Home } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

const categoryIcons = {
  school: Tag,
  work: Tag,
  sports: Tag,
  medical: Tag,
  social: Tag,
  family: Tag,
  holiday: Calendar,
  studyday: Calendar,
  other: Tag,
};

const EventListItem = ({ event, familyMembers }) => {
  const { t } = useLanguage();
  const CategoryIcon = categoryIcons[event.category] || Tag;

  const getAssigneeInfo = (ids) => {
    if (!ids || ids.length === 0) {
      return { text: t('allFamily'), Icon: Home };
    }
    if (ids.length === 1) {
      const member = familyMembers.find(m => m.id === ids[0]);
      return { text: member?.name || 'Unknown', Icon: Users, color: member?.color };
    }
    return { text: t('membersSelected', { count: ids.length }), Icon: Users };
  };

  const assigneeInfo = getAssigneeInfo(event.family_member_ids);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-3"
    >
      <Card>
        <CardContent className="p-4 flex items-start gap-4">
          <div className="flex flex-col items-center justify-center text-center w-20">
            <span className="text-sm font-semibold text-red-600">{format(parseISO(event.start_time), 'MMM')}</span>
            <span className="text-3xl font-bold text-gray-800">{format(parseISO(event.start_time), 'd')}</span>
            <span className="text-xs text-gray-500">{format(parseISO(event.start_time), 'yyyy')}</span>
          </div>
          <div className="flex-1 border-l pl-4">
            <h3 className="font-bold text-gray-900">{event.title}</h3>
            <p className="text-sm text-gray-600">{event.description}</p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3 h-3" />
                <span>{format(parseISO(event.start_time), 'p')} - {format(parseISO(event.end_time), 'p')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CategoryIcon className="w-3 h-3" />
                <span>{t(event.category) || event.category}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <assigneeInfo.Icon className="w-3 h-3" />
                {assigneeInfo.color && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: assigneeInfo.color }} />}
                <span>{assigneeInfo.text}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default function EventsPage() {
  const [events, setEvents] = useState([]);
  const [familyMembers, setFamilyMembers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState({ category: 'all', search: '' });
  const { t } = useLanguage();
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const user = await User.me();
      if (!user.family_id) {
        setIsLoading(false);
        return;
      }
      const [eventsData, membersData] = await Promise.all([
        ScheduleEvent.filter({ family_id: user.family_id }, '-start_time', 1000),
        FamilyMember.filter({ family_id: user.family_id })
      ]);

      const now = new Date();
      const upcomingEvents = eventsData.filter((e) => {
        const end = e?.end_time ? new Date(e.end_time) : null;
        const start = e?.start_time ? new Date(e.start_time) : null;

        // prefer end_time to keep ongoing events; fall back to start_time
        const pivot = (end && !isNaN(end)) ? end : (start && !isNaN(start) ? start : null);
        return pivot && pivot >= now;
      });
      setEvents(upcomingEvents);
      setFamilyMembers(membersData);
    } catch (error) {
      console.error("Error loading events:", error);
      toast({ title: t('errorLoadingData'), variant: "destructive", duration: 5000  });
    }
    setIsLoading(false);
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const filteredEvents = useMemo(() => {
    return events
      .filter(event => {
        const categoryMatch = filters.category === 'all' || event.category === filters.category;
        const searchMatch = !filters.search || event.title.toLowerCase().includes(filters.search.toLowerCase()) || (event.description && event.description.toLowerCase().includes(filters.search.toLowerCase()));
        return categoryMatch && searchMatch;
      })
      .sort((a, b) => {
        // Sort by start_time - upcoming events first
        const dateA = new Date(a.start_time);
        const dateB = new Date(b.start_time);
        return dateA.getTime() - dateB.getTime();
      });
  }, [events, filters]);
  
  const eventCategories = ['all', 'school', 'work', 'sports', 'medical', 'social', 'family', 'holiday', 'studyday', 'other'];

  if (isLoading) return <div className="p-6 text-center">{t('loading')}...</div>;

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">{t('events')}</h1>
        <Card>
            <CardContent className="p-4 flex flex-wrap gap-4">
                <Input 
                    placeholder={t('search')}
                    value={filters.search}
                    onChange={(e) => handleFilterChange('search', e.target.value)}
                    className="max-w-xs"
                />
                <Select value={filters.category} onValueChange={(value) => handleFilterChange('category', value)}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder={t('filterByCategory')} />
                    </SelectTrigger>
                    <SelectContent>
                        {eventCategories.map(cat => (
                           <SelectItem key={cat} value={cat}>{cat === 'all' ? t('allStatuses') : t(cat) || cat}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </CardContent>
        </Card>
      </div>

      <div>
        {filteredEvents.length > 0 ? (
          filteredEvents.map(event => (
            <EventListItem key={event.id} event={event} familyMembers={familyMembers} />
          ))
        ) : (
          <div className="text-center py-16 text-gray-500">
            <h3 className="text-lg font-semibold">{t('noEventsFound')}</h3>
            <p className="mt-2 text-sm">{t('tryDifferentFilters')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
