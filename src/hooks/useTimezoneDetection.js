import { useEffect } from 'react';
import { getClientTimezone } from '@/utils/timezone';

// Hook to automatically detect and store user timezone
export const useTimezoneDetection = () => {
  useEffect(() => {
    const detectAndStoreTimezone = () => {
      const detectedTimezone = getClientTimezone();
      const currentUser = localStorage.getItem('user');
      
      if (currentUser) {
        try {
          const userData = JSON.parse(currentUser);
          
          // Only update if timezone is different or missing
          if (!userData.timezone || userData.timezone !== detectedTimezone) {
            const updatedUser = {
              ...userData,
              timezone: detectedTimezone
            };
            
            localStorage.setItem('user', JSON.stringify(updatedUser));
            
            // TODO: Also update the backend user profile with new timezone
            // This would require an API call to update user preferences
            console.log('Timezone detected and stored:', detectedTimezone);
          }
        } catch (error) {
          console.error('Error updating user timezone:', error);
        }
      }
    };

    detectAndStoreTimezone();
  }, []);
};