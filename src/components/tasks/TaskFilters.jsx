import React from 'react';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter, X } from "lucide-react";
import { useLanguage } from "@/components/common/LanguageProvider";

export default function TaskFilters({ 
  filters, 
  onFilterChange, 
  familyMembers
}) {
  const { t } = useLanguage();
  const clearFilters = () => {
    onFilterChange({
      status: 'all',
      assignee: 'all'
    });
  };

  const hasActiveFilters = filters.status !== 'all' || filters.assignee !== 'all';

  return (
    <div className="flex flex-wrap items-center gap-2">
        <Select value={filters.status} onValueChange={(value) => onFilterChange({...filters, status: value})}>
          <SelectTrigger className="w-32 h-8 text-xs border-gray-300 bg-white">
            <SelectValue placeholder={t('status')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todo">{t('todo')}</SelectItem>
            <SelectItem value="in_progress">{t('in_progress')}</SelectItem>
            <SelectItem value="completed">{t('completed')}</SelectItem>
            <SelectItem value="all">{t('allStatuses') || 'All Statuses'}</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.assignee} onValueChange={(value) => onFilterChange({...filters, assignee: value})}>
          <SelectTrigger className="w-32 h-8 text-xs border-gray-300 bg-white">
            <SelectValue placeholder={t('assignee')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allMembers') || 'All Members'}</SelectItem>
            {familyMembers?.map(member => (
              <SelectItem key={member.id} value={member.id}>
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: member.color }}
                  />
                  {member.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="gap-1 text-gray-500 hover:text-gray-700 h-8 px-2"
          >
            <X className="w-3 h-3" />
          </Button>
        )}
    </div>
  );
}