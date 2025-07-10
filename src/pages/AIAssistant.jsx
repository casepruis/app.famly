import React, { useState, useEffect } from "react";
import { User, FamilyMember } from "@/api/entities";
import { motion } from "framer-motion";
import { useLanguage } from "@/components/common/LanguageProvider";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import Joyride from "../components/common/Joyride";

import UnifiedAIAssistant from "../components/ai/UnifiedAIAssistant";

const assistantTourSteps = [
  { target: '#ai-chat-interface', title: 'AI Assistant', content: 'Chat directly with the AI assistant for general help, questions, and family coordination.' },
];

export default function AIAssistant() {
  const [user, setUser] = useState(null);
  const [familyMembers, setFamilyMembers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [runTour, setRunTour] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const { t } = useLanguage();

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const currentUser = await User.me();
        setUser(currentUser);
        
        if (currentUser?.family_id) {
          const members = await FamilyMember.filter({ family_id: currentUser.family_id });
          setFamilyMembers(members || []);
        }
      } catch (error) {
        console.error('Error loading user and family data:', error);
        setFamilyMembers([]);
      }
      setIsLoading(false);
    };

    loadData();
    
    const handleAction = (event) => {
      const action = event.detail.action;
      if (action === 'tour') {
        setRunTour(true);
      }
    };
    
    window.addEventListener('actionTriggered', handleAction);
    
    const action = searchParams.get('action');
    if (action === 'tour') {
        setRunTour(true);
        setSearchParams({});
    }
    
    return () => window.removeEventListener('actionTriggered', handleAction);
  }, [searchParams, setSearchParams]);

  const handleTourComplete = () => {
    setRunTour(false);
    localStorage.setItem('famlyai_tour_assistant_completed', 'true');
  };

  if (isLoading) {
    return <div className="p-6 text-center">{t('loading')}...</div>;
  }

  const conversationContext = { type: 'general', name: t('aiAssistant') || 'AI Assistant' };

  return (
    <div className="h-[calc(100vh-var(--header-height,65px))] flex bg-white">
      <Joyride steps={assistantTourSteps} run={runTour} onComplete={handleTourComplete} />

      {/* Back Button */}
      <div className="absolute top-4 left-4 z-10">
        <Link to={createPageUrl('Dashboard')}>
          <Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-700">
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('backToDashboard') || 'Back'}
          </Button>
        </Link>
      </div>

      <div id="ai-chat-interface" className="flex-1 flex flex-col">
        <UnifiedAIAssistant
          conversationContext={conversationContext}
          allFamilyMembers={familyMembers}
          user={user}
          onUpdate={() => {}}
        />
      </div>
    </div>
  );
}