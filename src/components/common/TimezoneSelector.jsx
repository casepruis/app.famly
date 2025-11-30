import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock } from "lucide-react";
import { getClientTimezone, getUserTimezone } from '@/utils/timezone';
import { User } from '@/api/entities';

// Common timezones for the dropdown
const COMMON_TIMEZONES = [
  { value: 'Europe/Amsterdam', label: 'Amsterdam (CET/CEST)', offset: '+01:00' },
  { value: 'Europe/London', label: 'London (GMT/BST)', offset: '+00:00' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)', offset: '+01:00' },
  { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)', offset: '+01:00' },
  { value: 'America/New_York', label: 'New York (EST/EDT)', offset: '-05:00' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (PST/PDT)', offset: '-08:00' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)', offset: '+09:00' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)', offset: '+10:00' },
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)', offset: '+00:00' }
];

export default function TimezoneSelector() {
  const [currentTimezone, setCurrentTimezone] = useState('UTC');
  const [browserTimezone, setBrowserTimezone] = useState('UTC');
  const [databaseTimezone, setDatabaseTimezone] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Add timeout to prevent hanging
    const timeoutId = setTimeout(() => {
      console.warn('⏰ Timezone loading timed out, using fallback');
      setCurrentTimezone('Europe/Amsterdam');
      setBrowserTimezone('Europe/Amsterdam');
      setDatabaseTimezone('Europe/Amsterdam');
      setLoading(false);
    }, 5000);

    loadTimezoneSettings().finally(() => {
      clearTimeout(timeoutId);
    });

    return () => clearTimeout(timeoutId);
  }, []);

  const loadTimezoneSettings = async () => {
    setLoading(true);
    
    try {
      // Get browser detected timezone
      const detected = getClientTimezone();
      setBrowserTimezone(detected);

      // Get user's timezone from database via API
      try {
        const userData = await User.me(); // Fetch latest user data from API
        const dbTimezone = userData?.timezone;
        setDatabaseTimezone(dbTimezone);
        
        // Priority: Database timezone > Browser timezone
        const activeTimezone = dbTimezone || detected;
        setCurrentTimezone(activeTimezone);
        
        // Update localStorage to match database
        if (dbTimezone) {
          try {
            const localUserData = localStorage.getItem('user');
            if (localUserData) {
              const user = JSON.parse(localUserData);
              user.timezone = dbTimezone;
              localStorage.setItem('user', JSON.stringify(user));
            }
          } catch (e) {
            console.error('Failed to sync localStorage:', e);
          }
        }
        
        console.log('🌍 Timezone loaded:', {
          browser: detected,
          database: dbTimezone,
          active: activeTimezone
        });
        
      } catch (e) {
        console.error('❌ Failed to load user timezone from database:', e);
        // Fallback to browser timezone
        setCurrentTimezone(detected);
        setDatabaseTimezone(null);
      }
    } catch (e) {
      console.error('❌ Critical error in timezone loading:', e);
      // Ultimate fallback
      setCurrentTimezone('UTC');
      setBrowserTimezone('UTC');
      setDatabaseTimezone(null);
    }
    
    setLoading(false);
  };

  const handleTimezoneChange = async (newTimezone) => {
    console.log('🌍 Timezone changing:', currentTimezone, '→', newTimezone);
    setLoading(true);
    
    try {
      // Update database first
      console.log('📡 Calling User.updateTimezone with:', newTimezone);
      const response = await User.updateTimezone(newTimezone);
      console.log('📡 Database response:', response);
      console.log('✅ Updated timezone in database');
      
      // Verify the update by fetching latest user data
      const updatedUser = await User.me();
      console.log('🔍 Verified database timezone:', updatedUser?.timezone);
      
      // Update local state
      setCurrentTimezone(newTimezone);
      setDatabaseTimezone(newTimezone);
      
      // Update localStorage to match
      try {
        const userData = localStorage.getItem('user');
        if (userData) {
          const user = JSON.parse(userData);
          user.timezone = newTimezone;
          localStorage.setItem('user', JSON.stringify(user));
          console.log('✅ Updated timezone in localStorage');
        }
      } catch (e) {
        console.error('❌ Failed to update localStorage:', e);
      }
      
      // Changes will be reflected automatically via WebSocket or natural re-renders
      console.log('🔄 Timezone changes will be reflected automatically');
      
    } catch (e) {
      console.error('❌ Failed to update timezone in database:', e);
      console.error('Error details:', e.message, e.stack);
      // Revert local state on error
      setCurrentTimezone(databaseTimezone || browserTimezone);
      alert(`Failed to update timezone: ${e.message}`);
    }
    
    setLoading(false);
  };

  const getCurrentTime = () => {
    try {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: currentTimezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      return formatter.format(now);
    } catch {
      return 'N/A';
    }
  };

  const selectedTimezone = COMMON_TIMEZONES.find(tz => tz.value === currentTimezone);
  const currentTime = getCurrentTime();

  if (loading) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Clock className="w-3 h-3" />
          <span>Loading timezone...</span>
        </div>
        <div className="h-8 bg-gray-100 rounded animate-pulse"></div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Clock className="w-3 h-3" />
        <span>Timezone Settings</span>
      </div>
      
      <Select value={currentTimezone} onValueChange={handleTimezoneChange} disabled={loading}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue>
            <div className="flex items-center justify-between w-full">
              <span>{selectedTimezone?.label || currentTimezone}</span>
              <span className="ml-2 font-mono">{currentTime}</span>
            </div>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {COMMON_TIMEZONES.map((tz) => (
            <SelectItem key={tz.value} value={tz.value}>
              <div className="flex justify-between w-full">
                <span>{tz.label}</span>
                <span className="ml-2 text-xs text-gray-500">{tz.offset}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Debug info */}
      <div className="text-xs text-gray-400 space-y-1">
        <div>Browser: {browserTimezone}</div>
        <div>Database: {databaseTimezone || 'not set'}</div>
        <div>Active: {currentTimezone}</div>
        <div className="text-xs text-blue-600">
          {databaseTimezone ? '✅ Using database setting' : '⚠️ Using browser fallback'}
        </div>
      </div>
    </div>
  );
}