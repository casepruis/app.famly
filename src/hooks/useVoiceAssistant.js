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
    
    while (audioQueueRef.current.length > 0) {
      const audioData = audioQueueRef.current.shift();
      
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
        
        await new Promise((resolve) => {
          source.onended = resolve;
          source.start();
        });
      } catch (e) {
        console.error('Audio playback error:', e);
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
          // Queue audio for playback
          audioQueueRef.current.push(data.data);
          playAudioQueue();
          break;
          
        case 'transcript':
          setIsProcessing(data.role === 'user');
          onTranscript?.(data.data, data.role);
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
  const connect = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    
    const token = localStorage.getItem('famlyai_token');
    if (!token) {
      onError?.('Not authenticated');
      return;
    }
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsBase = import.meta?.env?.VITE_WS_BASE || `${protocol}//${host}`;
    
    const ws = new WebSocket(`${wsBase}/realtime?token=${encodeURIComponent(token)}&language=${language}`);
    
    ws.onopen = () => {
      console.log('🎤 Connected to voice service');
      setIsConnected(true);
    };
    
    ws.onmessage = handleMessage;
    
    ws.onerror = (e) => {
      console.error('WebSocket error:', e);
      onError?.('Connection error');
    };
    
    ws.onclose = () => {
      console.log('🎤 Disconnected from voice service');
      setIsConnected(false);
      setIsListening(false);
    };
    
    wsRef.current = ws;
  }, [language, handleMessage, onError]);

  // Disconnect
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    stopListening();
    setIsConnected(false);
  }, []);

  // Start listening (microphone)
  const startListening = useCallback(async () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      await connect();
      // Wait for connection
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    try {
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
  };
}

export default useVoiceAssistant;
