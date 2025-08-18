
import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lightbulb, Loader2 } from "lucide-react";
import { useLanguage } from "@/components/common/LanguageProvider";
import { InvokeLLM, getLLMEstimatedCost } from "@/api/integrations";


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
    let canceled = false;

    const generateFunFact = async () => {
      setIsLoadingFact(true);

      const delays = [0, 3000, 7000]; // start immediately, then 3s, then 7s

      try {
        for (let i = 0; i < delays.length; i++) {
          try {
            // wait before attempt
            if (delays[i] > 0) {
              await new Promise((r) => setTimeout(r, delays[i]));
            }

            const result = await InvokeLLM({
              prompt: `Provide a short, interesting, and family-friendly "fun fact of the day". Keep it under 50 words.

  IMPORTANT: Respond ONLY in ${currentLanguage}. Use proper grammar and natural phrasing for ${currentLanguage}. Make it engaging and educational.`,
              response_json_schema: {
                type: "object",
                properties: { fact: { type: "string" } },
                required: ["fact"],
              },
              // strict: false  // default is soft, so no 422 if key differs
            });

            if (canceled) return;

            // Accept multiple shapes (model sometimes returns "fun_fact")
            const pickFirstString = (obj) => {
              if (!obj || typeof obj !== "object") return null;
              for (const v of Object.values(obj)) {
                if (typeof v === "string" && v.trim()) return v.trim();
              }
              return null;
            };

            const fact =
              (result && result.data && (result.data.fact || result.data.fun_fact)) ||
              (typeof result?.summary === "string" ? result.summary : null) ||
              pickFirstString(result?.data);

            setFunFact(fact || getFallbackFact());

            // (optional) see why schema didn’t match
            // console.debug("validation:", result?.meta?.validation_error);

            return; // success -> stop retrying
          } catch (err) {
            if (canceled) return;
            const isLast = i === delays.length - 1;
            const msg = (err && err.message ? err.message : "").toLowerCase();
            const maybeRateLimited = msg.includes("429") || msg.includes("rate");

            console.warn(
              `Fun fact attempt ${i + 1} failed${maybeRateLimited ? " (rate limit?)" : ""}:`,
              err
            );

            if (isLast) {
              setFunFact(getFallbackFact());
            }
            // else: loop continues to next delay
          }
        }
      } finally {
        if (!canceled) setIsLoadingFact(false); // ✅ always clear spinner
      }
    };

    generateFunFact();

    return () => {
      canceled = true;
    };
  }, [currentLanguage]);


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
