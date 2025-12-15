// src/hooks/useVoiceAssistant.js
// React hook for GPT-4o Realtime voice interactions

import { useState, useRef, useCallback, useEffect } from 'react';

const SAMPLE_RATE = 24000; // Required by OpenAI Realtime API
const CHANNELS = 1;

/**
 * Hook for voice assistant using GPT-4o Realtime API
 * 
 * @param {Object} options
 * @param {string} options.language - User's preferred language ('en' or 'nl')
 * @param {function} options.onTranscript - Called when transcript is received
 * @param {function} options.onFunctionCall - Called when a function is executed
 * @param {function} options.onError - Called on errors
 */
export function useVoiceAssistant({ 
  language = 'en',
  onTranscript,
  onFunctionCall,
  onError 
} = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const wsRef = useRef(null);
  const audioContextRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const processorRef = useRef(null);
  const audioQueueRef = useRef([]);
  const isPlayingRef = useRef(false);
  const currentSourceRef = useRef(null); // Track current audio source for interruption

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

  // Convert Float32 to Int16 PCM
  const floatTo16BitPCM = (float32Array) => {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return buffer;
  };

  // Convert Int16 PCM to Float32
  const int16ToFloat32 = (int16Array) => {
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / (int16Array[i] < 0 ? 0x8000 : 0x7fff);
    }
    return float32Array;
  };

  // Base64 encode ArrayBuffer
  const arrayBufferToBase64 = (buffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  // Base64 decode to ArrayBuffer
  const base64ToArrayBuffer = (base64) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  };

  // Play audio from queue
  const playAudioQueue = useCallback(async () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) return;
    
    isPlayingRef.current = true;
    setIsPlaying(true);
    
    const audioContext = await initAudioContext();
    
    while (audioQueueRef.current.length > 0 && isPlayingRef.current) {
      const audioData = audioQueueRef.current.shift();
      
      // Check if interrupted
      if (!isPlayingRef.current) break;
      
      try {
        // Decode base64 to PCM16
        const pcmBuffer = base64ToArrayBuffer(audioData);
        const int16Array = new Int16Array(pcmBuffer);
        const float32Array = int16ToFloat32(int16Array);
        
        // Create audio buffer
        const audioBuffer = audioContext.createBuffer(1, float32Array.length, SAMPLE_RATE);
        audioBuffer.copyToChannel(float32Array, 0);
        
        // Play
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        currentSourceRef.current = source; // Store for interruption
        
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
    setIsPlaying(false);
  }, [initAudioContext]);

  // Handle WebSocket messages
  const handleMessage = useCallback((event) => {
    try {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'ready':
          console.log('🎤 Voice assistant ready');
          break;
          
        case 'audio':
          // Queue audio for playback - receiving audio means processing is done
          setIsProcessing(false);
          audioQueueRef.current.push(data.data);
          playAudioQueue();
          break;
          
        case 'transcript':
          setIsProcessing(data.role === 'user');
          onTranscript?.(data.data, data.role);
          break;
        
        case 'response_done':
          // Response complete, clear processing state
          setIsProcessing(false);
          break;
        
        case 'interrupt':
          // User started speaking - stop any audio playback immediately
          console.log('🎤 Interrupt received - stopping audio');
          audioQueueRef.current = []; // Clear audio queue
          isPlayingRef.current = false;
          // Stop the currently playing audio source
          if (currentSourceRef.current) {
            try {
              currentSourceRef.current.stop();
            } catch (e) {
              // May already be stopped
            }
            currentSourceRef.current = null;
          }
          setIsPlaying(false);
          setIsProcessing(false);
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
  }, [playAudioQueue, onTranscript, onFunctionCall, onError]);

  // Connect to realtime WebSocket
  const connect = useCallback(() => {
    return new Promise((resolve, reject) => {
      // If already connected, just resolve
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        console.log('🎤 Already connected');
        resolve();
        return;
      }
      
      // Close any existing connection first (handles CONNECTING/CLOSING states)
      if (wsRef.current) {
        console.log('🎤 Closing existing connection before reconnecting');
        try {
          wsRef.current.close();
        } catch (e) {
          // Ignore
        }
        wsRef.current = null;
      }
      
      const token = localStorage.getItem('famlyai_token');
      if (!token) {
        onError?.('Not authenticated');
        reject(new Error('Not authenticated'));
        return;
      }
      
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsBase = import.meta?.env?.VITE_WS_BASE || `${protocol}//${host}`;
      
      console.log('🎤 Creating WebSocket connection...');
      const ws = new WebSocket(`${wsBase}/realtime?token=${encodeURIComponent(token)}&language=${language}`);
      
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('Connection timeout'));
      }, 10000); // 10 second timeout
      
      ws.onopen = () => {
        console.log('🎤 Connected to voice service');
        clearTimeout(timeout);
        setIsConnected(true);
        resolve();
      };
      
      ws.onmessage = handleMessage;
      
      ws.onerror = (e) => {
        console.error('WebSocket error:', e);
        clearTimeout(timeout);
        setIsProcessing(false);
        onError?.('Connection error');
        reject(new Error('Connection error'));
      };
      
      ws.onclose = () => {
        console.log('🎤 Disconnected from voice service');
        clearTimeout(timeout);
        setIsConnected(false);
        setIsListening(false);
        setIsProcessing(false);
        setIsPlaying(false);
      };
      
      wsRef.current = ws;
    });
  }, [language, handleMessage, onError]);

  // Disconnect
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    stopListening();
    setIsConnected(false);
    setIsProcessing(false);
    setIsPlaying(false);
  }, []);

  // Start listening (microphone)
  const startListening = useCallback(async () => {
    console.log('🎤 startListening called', { 
      wsRef: !!wsRef.current,
      wsState: wsRef.current?.readyState,
      WebSocket_OPEN: WebSocket.OPEN 
    });
    
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.log('🎤 WebSocket not ready, cannot start listening');
      onError?.('Not connected to voice service');
      return;
    }
    
    try {
      console.log('🎤 Requesting microphone access...');
      const audioContext = await initAudioContext();
      
      // Get microphone stream
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: CHANNELS,
          sampleRate: SAMPLE_RATE,
          echoCancellation: true,
          noiseSuppression: true,
        }
      });
      
      console.log('🎤 Microphone access granted');
      mediaStreamRef.current = stream;
      
      // Create audio processing pipeline
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      
      processor.onaudioprocess = (e) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        
        const inputData = e.inputBuffer.getChannelData(0);
        const pcmData = floatTo16BitPCM(inputData);
        const base64 = arrayBufferToBase64(pcmData);
        
        // Send audio to server
        wsRef.current.send(JSON.stringify({
          type: 'audio',
          data: base64
        }));
      };
      
      source.connect(processor);
      processor.connect(audioContext.destination);
      processorRef.current = { source, processor };
      
      setIsListening(true);
      console.log('🎤 Started listening');
      
    } catch (e) {
      console.error('Microphone error:', e);
      onError?.('Could not access microphone');
    }
  }, [connect, initAudioContext, onError]);

  // Stop listening
  const stopListening = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.source.disconnect();
      processorRef.current.processor.disconnect();
      processorRef.current = null;
    }
    
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    
    // Commit audio buffer to trigger processing
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'commit' }));
    }
    
    setIsListening(false);
    setIsProcessing(true);
    console.log('🎤 Stopped listening');
  }, []);

  // Send text message (alternative to voice)
  const sendText = useCallback((text) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      onError?.('Not connected');
      return;
    }
    
    wsRef.current.send(JSON.stringify({
      type: 'text',
      data: text
    }));
    
    setIsProcessing(true);
  }, [onError]);

  // Cancel the current response (user interruption)
  const cancelResponse = useCallback(() => {
    // Stop audio playback
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
    setIsPlaying(false);
    setIsProcessing(false);
    
    // Tell server to cancel
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'cancel' }));
    }
    
    console.log('🎤 Response cancelled by user');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [disconnect]);

  return {
    // State
    isConnected,
    isListening,
    isProcessing,
    isPlaying,
    
    // Actions
    connect,
    disconnect,
    startListening,
    stopListening,
    sendText,
    cancelResponse,
  };
}

export default useVoiceAssistant;
