// src/components/common/GlobalVoiceButton.jsx
// Global floating voice assistant button available on all pages

import React, { useState, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Mic, MicOff, Loader2, X, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useVoiceAssistant } from '@/hooks/useVoiceAssistant';
import { useLanguage } from '@/components/common/LanguageProvider';
import { useFamilyData } from '@/hooks/FamilyDataContext';
import { cn } from '@/lib/utils';

export default function GlobalVoiceButton() {
  const location = useLocation();
  const { currentLanguage } = useLanguage();
  const { user, reload } = useFamilyData();
  const [isExpanded, setIsExpanded] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [lastResponse, setLastResponse] = useState('');
  const responseRef = useRef('');

  const {
    isConnected,
    isListening,
    isProcessing,
    isPlaying,
    connect,
    disconnect,
    startListening,
    stopListening,
    cancelResponse,
  } = useVoiceAssistant({
    language: currentLanguage,
    onTranscript: useCallback((text, role) => {
      if (role === 'user') {
        // User transcript comes complete, just set it
        setTranscript(text);
        // Reset response accumulator for next response
        responseRef.current = '';
      } else {
        // Assistant transcript comes as deltas, accumulate them
        responseRef.current += text;
        setLastResponse(responseRef.current);
      }
    }, []),
    onFunctionCall: useCallback((name, result) => {
      console.log('🎤 Voice function call:', name, result);
      if (result?.success) {
        reload?.(); // Refresh data after successful action
      }
    }, [reload]),
    onError: useCallback((error) => {
      console.error('🎤 Voice error:', error);
      responseRef.current = '';
      setLastResponse(currentLanguage === 'nl' 
        ? `Fout: ${error}` 
        : `Error: ${error}`
      );
    }, [currentLanguage]),
  });

  // Don't show if user is not logged in
  if (!user) return null;
  
  // Hide on AI assistant page (it has its own voice controls)
  if (location.pathname === '/aiassistant') return null;

  const handleToggleVoice = async () => {
    console.log('🎤 handleToggleVoice called', { isListening, isConnected });
    if (isListening) {
      stopListening();
    } else if (isConnected) {
      startListening();
    } else {
      try {
        console.log('🎤 Connecting...');
        await connect();
        console.log('🎤 Connected, starting to listen...');
        // Small delay to ensure connection is ready
        setTimeout(() => startListening(), 100);
      } catch (e) {
        console.error('🎤 Connection failed:', e);
      }
    }
  };

  const handleClose = () => {
    if (isListening) stopListening();
    if (isConnected) disconnect();
    setIsExpanded(false);
    setTranscript('');
    setLastResponse('');
    responseRef.current = '';
  };

  // Collapsed state - just a microphone button
  if (!isExpanded) {
    return (
      <Button
        size="lg"
        className={cn(
          "fixed bottom-4 right-4 h-14 w-14 rounded-full shadow-lg z-40",
          "bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700",
          "transition-all duration-200 hover:scale-110"
        )}
        onClick={() => setIsExpanded(true)}
      >
        <Mic className="h-6 w-6 text-white" />
      </Button>
    );
  }

  // Expanded state - voice panel
  return (
    <div className="fixed bottom-4 right-4 w-80 bg-white border border-gray-200 rounded-2xl shadow-2xl z-40 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-white">
          {isPlaying ? (
            <Volume2 className="h-5 w-5 animate-pulse" />
          ) : isProcessing ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : isListening ? (
            <Mic className="h-5 w-5 animate-pulse text-red-200" />
          ) : (
            <Mic className="h-5 w-5" />
          )}
          <span className="font-medium">
            {currentLanguage === 'nl' ? 'Spraakassistent' : 'Voice Assistant'}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-white hover:bg-white/20"
          onClick={handleClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Status - mutually exclusive states */}
        <div className="text-center text-sm text-gray-500">
          {isPlaying ? (
            currentLanguage === 'nl' ? '🔊 Spreken...' : '🔊 Speaking...'
          ) : isProcessing ? (
            currentLanguage === 'nl' ? '🤔 Verwerken...' : '🤔 Processing...'
          ) : isListening ? (
            <span className="text-red-500 font-medium">
              {currentLanguage === 'nl' ? '🎙️ Luisteren...' : '🎙️ Listening...'}
            </span>
          ) : isConnected ? (
            currentLanguage === 'nl'
              ? 'Verbonden - tik om te spreken'
              : 'Connected - tap to speak'
          ) : (
            currentLanguage === 'nl' 
              ? 'Tik op de microfoon om te beginnen' 
              : 'Tap the microphone to start'
          )}
        </div>

        {/* Transcript */}
        {transcript && (
          <div className="bg-blue-50 rounded-lg p-3">
            <div className="text-xs text-blue-600 mb-1">
              {currentLanguage === 'nl' ? 'Jij:' : 'You:'}
            </div>
            <div className="text-sm text-gray-800">{transcript}</div>
          </div>
        )}

        {/* Response */}
        {lastResponse && (
          <div className="bg-purple-50 rounded-lg p-3">
            <div className="text-xs text-purple-600 mb-1">Famly:</div>
            <div className="text-sm text-gray-800">{lastResponse}</div>
          </div>
        )}

        {/* Main button */}
        <Button
          size="lg"
          className={cn(
            "w-full h-16 rounded-xl transition-all duration-200",
            isListening 
              ? "bg-red-500 hover:bg-red-600" 
              : (isPlaying || isProcessing)
                ? "bg-orange-500 hover:bg-orange-600"
                : "bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
          )}
          onClick={() => {
            if (isPlaying || isProcessing) {
              // Interrupt the AI
              cancelResponse();
            } else {
              handleToggleVoice();
            }
          }}
        >
          {isPlaying ? (
            <div className="flex items-center gap-2">
              <Volume2 className="h-8 w-8 text-white animate-pulse" />
              <span className="text-white font-medium">
                {currentLanguage === 'nl' ? 'Stop' : 'Stop'}
              </span>
            </div>
          ) : isProcessing ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-8 w-8 text-white animate-spin" />
              <span className="text-white font-medium">
                {currentLanguage === 'nl' ? 'Annuleer' : 'Cancel'}
              </span>
            </div>
          ) : isListening ? (
            <div className="flex items-center gap-2">
              <MicOff className="h-8 w-8 text-white" />
              <span className="text-white font-medium">
                {currentLanguage === 'nl' ? 'Stop' : 'Stop'}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Mic className="h-8 w-8 text-white" />
              <span className="text-white font-medium">
                {currentLanguage === 'nl' ? 'Spreek' : 'Speak'}
              </span>
            </div>
          )}
        </Button>
      </div>
    </div>
  );
}
