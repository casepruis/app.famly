
import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '@/api/entities';
import { FamilyMember } from '@/api/entities';
import { Family } from '@/api/entities';
import { getTranslation } from '@/components/common/translations';

const LanguageContext = createContext();

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export const LanguageProvider = ({ children }) => {
  const [currentLanguage, setCurrentLanguage] = useState('en');
  const [familyLanguage, setFamilyLanguage] = useState('en');
  const [userMember, setUserMember] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUserLanguage();
  }, []);

  const loadUserLanguage = async () => {
    setIsLoading(true);
    
    // First check localStorage for immediate language preference
    const savedLanguage = localStorage.getItem('famlyai_language');
    if (savedLanguage) {
      setCurrentLanguage(savedLanguage);
      console.log('[LanguageProvider] Loaded language from localStorage:', savedLanguage);
    }
    
    try {
      const user = await User.me();
      if (!user || !user.family_id) {
        setCurrentLanguage(savedLanguage || 'en');
        setIsLoading(false);
        return;
      }

      console.log('🔍 [OPTIMIZATION] LanguageProvider: Loading with localStorage persistence');
      
      // Use user language preference if available
      if (user.language && (!savedLanguage || savedLanguage !== user.language)) {
        setCurrentLanguage(user.language);
        localStorage.setItem('famlyai_language', user.language);
        console.log('🌍 [LanguageProvider] Using user preference:', user.language);
      } else if (!savedLanguage) {
        // Default to English or detected language
        const detected = detectLanguage();
        setCurrentLanguage(detected);
        localStorage.setItem('famlyai_language', detected);
        console.log('🌍 [LanguageProvider] No preference, using detected:', detected);
      }
    } catch (error) {
      console.log('Authentication failed, using saved or default language:', error);
      setCurrentLanguage(savedLanguage || 'en');
    }
    setIsLoading(false);
  };

  const updateUserLanguage = async (language) => {
    try {
      // Always update localStorage first for immediate persistence
      localStorage.setItem('famlyai_language', language);
      setCurrentLanguage(language);
      
      if (userMember) {
        await FamilyMember.update(userMember.id, { language });
        setUserMember({ ...userMember, language });
        console.log('[LanguageProvider] Language updated and persisted:', language);
      } else {
        console.log('[LanguageProvider] Language updated locally (no member profile):', language);
      }
    } catch (error) {
      console.error('Error updating language:', error);
      // Language is still persisted in localStorage even if API call fails
    }
  };

  const t = (key, options) => getTranslation(key, currentLanguage, options);

  return (
    <LanguageContext.Provider value={{
      currentLanguage,
      familyLanguage,
      userMember,
      updateUserLanguage,
      isLoading,
      t
    }}>
      {children}
    </LanguageContext.Provider>
  );
};
