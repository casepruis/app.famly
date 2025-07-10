
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
    try {
      const user = await User.me();
      if (!user || !user.family_id) {
        setCurrentLanguage('en');
        setIsLoading(false);
        return;
      }

      // Safely get family data with error handling
      let family = null;
      try {
        family = await Family.get(user.family_id);
      } catch (familyError) {
        console.warn('Could not load family data:', familyError);
        // Continue with default language if family data fails
      }

      const defaultLang = family?.language || 'en';
      setFamilyLanguage(defaultLang);

      // Safely get user's member profile
      let members = [];
      try {
        members = await FamilyMember.filter({ 
          family_id: user.family_id, 
          user_id: user.id 
        });
      } catch (memberError) {
        console.warn('Could not load member data:', memberError);
        // Continue with family default language if member data fails
      }
      
      if (members.length > 0) {
        const member = members[0];
        setUserMember(member);
        setCurrentLanguage(member.language || defaultLang);
      } else {
        setCurrentLanguage(defaultLang);
      }
    } catch (error) {
      console.log('Authentication failed, using default language:', error);
      setCurrentLanguage('en');
    }
    setIsLoading(false);
  };

  const updateUserLanguage = async (language) => {
    try {
      if (userMember) {
        await FamilyMember.update(userMember.id, { language });
        setCurrentLanguage(language);
        setUserMember({ ...userMember, language });
      } else {
        // If no member profile exists, just update the local state
        setCurrentLanguage(language);
      }
    } catch (error) {
      console.error('Error updating language:', error);
      // Still update local state even if API call fails
      setCurrentLanguage(language);
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
