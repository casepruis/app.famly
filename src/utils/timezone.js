// Timezone utility functions for proper datetime handling
export const getClientTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC'; // Fallback
  }
};

export const getCurrentUser = () => {
  try {
    const userData = localStorage.getItem('user');
    return userData ? JSON.parse(userData) : null;
  } catch {
    return null;
  }
};

export const getUserTimezone = () => {
  const user = getCurrentUser();
  return user?.timezone || getClientTimezone();
};

// Convert local datetime input to proper ISO string in user's timezone
export const localDateTimeToISO = (localDateTimeString, userTimezone = null) => {
  if (!localDateTimeString) return null;
  
  const timezone = userTimezone || getUserTimezone();
  
  try {
    // Create date in user's timezone
    const date = new Date(localDateTimeString);
    return date.toISOString(); // This will be in UTC
  } catch {
    return null;
  }
};

// Convert ISO string to local datetime string for input fields
export const isoToLocalDateTime = (isoString, userTimezone = null) => {
  if (!isoString) return '';
  
  try {
    const date = new Date(isoString);
    // Format for datetime-local input (YYYY-MM-DDTHH:mm)
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch {
    return '';
  }
};

// Format date for display in user's timezone
export const formatDateInUserTimezone = (isoString, options = {}, userTimezone = null) => {
  if (!isoString) return '';
  
  const timezone = userTimezone || getUserTimezone();
  
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('en-GB', {
      ...options,
      timeZone: timezone
    }).format(date);
  } catch {
    return isoString;
  }
};

// Get date part from ISO string in user's timezone
export const getDateFromISO = (isoString, userTimezone = null) => {
  if (!isoString) return '';
  
  const timezone = userTimezone || getUserTimezone();
  
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('en-CA', { // en-CA gives YYYY-MM-DD format
      timeZone: timezone
    }).format(date);
  } catch {
    return '';
  }
};

// Get time part from ISO string in user's timezone  
export const getTimeFromISO = (isoString, userTimezone = null) => {
  if (!isoString) return '';
  
  const timezone = userTimezone || getUserTimezone();
  
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: timezone
    }).format(date);
  } catch {
    return '';
  }
};

// Combine date and time strings into ISO format
export const combineDateTimeToISO = (dateStr, timeStr, userTimezone = null) => {
  if (!dateStr) return null;
  
  const time = timeStr || '09:00';
  
  try {
    // Create the datetime string 
    const dateTimeStr = `${dateStr}T${time}:00`;
    
    // The issue: new Date(dateTimeStr) treats this as LOCAL time in browser's timezone
    // But we want to treat it as if the user explicitly meant their local time
    // and convert it to proper UTC for storage
    
    // For Amsterdam (CET = UTC+1), if user enters 12:30:
    // - They mean 12:30 Amsterdam time
    // - This should be stored as 11:30 UTC
    // - new Date('2025-11-24T12:30:00') in Amsterdam browser creates 12:30 CET
    // - .toISOString() converts that to 11:30 UTC ✓
    
    const localDate = new Date(dateTimeStr);
    const isoString = localDate.toISOString();
    
    return isoString;
  } catch {
    return null;
  }
};