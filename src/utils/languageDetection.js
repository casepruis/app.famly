// Language detection utility - simple heuristic (no LLM call)
// Fast client-side detection to avoid blocking the UI

// Common Dutch words that rarely appear in English
const DUTCH_INDICATORS = [
  'ik', 'je', 'we', 'het', 'een', 'de', 'en', 'van', 'op', 'met', 'zijn', 'naar',
  'voor', 'dat', 'maar', 'niet', 'ook', 'wel', 'als', 'nog', 'aan', 'door', 'bij',
  'uit', 'over', 'tot', 'jullie', 'willen', 'kunnen', 'moeten', 'gaan', 'komen',
  'hebben', 'maken', 'doen', 'laten', 'weten', 'zeggen', 'zien', 'hoe', 'wat',
  'wie', 'waar', 'wanneer', 'waarom', 'welke', 'zondag', 'maandag', 'dinsdag',
  'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'morgen', 'vandaag', 'gisteren'
];

/**
 * Detect the language of input text using simple heuristics
 * Returns 'nl' for Dutch, 'en' for English
 * This is fast and doesn't block the UI
 */
export async function detectLanguage(text) {
  if (!text || typeof text !== 'string' || text.trim().length < 3) {
    return 'unknown';
  }

  const words = text.toLowerCase().split(/\s+/);
  let dutchScore = 0;
  
  for (const word of words) {
    if (DUTCH_INDICATORS.includes(word)) {
      dutchScore++;
    }
  }
  
  // If at least 20% of words are Dutch indicators, consider it Dutch
  const dutchRatio = dutchScore / words.length;
  const detectedLang = dutchRatio >= 0.15 ? 'nl' : 'en';
  
  console.log('🔍 Language detection:', { text: text.substring(0, 30), dutchScore, total: words.length, result: detectedLang });
  
  return detectedLang;
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