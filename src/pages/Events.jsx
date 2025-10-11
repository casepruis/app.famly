
import React, { useState, useEffect, useMemo } from "react";
import { useFamilyData } from "@/hooks/FamilyDataContext";
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

import { Edit, Trash2 } from "lucide-react";
import EventDialog from "@/components/schedule/EventDialog";

const EventListItem = ({ event, familyMembers, onEdit, onDelete }) => {
  const { t } = useLanguage();
  const CategoryIcon = categoryIcons[event.category] || Tag;
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [exitX, setExitX] = useState(0);

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

  const handleDragEnd = (eventObj, info) => {
    setIsDragging(false);
    const threshold = 80;
    if (info.offset.x < -threshold && onEdit) {
      setExitX(-500);
      onEdit(event);
    } else if (info.offset.x > threshold && onDelete) {
      setExitX(500);
      onDelete(event);
    }
    setDragX(0);
  };

  const handleDrag = (eventObj, info) => {
    setDragX(info.offset.x);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ x: exitX, opacity: 0, transition: { duration: 0.3 } }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      onDragStart={() => setIsDragging(true)}
      onDrag={handleDrag}
      onDragEnd={handleDragEnd}
      className="relative mb-3"
    >
      {/* Action indicators */}
      <motion.div
        className="absolute inset-y-0 left-full w-20 bg-blue-500 flex items-center justify-start pl-5 rounded-l-lg"
        style={{ right: '-5rem' }}
        animate={{ opacity: isDragging && dragX < -40 ? 1 : 0 }}
      >
        <Edit className="w-5 h-5 text-white" />
      </motion.div>
      <motion.div
        className="absolute inset-y-0 right-full w-20 bg-red-500 flex items-center justify-end pr-5 rounded-r-lg"
        style={{ left: '-5rem' }}
        animate={{ opacity: isDragging && dragX > 40 ? 1 : 0 }}
      >
        <Trash2 className="w-5 h-5 text-white" />
      </motion.div>

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


function Events() {
  const { user, family, members: familyMembers, events, isLoading, error, reload } = useFamilyData();
  const [filters, setFilters] = useState({ category: 'all', search: '' });
  const { t } = useLanguage();
  const { toast } = useToast();
  const [editEvent, setEditEvent] = useState(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(null);
  useEffect(() => {
    const handler = (e) => {
      if (e?.detail?.action === 'new') {
        setEditEvent(null);
        setSelectedTimeSlot({ date: new Date(), hour: 9 });
      }
    };
    window.addEventListener('actionTriggered', handler);
    return () => window.removeEventListener('actionTriggered', handler);
  }, []);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleEditEvent = (event) => {
    setEditEvent(event);
    setSelectedTimeSlot(null);
  };

  const handleDialogClose = () => {
    setEditEvent(null);
    setSelectedTimeSlot(null);
  };

  const handleProcessSave = async (eventData, _ignored, editType = "single") => {
    try {
      if (editEvent && editEvent.id) {
        await ScheduleEvent.update(editEvent.id, eventData);
        toast({ title: t('eventUpdated'), description: eventData.title, variant: 'success', duration: 5000 });
      } else {
        await ScheduleEvent.create(eventData);
        toast({ title: t('eventCreated'), description: eventData.title, variant: 'success', duration: 5000 });
      }
      if (reload) await reload();
      handleDialogClose();
    } catch (error) {
      toast({ title: t('errorSavingEvent'), description: eventData.title, variant: 'destructive', duration: 5000 });
    }
  };

  const handleDialogDelete = async (event) => {
    if (!window.confirm(t('confirmDeleteEvent') || 'Delete this event?')) return;
    try {
      await ScheduleEvent.delete(event.id);
      toast({ title: t('eventDeleted'), description: event.title, variant: 'success', duration: 5000 });
      if (reload) await reload();
      handleDialogClose();
    } catch (error) {
      toast({ title: t('errorDeletingEvent'), description: event.title, variant: 'destructive', duration: 5000 });
    }
  };

  const filteredEvents = useMemo(() => {
    const now = new Date();
    return events
      .filter(event => {
        // Only show events that end in the future (or have no end_time and start in the future)
        const end = event.end_time ? new Date(event.end_time) : new Date(event.start_time);
        if (end < now) return false;
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
      <EventDialog
        isOpen={!!editEvent || !!selectedTimeSlot}
        onClose={handleDialogClose}
        onSave={handleProcessSave}
        onDelete={handleDialogDelete}
        familyMembers={familyMembers}
        initialData={editEvent}
        selectedDate={selectedTimeSlot?.date}
        selectedHour={selectedTimeSlot?.hour}
      />
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
            <EventListItem key={event.id} event={event} familyMembers={familyMembers} onEdit={handleEditEvent} onDelete={handleDialogDelete} />
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

export default Events;
