// Language detection utility using LLM
// This uses the AI to accurately detect the language of user input

import { InvokeLLM } from '@/api/integrations';

/**
 * Detect the language of input text using LLM
 * Returns 'nl' for Dutch, 'en' for English, or 'unknown' if uncertain
 */
export async function detectLanguage(text) {
  if (!text || typeof text !== 'string' || text.trim().length < 3) {
    return 'unknown';
  }

  try {
    console.log('🔍 LLM Language detection for:', text);
    
    const response = await InvokeLLM({
      prompt: `Detect the language of this text. Return ONLY one of these codes: "en" for English, "nl" for Dutch/Nederlands, or "unknown" if you cannot determine the language with confidence.

Text to analyze: "${text}"

Return only the language code (en/nl/unknown):`,
      response_json_schema: {
        type: "object",
        properties: {
          language: { 
            type: "string", 
            enum: ["en", "nl", "unknown"],
            description: "The detected language code"
          }
        },
        required: ["language"]
      },
      strict: true
    });

    const detectedLanguage = response?.data?.language || response?.language || 'unknown';
    console.log('🔍 LLM detected language:', detectedLanguage);
    
    return detectedLanguage;
  } catch (error) {
    console.warn('🔍 Language detection failed, falling back to unknown:', error);
    return 'unknown';
  }
}

/**
 * Get a human-readable language name
 */
export function getLanguageName(languageCode, displayLanguage = 'en') {
  const names = {
    en: { 
      'en': 'English', 
      'nl': 'Dutch',
      'unknown': 'Unknown'
    },
    nl: { 
      'en': 'Engels', 
      'nl': 'Nederlands',
      'unknown': 'Onbekend'
    }
  };
  
  return names[displayLanguage]?.[languageCode] || languageCode;
}

/**
 * Check if detected language differs from user's preferred language
 */
export function shouldPromptLanguageSwitch(detectedLang, preferredLang) {
  return detectedLang !== 'unknown' && 
         detectedLang !== preferredLang && 
         ['en', 'nl'].includes(detectedLang) && 
         ['en', 'nl'].includes(preferredLang);
}