
import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lightbulb, Loader2 } from "lucide-react";
import { useLanguage } from "@/components/common/LanguageProvider";
import { InvokeLLM } from "@/api/integrations";

export default function FunFactCard() {
  const [funFact, setFunFact] = useState('');
  const [isLoadingFact, setIsLoadingFact] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const { t, currentLanguage } = useLanguage();

  const getFallbackFact = () => {
    const facts = {
      nl: [
        "Honing bederft nooit! Archeologen hebben eetbare honing gevonden die 3000 jaar oud is.",
        "Een octopus heeft drie harten en blauw bloed.",
        "Bananen zijn botanisch gezien bessen, maar aardbeien niet.",
        "Een dag op Venus duurt langer dan een jaar op Venus.",
        "Bijen communiceren door te dansen om de locatie van bloemen door te geven."
      ],
      en: [
        "Honey never spoils! Archaeologists have found edible honey that's 3000 years old.",
        "An octopus has three hearts and blue blood.",
        "Bananas are botanically berries, but strawberries aren't.",
        "A day on Venus lasts longer than a year on Venus.",
        "Bees communicate by dancing to share the location of flowers."
      ]
    };
    
    const factList = facts[currentLanguage] || facts.en;
    return factList[Math.floor(Math.random() * factList.length)];
  };

  useEffect(() => {
    const generateFunFact = async () => {
      setIsLoadingFact(true);
      try {
        // Add delay to prevent rapid requests and implement exponential backoff for retries
        await new Promise(resolve => setTimeout(resolve, 3000 + (retryCount * 4000))); // Much longer delays
        
        const result = await InvokeLLM({
          prompt: `Provide a short, interesting, and family-friendly "fun fact of the day". Keep it under 50 words. 

IMPORTANT: Respond ONLY in ${currentLanguage}. Use proper grammar and natural phrasing for ${currentLanguage}. Make it engaging and educational.`,
          response_json_schema: {
            type: "object",
            properties: {
              fact: { type: "string" }
            },
            required: ["fact"]
          }
        });
        setFunFact(result.fact);
        setRetryCount(0); // Reset retry count on success
      } catch (error) {
        console.error("Error generating fun fact:", error);
        
        // If it's a rate limit error, wait much longer before retrying
        if (error.response?.status === 429 && retryCount < 2) {
          setRetryCount(prev => prev + 1);
          setTimeout(() => generateFunFact(), 15000 + (retryCount * 8000)); // Much longer backoff
          return;
        }
        
        // Use fallback fact if not a rate limit error or retries exhausted
        setFunFact(getFallbackFact());
      }
      setIsLoadingFact(false);
    };

    generateFunFact();
  }, [currentLanguage, retryCount]); // Depend on retryCount to re-run effect logic for retries

  return (
    <Card className="border-famly-accent bg-white">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-famly-text-primary">
          <Lightbulb className="w-5 h-5 text-yellow-400" />
          {t('funFact') || 'Fun Fact'}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="min-h-[80px] flex items-start">
          <div className="min-h-[80px] flex items-start text-sm text-famly-text-secondary leading-relaxed">
            {isLoadingFact ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                {retryCount > 0 && <span className="text-xs">Retrying...</span>}
              </div>
            ) : (
              <p>{funFact}</p> // ✅ safe to use <p> here because it's plain text
            )}
          </div>

        </div>
      </CardContent>
    </Card>
  );
}
