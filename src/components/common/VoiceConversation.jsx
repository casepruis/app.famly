// src/components/common/VoiceConversation.jsx
// Natural voice conversation - always-on microphone with interrupt capability

import React, { useState, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { Mic, Phone, PhoneOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useVoiceConversation } from '@/hooks/useVoiceConversation';
import { useLanguage } from '@/components/common/LanguageProvider';
import { useFamilyData } from '@/hooks/FamilyDataContext';
import { cn } from '@/lib/utils';

export default function VoiceConversation() {
  const location = useLocation();
  const { currentLanguage } = useLanguage();
  const { user, reload } = useFamilyData();
  const [isExpanded, setIsExpanded] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const responseRef = useRef('');
  const actionsRef = useRef(false); // Track if actions were taken during conversation

  const {
    conversationState,
    isActive,
    startConversation,
    endConversation,
  } = useVoiceConversation({
    language: currentLanguage,
    onTranscript: useCallback((text, role) => {
      if (role === 'user') {
        setTranscript(text);
        responseRef.current = '';
        setResponse('');
      } else {
        responseRef.current += text;
        setResponse(responseRef.current);
      }
    }, []),
    onFunctionCall: useCallback((name, result) => {
      console.log('🎤 Voice function:', name, result);
      // Track that actions were taken - will reload when conversation ends
      if (result?.success) {
        actionsRef.current = true;
      }
    }, []),
    onError: useCallback((error) => {
      console.error('🎤 Voice error:', error);
    }, []),
  });

  // Don't show if user is not logged in
  if (!user) return null;
  
  // Hide on AI assistant page
  if (location.pathname === '/aiassistant') return null;

  const handleToggle = () => {
    if (isActive) {
      endConversation();
      // Reload data if actions were taken during conversation
      if (actionsRef.current) {
        reload?.();
        actionsRef.current = false;
      }
      setIsExpanded(false);
      setTranscript('');
      setResponse('');
      responseRef.current = '';
    } else {
      setIsExpanded(true);
      startConversation();
    }
  };

  const handleClose = () => {
    endConversation();
    // Reload data if actions were taken during conversation
    if (actionsRef.current) {
      reload?.();
      actionsRef.current = false;
    }
    setIsExpanded(false);
    setTranscript('');
    setResponse('');
    responseRef.current = '';
  };

  // State indicators
  const getStateDisplay = () => {
    const states = {
      idle: { icon: <Phone className="h-5 w-5" />, text: currentLanguage === 'nl' ? 'Start gesprek' : 'Start call' },
      connecting: { icon: <Loader2 className="h-5 w-5 animate-spin" />, text: currentLanguage === 'nl' ? 'Verbinden...' : 'Connecting...' },
      listening: { icon: <Mic className="h-5 w-5 animate-pulse text-green-400" />, text: currentLanguage === 'nl' ? 'Luisteren...' : 'Listening...' },
      thinking: { icon: <Loader2 className="h-5 w-5 animate-spin" />, text: currentLanguage === 'nl' ? 'Denken...' : 'Thinking...' },
      speaking: { icon: <Mic className="h-5 w-5 text-blue-400" />, text: currentLanguage === 'nl' ? 'Spreken...' : 'Speaking...' },
    };
    return states[conversationState] || states.idle;
  };

  const stateDisplay = getStateDisplay();

  // Collapsed state - just a phone button
  if (!isExpanded) {
    return (
      <Button
        size="lg"
        className={cn(
          "fixed bottom-4 right-4 h-14 w-14 rounded-full shadow-lg z-40",
          "bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700",
          "transition-all duration-200 hover:scale-110"
        )}
        onClick={() => { setIsExpanded(true); startConversation(); }}
      >
        <Phone className="h-6 w-6 text-white" />
      </Button>
    );
  }

  // Expanded state - conversation panel
  return (
    <div className="fixed bottom-4 right-4 w-80 bg-white border border-gray-200 rounded-2xl shadow-2xl z-40 overflow-hidden">
      {/* Header */}
      <div className={cn(
        "p-4 flex items-center justify-between transition-colors",
        isActive 
          ? "bg-gradient-to-r from-green-500 to-emerald-600" 
          : "bg-gradient-to-r from-gray-400 to-gray-500"
      )}>
        <div className="flex items-center gap-2 text-white">
          {stateDisplay.icon}
          <span className="font-medium">{stateDisplay.text}</span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Instructions */}
        {!isActive && (
          <div className="text-center text-sm text-gray-500">
            {currentLanguage === 'nl' 
              ? 'Start een gesprek en praat gewoon. Je kunt de AI onderbreken door te praten.'
              : 'Start a call and just talk. You can interrupt the AI by speaking.'}
          </div>
        )}

        {/* Active conversation indicator */}
        {isActive && (
          <div className="flex justify-center">
            <div className={cn(
              "w-20 h-20 rounded-full flex items-center justify-center",
              conversationState === 'listening' && "bg-green-100 animate-pulse",
              conversationState === 'thinking' && "bg-yellow-100",
              conversationState === 'speaking' && "bg-blue-100 animate-pulse",
            )}>
              {conversationState === 'listening' && (
                <Mic className="h-10 w-10 text-green-600" />
              )}
              {conversationState === 'thinking' && (
                <Loader2 className="h-10 w-10 text-yellow-600 animate-spin" />
              )}
              {conversationState === 'speaking' && (
                <div className="flex gap-1">
                  <div className="w-2 h-8 bg-blue-500 rounded animate-pulse" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-8 bg-blue-500 rounded animate-pulse" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-8 bg-blue-500 rounded animate-pulse" style={{ animationDelay: '300ms' }} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Transcript */}
        {transcript && (
          <div className="bg-gray-50 rounded-lg p-3 max-h-20 overflow-y-auto">
            <div className="text-xs text-gray-500 mb-1">
              {currentLanguage === 'nl' ? 'Jij:' : 'You:'}
            </div>
            <div className="text-sm text-gray-800">{transcript}</div>
          </div>
        )}

        {/* Response */}
        {response && (
          <div className="bg-blue-50 rounded-lg p-3 max-h-20 overflow-y-auto">
            <div className="text-xs text-blue-600 mb-1">Famly:</div>
            <div className="text-sm text-gray-800">{response}</div>
          </div>
        )}

        {/* Main button */}
        <Button
          size="lg"
          className={cn(
            "w-full h-14 rounded-xl transition-all duration-200",
            isActive 
              ? "bg-red-500 hover:bg-red-600" 
              : "bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
          )}
          onClick={handleToggle}
        >
          {isActive ? (
            <div className="flex items-center gap-2">
              <PhoneOff className="h-6 w-6 text-white" />
              <span className="text-white font-medium">
                {currentLanguage === 'nl' ? 'Ophangen' : 'End Call'}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Phone className="h-6 w-6 text-white" />
              <span className="text-white font-medium">
                {currentLanguage === 'nl' ? 'Start gesprek' : 'Start Call'}
              </span>
            </div>
          )}
        </Button>

        {/* Tip */}
        {isActive && (
          <p className="text-xs text-center text-gray-400">
            {currentLanguage === 'nl' 
              ? '💡 Praat gewoon om te onderbreken'
              : '💡 Just speak to interrupt'}
          </p>
        )}
      </div>
    </div>
  );
}
