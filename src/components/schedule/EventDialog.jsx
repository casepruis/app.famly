
import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar, Users, X, Trash2, Loader2, Clock, Repeat, AlertTriangle } from "lucide-react";
import { format, addHours } from "date-fns";
import { nl, es, fr, de, it, pt } from 'date-fns/locale';
import { Checkbox } from "@/components/ui/checkbox";
import { useLanguage } from "@/components/common/LanguageProvider";
import { InvokeLLM } from "@/api/integrations";
import { useToast } from "@/components/ui/use-toast";
import { Task } from "@/api/entities";
import { User } from "@/api/entities";
import { ScheduleEvent } from "@/api/entities";

const locales = { nl, es, fr, de, it, pt, en: undefined };

// New Time Picker component with 5-minute intervals
const TimePicker = ({ value, onChange, placeholder }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [view, setView] = useState('HOUR'); // 'HOUR' or 'MINUTE'
    const [hour, setHour] = useState('09');
    const { t } = useLanguage();

    const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
    const minutes = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55']; // 5-minute intervals

    useEffect(() => {
        if (value) {
            const [h] = value.split(':');
            setHour(h);
        } else {
            setHour('09'); // Default to 09 if no value
        }
    }, [value]);

    useEffect(() => {
        if (!isOpen) {
            setTimeout(() => setView('HOUR'), 150);
        }
    }, [isOpen]);

    const handleHourSelect = (h) => {
        setHour(h);
        setView('MINUTE');
    };

    const handleMinuteSelect = (m) => {
        const newTime = `${hour}:${m}`;
        onChange(newTime);
        setIsOpen(false);
    };

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start text-left font-normal">
                    <Clock className="mr-2 h-4 w-4" />
                    {value || placeholder}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-2">
                {view === 'HOUR' && (
                    <div>
                        <div className="text-center font-medium mb-2">{t('selectHour') || 'Select Hour'}</div>
                        <div className="grid grid-cols-6 gap-1">
                            {hours.map(h => (
                                <Button key={h} variant={h === hour ? 'default' : 'ghost'} size="sm" className="text-center" onClick={() => handleHourSelect(h)}>
                                    {h}
                                </Button>
                            ))}
                        </div>
                    </div>
                )}
                {view === 'MINUTE' && (
                    <div>
                        <div className="text-center font-medium mb-2 text-lg">{hour}:__</div>
                        <div className="grid grid-cols-4 gap-1 max-h-40 overflow-y-auto">
                            {minutes.map(m => (
                                <Button key={m} variant="outline" size="sm" className="text-sm" onClick={() => handleMinuteSelect(m)}>
                                    {m}
                                </Button>
                            ))}
                        </div>
                        <Button variant="link" size="sm" onClick={() => setView('HOUR')} className="w-full mt-2">
                            {t('backToHours') || 'Back to hours'}
                        </Button>
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
};


const analyzeEventWithAI = async (eventData, familyMembers, currentLanguage) => {
    if (!eventData.title && !eventData.description) {
        return { suggestedTasks: [], aiMessage: "" };
    }

    try {
        // Step 1: AI Brainstorms Task Titles in Plain Text
        const brainstormResult = await InvokeLLM({
            prompt: `You are a family assistant. Analyze the event below. List all potential preparation tasks as a simple, comma-separated list.
            
Event: "${eventData.title}" - "${eventData.description}"
Language for tasks: ${currentLanguage}

Examples:
- Event: "Birthday party" -> "Buy gift, Clean the house, Bake a cake"
- Event: "Visit mother-in-law" -> "Buy flowers"
- Event: "Diner met vrienden" -> "Boodschappen doen, Huis schoonmaken"

If no tasks are needed, return an empty string.`,
            response_json_schema: {
                type: "object",
                properties: {
                    task_titles: {
                        type: "string",
                        description: "A comma-separated list of task titles."
                    }
                },
                required: ["task_titles"]
            }
        });

        const taskTitlesString = brainstormResult.task_titles;
        if (!taskTitlesString) {
            // Note: This message is currently hardcoded in Dutch. It should ideally be translated based on `currentLanguage`
            // if `analyzeEventWithAI` is to return localized messages directly, or translated at the display layer.
            return { suggestedTasks: [], aiMessage: "Geen specifieke voorbereidende taken gevonden voor dit evenement." };
        }

        const taskTitles = taskTitlesString.split(',').map(t => t.trim()).filter(Boolean);
        if (taskTitles.length === 0) {
            return { suggestedTasks: [], aiMessage: "Geen specifieke voorbereidende taken gevonden voor dit evenement." };
        }

        // Step 2: Code Structures the Tasks Reliably
        const eventDate = new Date(eventData.start_time);
        const threeDaysBefore = new Date(eventDate);
        threeDaysBefore.setDate(eventDate.getDate() - 3);
        const defaultDueDate = threeDaysBefore.toISOString().split('T')[0];

        const suggestedTasks = taskTitles.map(title => ({
            title: title,
            // Note: This description is currently hardcoded in Dutch.
            description: `Voorbereidende taak voor het evenement: "${eventData.title}"`,
            due_date: defaultDueDate,
            assigned_to: []
        }));

        return {
            suggestedTasks: suggestedTasks,
            // Note: This message is currently hardcoded in Dutch.
            aiMessage: "Ik heb de volgende voorbereidende taken voorgesteld voor uw evenement. Controleer en bevestig alstublieft."
        };

    } catch (error) {
        console.error('AI analysis error:', error);
        // Note: This message is currently hardcoded in Dutch.
        return { suggestedTasks: [], aiMessage: "Er is een fout opgetreden bij het analyseren van het evenement." };
    }
};

const generateShortTitleWithAI = async (eventData, currentLanguage) => {
    if (!eventData.title) return null;
    try {
        const result = await InvokeLLM({
            prompt: `Based on the following event details, generate a very short, 2-3 word summary title suitable for a compact calendar view.
            
            Event Title: "${eventData.title}"
            Description: "${eventData.description}"
            
            Examples:
            - Title: "Verjaardagsfeestje van Anna bij ons thuis", Desc: "We vieren Anna's 10e verjaardag met taart en spelletjes." -> "Verjaardag Anna"
            - Title: "Tandartsafspraak voor Timmy", Desc: "Halfjaarlijkse controle" -> "Tandarts Timmy"
            - Title: "Boodschappen doen voor het weekend", Desc: "" -> "Boodschappen"
            
            The response should be concise and in the language: ${currentLanguage}.`,
            response_json_schema: {
                type: "object",
                properties: {
                    short_title: {
                        type: "string",
                        description: `A 2-3 word summary of the event in ${currentLanguage}.`
                    }
                },
                required: ["short_title"]
            }
        });
        return result.short_title;
    } catch (error) {
        console.error("AI short title generation error:", error);
        return null; // Return null on error, so we can fall back to the main title
    }
};

export default function EventDialog({ isOpen, onClose, onSave, onDelete, familyMembers, initialData = null, selectedDate = null, selectedHour = null, preselectedMemberId = null }) {
    const { t, currentLanguage } = useLanguage();
    const { toast } = useToast();
    const [isProcessing, setIsProcessing] = useState(false);
    const [showRecurringOptions, setShowRecurringOptions] = useState(false);
    const [eventData, setEventData] = useState({
        title: '',
        description: '',
        start_date: '',
        start_time: '',
        end_date: '',
        end_time: '',
        family_member_ids: [],
        category: 'other',
        location: '',
        priority: 'medium',
        is_recurring: false,
        recurrence_pattern: 'weekly',
    });

    const locale = useMemo(() => locales[currentLanguage] || undefined, [currentLanguage]);
    const isRecurringEvent = initialData && initialData.recurrence_id && !initialData.is_series_exception;

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                const startDate = new Date(initialData.start_time);
                const endDate = new Date(initialData.end_time);
                
                setEventData({
                    title: initialData.title || '',
                    description: initialData.description || '',
                    start_date: format(startDate, 'yyyy-MM-dd'),
                    start_time: format(startDate, 'HH:mm'),
                    end_date: format(endDate, 'yyyy-MM-dd'),
                    end_time: format(endDate, 'HH:mm'),
                    family_member_ids: initialData.family_member_ids || [],
                    category: initialData.category || 'other',
                    location: initialData.location || '',
                    priority: initialData.priority || 'medium',
                    is_recurring: initialData.is_recurring || false,
                    recurrence_pattern: initialData.recurrence_pattern || 'weekly',
                });
                setShowRecurringOptions(false);
            } else {
                const now = new Date();
                let startDate = selectedDate ? new Date(selectedDate) : new Date();

                if (selectedHour !== null) {
                    startDate.setHours(selectedHour, 0, 0, 0);
                } else {
                    const currentHour = now.getHours();
                    const nextHour = currentHour + 1;
                    startDate.setHours(nextHour, 0, 0, 0);
                }

                const endDate = addHours(startDate, 1);
                
                const initialMemberIds = preselectedMemberId ? [preselectedMemberId] : [];

                setEventData({
                    title: '',
                    description: '',
                    start_date: format(startDate, 'yyyy-MM-dd'),
                    start_time: format(startDate, 'HH:mm'),
                    end_date: format(endDate, 'yyyy-MM-dd'),
                    end_time: format(endDate, 'HH:mm'),
                    family_member_ids: initialMemberIds,
                    category: 'other',
                    location: '',
                    priority: 'medium',
                    is_recurring: false,
                    recurrence_pattern: 'weekly',
                });
                setShowRecurringOptions(false);
            }
        }
    }, [isOpen, initialData, selectedDate, selectedHour, preselectedMemberId]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (isRecurringEvent && !showRecurringOptions) {
            setShowRecurringOptions(true);
            return;
        }

        setIsProcessing(true);

        try {
            // Combine date and time into proper datetime strings
            const startDateTime = new Date(`${eventData.start_date}T${eventData.start_time}`);
            const endDateTime = new Date(`${eventData.end_date}T${eventData.end_time}`);
            
            let processedEventData = {
                ...eventData,
                start_time: startDateTime.toISOString(),
                end_time: endDateTime.toISOString(),
            };

            // Generate short title with AI, but don't block saving if it fails
            const shortTitle = await generateShortTitleWithAI(processedEventData, currentLanguage);
            if (shortTitle) {
                processedEventData.short_title = shortTitle;
            }

            const aiResult = await analyzeEventWithAI(processedEventData, familyMembers, currentLanguage);
            
            // Determine edit type based on whether this is an update or create
            const editType = initialData ? (showRecurringOptions ? 'series' : 'single') : 'single';
            
            // Always call onSave, which will handle whether to show the review dialog or not
            onSave(processedEventData, aiResult, editType);

        } catch(error) {
            console.error("Error processing event:", error);
            toast({ title: t('processingFailed') || 'Processing failed', description: t('unexpectedErrorOccurred') || 'An unexpected error occurred. Please try again.', variant: "destructive", duration: 5000  });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDelete = () => {
        if (initialData && onDelete) {
            // The parent `onDelete` function will now handle all confirmations.
            onDelete(initialData);
        }
    };

    const handleInputChange = (field, value) => {
        setEventData(prev => {
            const newData = { ...prev, [field]: value };
            
            // Auto-update end time when start time changes
            if (field === 'start_time' && value) {
                const [hours, minutes] = value.split(':');
                const startHour = parseInt(hours, 10);
                const endHour = (startHour + 1) % 24; // Handles wrap-around 23->00
                const endTime = `${endHour.toString().padStart(2, '0')}:${minutes}`;
                newData.end_time = endTime;
            }
            
            // Auto-update end date when start date changes (if end date is not set or before start date)
            if (field === 'start_date' && value) {
                const newStartDate = new Date(value);
                const prevEndDate = prev.end_date ? new Date(prev.end_date) : null;

                if (!prevEndDate || newStartDate > prevEndDate) {
                    newData.end_date = value;
                }
            }
            
            return newData;
        });
    };

    const handleMemberToggle = (memberId) => {
        setEventData(prev => ({
            ...prev,
            family_member_ids: (prev.family_member_ids || []).includes(memberId)
                ? (prev.family_member_ids || []).filter(id => id !== memberId)
                : [...(prev.family_member_ids || []), memberId]
        }));
    };

    const removeMember = (memberId) => {
        setEventData(prev => ({
            ...prev,
            family_member_ids: (prev.family_member_ids || []).filter(id => id !== memberId)
        }));
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
                <DialogHeader className="flex-shrink-0">
                    <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
                        <Calendar className="w-5 h-5" />
                        {initialData ? (t('editEvent') || 'Edit event') : (t('addNewEvent') || 'Add new event')}
                        {isRecurringEvent && (
                            <div className="flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
                                <Repeat className="w-3 h-3" />
                                {t('recurring') || 'Recurring'}
                            </div>
                        )}
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto pr-2">
                    {showRecurringOptions && isRecurringEvent && (
                        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                                <AlertTriangle className="w-4 h-4 text-amber-600" />
                                <span className="font-medium text-amber-800">{t('editRecurringEvent') || 'Edit Recurring Event'}</span>
                            </div>
                            <p className="text-sm text-amber-700 mb-3">
                                {t('editRecurringDescription') || 'You are editing a recurring event. What would you like to do?'}
                            </p>
                            <div className="flex gap-2">
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={() => {
                                        onSave({...eventData, start_time: new Date(`${eventData.start_date}T${eventData.start_time}`).toISOString(), end_time: new Date(`${eventData.end_date}T${eventData.end_time}`).toISOString()}, null, 'single');
                                        setShowRecurringOptions(false);
                                    }}
                                >
                                    {t('editThisEvent') || 'Edit this event only'}
                                </Button>
                                <Button 
                                    size="sm" 
                                    onClick={() => {
                                        onSave({...eventData, start_time: new Date(`${eventData.start_date}T${eventData.start_time}`).toISOString(), end_time: new Date(`${eventData.end_date}T${eventData.end_time}`).toISOString()}, null, 'series');
                                        setShowRecurringOptions(false);
                                    }}
                                >
                                    {t('editAllEvents') || 'Edit all events in series'}
                                </Button>
                            </div>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4 p-1">
                        <div>
                            <Label htmlFor="title">{t('eventTitle') || 'Event title'}</Label>
                            <Input
                                id="title"
                                value={eventData.title}
                                onChange={(e) => handleInputChange('title', e.target.value)}
                                placeholder={t('enterEventTitle') || 'Enter event title'}
                                required
                            />
                        </div>

                        <div>
                            <Label htmlFor="description">{t('description') || 'Description'}</Label>
                            <Textarea
                                id="description"
                                value={eventData.description}
                                onChange={(e) => handleInputChange('description', e.target.value)}
                                placeholder={t('addEventDetails') || 'Add event details...'}
                                rows={3}
                            />
                        </div>

                        <div className="space-y-4">
                            <div>
                                <Label>{t('startDateTime') || 'Start date & time'}</Label>
                                <div className="grid grid-cols-2 gap-2">
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" className="justify-start text-left font-normal">
                                                <Calendar className="mr-2 h-4 w-4" />
                                                {eventData.start_date ? format(new Date(eventData.start_date), 'PPP', { locale }) : t('selectDate') || 'Select date'}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0">
                                            <CalendarPicker
                                                mode="single"
                                                selected={eventData.start_date ? new Date(eventData.start_date) : undefined}
                                                onSelect={(date) => handleInputChange('start_date', date ? format(date, 'yyyy-MM-dd') : '')}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                    <TimePicker
                                        value={eventData.start_time}
                                        onChange={(value) => handleInputChange('start_time', value)}
                                        placeholder={t('selectTime') || 'Select time'}
                                    />
                                </div>
                            </div>
                            
                            <div>
                                <Label>{t('endDateTime') || 'End date & time'}</Label>
                                <div className="grid grid-cols-2 gap-2">
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" className="justify-start text-left font-normal">
                                                <Calendar className="mr-2 h-4 w-4" />
                                                {eventData.end_date ? format(new Date(eventData.end_date), 'PPP', { locale }) : t('selectDate') || 'Select date'}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0">
                                            <CalendarPicker
                                                mode="single"
                                                selected={eventData.end_date ? new Date(eventData.end_date) : undefined}
                                                onSelect={(date) => handleInputChange('end_date', date ? format(date, 'yyyy-MM-dd') : '')}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                    <TimePicker
                                        value={eventData.end_time}
                                        onChange={(value) => handleInputChange('end_time', value)}
                                        placeholder={t('selectTime') || 'Select time'}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Recurring Event Section */}
                        <div className="space-y-3">
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="is_recurring"
                                    checked={eventData.is_recurring}
                                    onCheckedChange={(checked) => handleInputChange('is_recurring', checked)}
                                />
                                <Label htmlFor="is_recurring" className="flex items-center gap-2">
                                    <Repeat className="w-4 h-4" />
                                    {t('recurringEvent') || 'Recurring event'}
                                </Label>
                            </div>

                            {eventData.is_recurring && (
                                <Select
                                    value={eventData.recurrence_pattern}
                                    onValueChange={(value) => handleInputChange('recurrence_pattern', value)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder={t('selectRecurrence') || 'Select recurrence'} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="daily">{t('daily') || 'Daily'}</SelectItem>
                                        <SelectItem value="weekly">{t('weekly') || 'Weekly'}</SelectItem>
                                        <SelectItem value="monthly">{t('monthly') || 'Monthly'}</SelectItem>
                                        <SelectItem value="yearly">{t('yearly') || 'Yearly'}</SelectItem>
                                    </SelectContent>
                                </Select>
                            )}
                        </div>

                        <div>
                            <Label>{t('assignToMembers') || 'Assign to members'}</Label>
                            {(eventData.family_member_ids || []).length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {(eventData.family_member_ids || []).map(member => {
                                        const foundMember = familyMembers?.find(m => m.id === member);
                                        return foundMember ? (
                                            <div key={foundMember.id} className="flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm">
                                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: foundMember.color }}/>
                                                {foundMember.name}
                                                <button type="button" onClick={() => removeMember(foundMember.id)} className="ml-1 hover:bg-blue-200 rounded-full p-0.5"><X className="w-3 h-3" /></button>
                                            </div>
                                        ) : null;
                                    })}
                                </div>
                            )}
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                                        <Users className="mr-2 h-4 w-4" />
                                        {(eventData.family_member_ids || []).length === 0 ? (t('assignToDefault') || 'Assign to (default: all)') : t('membersSelected', { count: (eventData.family_member_ids || []).length }) || `${(eventData.family_member_ids || []).length} member(s) selected`}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-64 p-3">
                                    <div className="space-y-3">
                                        <div className="font-medium">{t('selectMembers') || 'Select members'}:</div>
                                        {familyMembers?.map(member => (
                                            <div key={member.id} className="flex items-center space-x-2">
                                                <Checkbox id={`member-${member.id}`} checked={(eventData.family_member_ids || []).includes(member.id)} onCheckedChange={() => handleMemberToggle(member.id)} />
                                                <label htmlFor={`member-${member.id}`} className="flex items-center gap-2 font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                                                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: member.color }}/>
                                                    {member.name}
                                                </label>
                                            </div>
                                        ))}
                                        <div className="text-xs text-gray-500 mt-2">{t('assignToAllHint') || 'Leave empty to assign to all family members.'}</div>
                                    </div>
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="category">{t('category') || 'Category'}</Label>
                                <Select value={eventData.category} onValueChange={(value) => handleInputChange('category', value)}>
                                    <SelectTrigger><SelectValue placeholder={t('selectCategory') || 'Select category'} /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="school">{t('school') || 'School'}</SelectItem>
                                        <SelectItem value="work">{t('work') || 'Work'}</SelectItem>
                                        <SelectItem value="sports">{t('sports') || 'Sports'}</SelectItem>
                                        <SelectItem value="medical">{t('medical') || 'Medical'}</SelectItem>
                                        <SelectItem value="social">{t('social') || 'Social'}</SelectItem>
                                        <SelectItem value="family">{t('family') || 'Family'}</SelectItem>
                                        <SelectItem value="other">{t('other') || 'Other'}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label htmlFor="priority">{t('priority') || 'Priority'}</Label>
                                <Select value={eventData.priority} onValueChange={(value) => handleInputChange('priority', value)}>
                                    <SelectTrigger><SelectValue placeholder={t('selectPriority') || 'Select priority'} /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="low">{t('low') || 'Low'}</SelectItem>
                                        <SelectItem value="medium">{t('medium') || 'Medium'}</SelectItem>
                                        <SelectItem value="high">{t('high') || 'High'}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div>
                            <Label htmlFor="location">{t('location') || 'Location'}</Label>
                            <Input id="location" value={eventData.location} onChange={(e) => handleInputChange('location', e.target.value)} placeholder={t('enterLocation') || 'Enter location'} />
                        </div>

                        <div className="flex justify-between gap-3 pt-4 border-t pb-4">
                            <div>
                                {initialData && onDelete && (
                                    <Button type="button" variant="destructive" onClick={handleDelete} className="gap-1">
                                        <Trash2 className="w-4 h-4" /> {t('deleteEvent') || 'Delete event'}
                                    </Button>
                                )}
                            </div>
                            <div className="flex gap-3">
                                <Button type="button" variant="outline" onClick={() => {onClose(); setShowRecurringOptions(false);}}>
                                    {t('cancel') || 'Cancel'}
                                </Button>
                                <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={isProcessing}>
                                    {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                    {showRecurringOptions ? (t('selectOption') || 'Select Option') : (initialData ? (t('update') || 'Update') : (t('create') || 'Create'))}
                                </Button>
                            </div>
                        </div>
                    </form>
                </div>
            </DialogContent>
        </Dialog>
    );
}
