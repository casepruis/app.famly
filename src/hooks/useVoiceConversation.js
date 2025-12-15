// src/hooks/useVoiceConversation.js
// Voice conversation hook - always-on microphone with server VAD
// Enables natural conversation with interruption capability

import { useState, useRef, useCallback, useEffect } from 'react';

const SAMPLE_RATE = 24000;
const CHANNELS = 1;

/**
 * Hook for natural voice conversation using GPT-4o Realtime API
 * 
 * Key difference from useVoiceAssistant:
 * - Microphone stays ON during the entire conversation
 * - Server VAD automatically detects when user starts/stops speaking
 * - User can interrupt AI at any time by speaking
 * 
 * @param {Object} options
 * @param {string} options.language - User's preferred language ('en' or 'nl')
 * @param {function} options.onTranscript - Called when transcript is received
 * @param {function} options.onFunctionCall - Called when a function is executed
 * @param {function} options.onError - Called on errors
 * @param {function} options.onStateChange - Called when conversation state changes
 */
export function useVoiceConversation({ 
  language = 'en',
  onTranscript,
  onFunctionCall,
  onError,
  onStateChange,
} = {}) {
  // Conversation states: 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking'
  const [conversationState, setConversationState] = useState('idle');
  const [isActive, setIsActive] = useState(false);
  
  const wsRef = useRef(null);
  const audioContextRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const processorRef = useRef(null);
  const audioQueueRef = useRef([]);
  const currentSourceRef = useRef(null);
  const isPlayingRef = useRef(false);
  const thinkingIntervalRef = useRef(null); // For repeating thinking sound

  // Update state and notify
  const updateState = useCallback((newState) => {
    setConversationState(newState);
    onStateChange?.(newState);
  }, [onStateChange]);

  // Initialize audio context
  const initAudioContext = useCallback(async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: SAMPLE_RATE
      });
    }
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  // Audio conversion utilities
  const floatTo16BitPCM = (float32Array) => {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return buffer;
  };

  const int16ToFloat32 = (int16Array) => {
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / (int16Array[i] < 0 ? 0x8000 : 0x7fff);
    }
    return float32Array;
  };

  const arrayBufferToBase64 = (buffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  const base64ToArrayBuffer = (base64) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  };

  // Clear audio queue and stop playback
  const clearAudio = useCallback(() => {
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    if (currentSourceRef.current) {
      try {
        currentSourceRef.current.stop();
      } catch (e) {
        // May already be stopped
      }
      currentSourceRef.current = null;
    }
  }, []);

  // Play a subtle "thinking" sound
  const playThinkingSound = useCallback(async () => {
    try {
      const audioContext = await initAudioContext();
      
      // Create a gentle, short notification sound
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Soft, pleasant tone
      oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // A4 note
      oscillator.frequency.setValueAtTime(520, audioContext.currentTime + 0.1); // Slight rise
      oscillator.type = 'sine';
      
      // Quick fade in and out
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.15, audioContext.currentTime + 0.05);
      gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.25);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.25);
    } catch (e) {
      console.log('Could not play thinking sound:', e);
    }
  }, [initAudioContext]);

  // Start repeating thinking sound
  const startThinkingSound = useCallback(() => {
    // Clear any existing interval
    if (thinkingIntervalRef.current) {
      clearInterval(thinkingIntervalRef.current);
    }
    
    // Play immediately
    playThinkingSound();
    
    // Then repeat every 1.5 seconds while thinking
    thinkingIntervalRef.current = setInterval(() => {
      playThinkingSound();
    }, 1500);
  }, [playThinkingSound]);

  // Stop thinking sound
  const stopThinkingSound = useCallback(() => {
    if (thinkingIntervalRef.current) {
      clearInterval(thinkingIntervalRef.current);
      thinkingIntervalRef.current = null;
    }
  }, []);

  // Play audio from queue
  const playAudioQueue = useCallback(async () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) return;
    
    isPlayingRef.current = true;
    updateState('speaking');
    
    const audioContext = await initAudioContext();
    
    while (audioQueueRef.current.length > 0 && isPlayingRef.current) {
      const audioData = audioQueueRef.current.shift();
      if (!isPlayingRef.current) break;
      
      try {
        const pcmBuffer = base64ToArrayBuffer(audioData);
        const int16Array = new Int16Array(pcmBuffer);
        const float32Array = int16ToFloat32(int16Array);
        
        const audioBuffer = audioContext.createBuffer(1, float32Array.length, SAMPLE_RATE);
        audioBuffer.copyToChannel(float32Array, 0);
        
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        currentSourceRef.current = source;
        
        await new Promise((resolve) => {
          source.onended = resolve;
          source.start();
        });
        
        currentSourceRef.current = null;
      } catch (e) {
        console.error('Audio playback error:', e);
        currentSourceRef.current = null;
      }
    }
    
    isPlayingRef.current = false;
    // After speaking, go back to listening (mic is still on)
    if (isActive) {
      updateState('listening');
    }
  }, [initAudioContext, updateState, isActive]);

  // Handle WebSocket messages
  const handleMessage = useCallback((event) => {
    try {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'ready':
          console.log('🎤 Voice conversation ready');
          updateState('listening');
          break;
          
        case 'audio':
          // Queue audio for playback - stop thinking sound when audio starts
          stopThinkingSound();
          audioQueueRef.current.push(data.data);
          playAudioQueue();
          break;
          
        case 'transcript':
          if (data.role === 'user') {
            updateState('thinking');
          }
          onTranscript?.(data.data, data.role);
          break;
        
        case 'thinking':
          // AI is processing a tool call - show thinking state
          // Only start sound if not currently speaking (sound would overlap with speech)
          console.log('🎤 AI is thinking/processing:', data.tool);
          updateState('thinking');
          // Delay thinking sound - wait until AI has finished speaking
          // The sound will only play if not currently playing audio
          setTimeout(() => {
            if (!isPlayingRef.current && audioQueueRef.current.length === 0) {
              startThinkingSound();
            }
          }, 500); // Wait for any pending audio to start playing
          break;
        
        case 'response_done':
          // Response complete - stop thinking sound and go back to listening
          stopThinkingSound();
          if (isActive && !isPlayingRef.current) {
            updateState('listening');
          }
          break;
        
        case 'interrupt':
          // User started speaking - stop everything
          console.log('🎤 Interrupt! User started speaking');
          stopThinkingSound();
          clearAudio();
          updateState('listening');
          break;
          
        case 'function_call':
          onFunctionCall?.(data.name, data.result);
          break;
          
        case 'error':
          console.error('Voice error:', data.message);
          onError?.(data.message);
          break;
      }
    } catch (e) {
      console.error('Message parse error:', e);
    }
  }, [playAudioQueue, startThinkingSound, stopThinkingSound, clearAudio, onTranscript, onFunctionCall, onError, updateState, isActive]);

  // Start microphone streaming (always on during conversation)
  const startMicrophone = useCallback(async () => {
    try {
      console.log('🎤 Starting microphone...');
      const audioContext = await initAudioContext();
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: CHANNELS,
          sampleRate: SAMPLE_RATE,
          echoCancellation: true,
          noiseSuppression: true,
        }
      });
      
      mediaStreamRef.current = stream;
      
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      
      processor.onaudioprocess = (e) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        
        const inputData = e.inputBuffer.getChannelData(0);
        const pcmData = floatTo16BitPCM(inputData);
        const base64 = arrayBufferToBase64(pcmData);
        
        // Always send audio - server VAD will handle detection
        wsRef.current.send(JSON.stringify({
          type: 'audio',
          data: base64
        }));
      };
      
      source.connect(processor);
      processor.connect(audioContext.destination);
      processorRef.current = { source, processor };
      
      console.log('🎤 Microphone active - always listening');
      return true;
    } catch (e) {
      console.error('Microphone error:', e);
      onError?.('Could not access microphone');
      return false;
    }
  }, [initAudioContext, onError]);

  // Stop microphone
  const stopMicrophone = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.source.disconnect();
      processorRef.current.processor.disconnect();
      processorRef.current = null;
    }
    
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    console.log('🎤 Microphone stopped');
  }, []);

  // Start conversation - connects WebSocket and starts microphone
  const startConversation = useCallback(async () => {
    if (isActive) return;
    
    updateState('connecting');
    
    // Close any existing connection
    if (wsRef.current) {
      try { wsRef.current.close(); } catch (e) {}
      wsRef.current = null;
    }
    
    const token = localStorage.getItem('famlyai_token');
    if (!token) {
      onError?.('Not authenticated');
      updateState('idle');
      return;
    }
    
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsBase = import.meta?.env?.VITE_WS_BASE || `${protocol}//${host}`;
      
      console.log('🎤 Starting voice conversation...');
      
      const ws = new WebSocket(`${wsBase}/realtime?token=${encodeURIComponent(token)}&language=${language}`);
      
      const connected = await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          ws.close();
          resolve(false);
        }, 10000);
        
        ws.onopen = () => {
          clearTimeout(timeout);
          resolve(true);
        };
        
        ws.onerror = () => {
          clearTimeout(timeout);
          resolve(false);
        };
      });
      
      if (!connected) {
        onError?.('Connection failed');
        updateState('idle');
        return;
      }
      
      ws.onmessage = handleMessage;
      ws.onclose = () => {
        console.log('🎤 Voice conversation ended');
        setIsActive(false);
        updateState('idle');
        stopMicrophone();
        stopThinkingSound();
        clearAudio();
      };
      ws.onerror = () => {
        onError?.('Connection error');
      };
      
      wsRef.current = ws;
      
      // Start microphone (stays on for entire conversation)
      const micStarted = await startMicrophone();
      if (!micStarted) {
        ws.close();
        updateState('idle');
        return;
      }
      
      setIsActive(true);
      // State will be set to 'listening' when we get 'ready' from server
      
    } catch (e) {
      console.error('Failed to start conversation:', e);
      onError?.('Failed to start conversation');
      updateState('idle');
    }
  }, [isActive, language, handleMessage, onError, updateState, startMicrophone, stopMicrophone, clearAudio]);

  // End conversation
  const endConversation = useCallback(() => {
    console.log('🎤 Ending conversation');
    stopThinkingSound();
    clearAudio();
    stopMicrophone();
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setIsActive(false);
    updateState('idle');
  }, [clearAudio, stopMicrophone, updateState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      endConversation();
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [endConversation]);

  return {
    // State
    conversationState, // 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking'
    isActive,
    
    // Actions
    startConversation,
    endConversation,
  };
}

export default useVoiceConversation;
