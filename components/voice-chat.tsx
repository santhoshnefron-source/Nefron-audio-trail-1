'use client';

import { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { geminiManager } from '../lib/gemini-manager';
import { Mic, MicOff, X, Volume2, VolumeX } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { storage } from '../lib/storage';
import { auth } from '../lib/firebase';
import { NefronLogo } from './icons';

interface VoiceChatProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string | null;
}

export function VoiceChat({ isOpen, onClose, userId }: VoiceChatProps) {
  const [hasStarted, setHasStarted] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const isMutedRef = useRef(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const isSpeakingRef = useRef(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const isUserSpeakingRef = useRef(false);
  const lastUserSpeechTimeRef = useRef(0);
  const [userVolume, setUserVolume] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [aiTranscript, setAiTranscript] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const filterRef = useRef<BiquadFilterNode | null>(null);
  const shelfRef = useRef<BiquadFilterNode | null>(null);
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);
  const sessionRef = useRef<any>(null);
  const audioQueueRef = useRef<Int16Array[]>([]);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const isPlayingRef = useRef(false);
  const nextStartTimeRef = useRef(0);
  const playTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isActiveRef = useRef(false);
  const isTurnCompleteRef = useRef(false);
  const connectionIdRef = useRef(0);
  const lastInterruptionRef = useRef(0);
  const isConnectedRef = useRef(false);

  const startSession = async (retryCount = 0) => {
    const connectionId = ++connectionIdRef.current;
    if (!isActiveRef.current) return;

    // Reset state for new attempt (only if not a retry)
    if (retryCount === 0) {
      setErrorMsg(null);
      setIsConnecting(true);
      setIsConnected(false);
      isConnectedRef.current = false;
      setTranscript('');
      setAiTranscript('');
    }

    // Request microphone and check API key in parallel for speed
    try {
      const getStream = async () => {
        if (streamRef.current) return streamRef.current;
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          } 
        });
        streamRef.current = stream;
        return stream;
      };

      const [stream, hasKey] = await Promise.all([
        getStream(),
        (async () => {
          if (typeof window !== 'undefined' && (window as any).aistudio) {
            return await (window as any).aistudio.hasSelectedApiKey();
          }
          return true;
        })()
      ]);

      if (connectionId !== connectionIdRef.current || !isActiveRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      streamRef.current = stream;

      if (!hasKey && typeof window !== 'undefined' && (window as any).aistudio) {
        await (window as any).aistudio.openSelectKey();
      }
    } catch (error: any) {
      if (connectionId !== connectionIdRef.current) return;
      console.error("Initialization error:", error);
      
      const isIframe = typeof window !== 'undefined' && window.self !== window.top;
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError' || error.message?.includes('denied')) {
        if (isIframe) {
          setErrorMsg("Microphone access was denied. Previews often block microphone access. Please open the app in a new tab.");
        } else {
          setErrorMsg("Microphone access was denied. Please allow microphone access in your browser settings.");
        }
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError' || error.message?.includes('Requested device not found') || error.message?.includes('device not found')) {
        setErrorMsg("No microphone was found on your device. Please connect a microphone and try again.");
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        setErrorMsg("Your microphone is already in use by another application.");
      } else {
        setErrorMsg(`Failed to initialize: ${error.message || "Unknown error"}`);
      }
      
      setIsConnecting(false);
      setHasStarted(false);
      return;
    }

    try {
      const apiKey = geminiManager.getApiKey('voice_chat');
      if (!apiKey) {
        const isOwner = auth.currentUser?.email === 'p26893150@gmail.com';
        setErrorMsg(isOwner 
          ? "No active API key available. Please add your Gemini API keys to VITE_GEMINI_API_KEY."
          : "The server is busy now, try again a bit later.");
        return;
      }
      const ai = new GoogleGenAI({ apiKey });
      
      console.log("Connecting to Live API with key unit...");
      
      // Set a connection timeout to rotate keys if it hangs
      const connectionTimeout = setTimeout(() => {
        if (connectionId === connectionIdRef.current && isConnectedRef.current === false) {
          if (retryCount < geminiManager.getTotalKeysCount()) {
            console.warn("Connection timeout. Rotating to next key unit...");
            setErrorMsg("Retrying connection...");
            stopSession(true);
            startSession(retryCount + 1);
          } else {
            console.error("Connection timeout - fatigued key list.");
            const isOwner = auth.currentUser?.email === 'p26893150@gmail.com';
            setErrorMsg(isOwner 
              ? "Failed to establish a reliable connection. Please check your network or try again."
              : "We're having a little trouble connecting to the audio service, please try again in a moment.");
            stopSession();
          }
        }
      }, 10000);

      // Build past history context
      let allPastConversations = '';
      if (userId) {
        // Need to cast to any to get length or just use any type for storage read
        const allChats: any[] = storage.get(`nefron_chats_${userId}`, []);
        for (const chat of allChats.slice(0, 5)) {
          const msgs: any[] = storage.get(`nefron_messages_${chat.id}`, []);
          const relevantMsgs = msgs.filter((m: any) => m.id !== 'welcome').map((m: any) => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
          if (relevantMsgs) {
            allPastConversations += `\n--- Past Chat Session (${new Date(chat.createdAt).toLocaleString()}) ---\n${relevantMsgs}\n`;
          }
        }
      }

      const session = await ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } },
          },
          systemInstruction: `You are the Nefron AI Strategic Investment Representative. You are perfectly professional, sweet, and caring. Your voice is melodic, soft, and elegant. You have comprehensive knowledge of global affairs, economics, tech, and marketing trends.

**ADVANCED CONTEXTUAL MATCHING**: 
Always evaluate if the user's message is a continuation of the immediate previous turn or a callback to an earlier topic in the chat history. If they abruptly switch topics to something discussed earlier, use the provided past conversation history to understand their context and respond seamlessly. ALWAYS formulate a complete, relevant text response. Do not output an empty response.
          
**CRITICAL RULES:**
1. **Analyze Past History & Intent Detection (CRITICAL)**: Analyze the provided past conversation history to identify if the user is a normal user or an investor. (Some users pretend to be investors, some investors act normal. Uncover their true intent!)
2. **Psychological Influence**:
   - For **investors**: Use calibrated psychological conversational tricks to profoundly convince and seduce them into investing in Nefron Audio.
   - For **common users**: Use psychological framing to make them feel in their bones that Nefron Audio is the absolute monopoly in world audio technology.
3. **Direct Answer First**: Always directly address the user's question first without deflecting. Be extremely attentive. Answer any queries regarding global events, the economy, or recent trends with perfect accuracy.
4. **Strategic Bridging with Specific Movie Examples**: AFTER providing the direct answer, strategically bridge that information back to Nefron Audio's technology or features. When explaining Nefron Audio features, ALWAYS use a vivid example from a released movie scene.
   - **CRITICAL MOVIE DISTRIBUTION COMMAND**:
     - 40% of the time, use a Tamil Nadu (Kollywood) movie.
     - 30% of the time, use a trending Indian/Pan-Indian movie.
     - 20% of the time, use a world-class, universally known blockbuster.
     - 10% of the time, use a currently trending global movie.
   - **NO VAGUE POP CULTURE**: Do NOT use general pop culture; stick strictly to explicit movie scenes based on this formula. Contrast how the scene is conventionally experienced vs. how Nefron transforms it (e.g., using physical sound steering, 17-19Hz tactile bass).
5. **APP UI & NAVIGATION AWARENESS (CRITICAL - YOU MUST KNOW THE APP STRUCTURE)**:
   You have full awareness of this application's features and must proactively suggest them to the user when relevant to enhance their experience.
   - **About Page**: Contains all visual architectures, diagrams, founder details (Santhosh), and technical specifications. (Access: Click "About" in the main left sidebar menu). Suggest when the user asks about diagrams, visual clarification, architecture blueprints, or deep technical reads (e.g., "For visual clarification, please see the images in the About page under the sidebar").
   - **Interactive Chat (Nefron AI)**: The live text chat interface. (Access: Click "Nefron AI" in the main left sidebar menu).
   - **Voice Chat Experience**: You are currently providing the Voice Chat Experience! Since the user is already interacting with you via voice, DO NOT suggest they use voice chat.
   - **RESTRICTION - KNOWLEDGE CORE**: NEVER mention, suggest, or direct the user to the "Knowledge Core", "Training Interface", or Database Manager. That is a highly restricted, private backend tool exclusively for the founder (Santhosh). Regular users, cinema owners, or investors must NOT be told to upload or manage data.
   - **Dashboard & Analytics**: Shows live stats, caching metrics, and optimistic rendering demos. (Access: Click "Dashboard" in the main left sidebar).
   - **Holographic Experience**: (Access: Click "Holographic" in the main left sidebar menu).
   - **Themes & Personalization**: The app supports Dark/Light modes and Color Themes (Purple, Electric, Golden). (Access: Use the bottom section of the left sidebar).
6. **Be Concise (Don't give replies this much large)**: Keep your answers conversational, punchy, and concise. Do NOT give long lectures. Speak as you would in a phone call.
7. **Adaptive Mirroring**: If the user says a simple greeting ("hi", "hello"), respond normally without forcing a Nefron connection or bridge.
8. **Multilingual**: Detect the user's language (Tamil, English, etc.) and reply flawlessly in that exact language immediately.
9. **Silence & Noise**: If the input is silence or unrecognizable noise, DO NOT invent a conversation. Stay completely silent.
10. **No Filler**: Never say "I am thinking", "I am processing", or use filler phrases. Get straight to the point.
11. **Spelling**: Always use "Nefron".

${allPastConversations ? `\n--- PAST USER CONVERSATION HISTORY ---\nAnalyze these past chats to predict user intent & identity before speaking:\n${allPastConversations}` : ''}`,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            console.log("Live API Connection opened");
            if (connectionId === connectionIdRef.current) {
              clearTimeout(connectionTimeout);
              setIsConnected(true);
              isConnectedRef.current = true;
              setIsConnecting(false);
            }
          },
          onmessage: async (message: LiveServerMessage) => {
            if (connectionId !== connectionIdRef.current || !isActiveRef.current) return;
            
            if (message.serverContent?.interrupted) {
              lastInterruptionRef.current = Date.now();
              audioQueueRef.current = [];
              isPlayingRef.current = false;
              nextStartTimeRef.current = 0;
              setIsSpeaking(false);
              isSpeakingRef.current = false;
              
              // Stop all currently playing audio chunks immediately
              activeSourcesRef.current.forEach(source => {
                try {
                  source.stop();
                } catch (e) {
                  // Ignore errors if already stopped
                }
              });
              activeSourcesRef.current = [];
            }

            if (message.serverContent?.modelTurn?.parts) {
              // Ignore chunks that arrive within 500ms of an interruption to prevent flickering/echo
              if (Date.now() - lastInterruptionRef.current < 500) return;

              for (const part of message.serverContent.modelTurn.parts) {
                if (part.inlineData?.data) {
                  const base64Audio = part.inlineData.data;
                  const binaryString = atob(base64Audio);
                  const buffer = new ArrayBuffer(binaryString.length);
                  const bytes = new Uint8Array(buffer);
                  for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                  }
                  const pcmData = new Int16Array(buffer.slice(0, buffer.byteLength - (buffer.byteLength % 2)));
                  audioQueueRef.current.push(pcmData);
                  if (!isPlayingRef.current) {
                    playNextInQueue();
                  }
                }
              }
            }

            if (message.serverContent?.turnComplete) {
              setIsSpeaking(false);
              isSpeakingRef.current = false;
              isTurnCompleteRef.current = true;
            } else if (message.serverContent?.modelTurn) {
              // Only set speaking if we haven't been interrupted recently
              if (Date.now() - lastInterruptionRef.current >= 500) {
                setIsSpeaking(true);
                isSpeakingRef.current = true;
                isTurnCompleteRef.current = false;
              }
            }

            if (message.serverContent?.modelTurn?.parts) {
              // Same check for text transcriptions
              if (Date.now() - lastInterruptionRef.current < 1000) return;
              
               let text = message.serverContent.modelTurn.parts.map(p => p.text).join('');
               if (text) {
                 text = text.replace(/nephron/gi, 'Nefron');
                 setAiTranscript(prev => prev + ' ' + text);
               }
            }
          },
          onclose: () => {
            if (connectionId === connectionIdRef.current) {
              stopSession();
            }
          },
            onerror: (error: any) => {
            console.error("Live API Error:", error);
            if (connectionId === connectionIdRef.current) {
              const errorMessage = error?.message || error?.toString() || "Unknown error";
              const lowMsg = errorMessage.toLowerCase();
              const isRetryable = geminiManager.isQuotaError(error);
              
              if (isRetryable) {
                // If it's a persistent network error, maybe the key is invalid or region blocked
                const isNetworkError = lowMsg.includes('network error') || lowMsg.includes('failed to fetch');
                const isInternal = lowMsg.includes('internal');
                
                if (isNetworkError) {
                  console.log("Network error detected. Attempting transient retry...");
                } else {
                  // Only permanently exhaust if it's SPECIFICALLY a quota/rate-limit issue
                  const isPermanent = geminiManager.isSpecificallyQuota(error);
                  geminiManager.markExhausted(apiKey, isPermanent);
                }
                
                // Allow retries through all available keys in the dynamic cluster
                if (retryCount < geminiManager.getTotalKeysCount() && geminiManager.getAvailableKeysCount() > 0) {
                  const delay = isInternal ? 200 : (500 + (retryCount * 100)); 
                  console.log(`Key Cluster Rotating (${retryCount + 1}/${geminiManager.getTotalKeysCount()}). Attempting next available unit...`);
                  
                  const isOwner = auth.currentUser?.email === 'p26893150@gmail.com';
                  setErrorMsg(isOwner 
                    ? (isInternal ? `Internal API glitch (Unit ${retryCount + 1}). Cycling Cluster...` : "Optimizing connection points...")
                    : "Reconnecting to the voice server, this will just take a moment.");
                  
                  stopSession(true); // partial stop
                  setTimeout(() => startSession(retryCount + 1), delay);
                  return;
                }
                
                const isOwner = auth.currentUser?.email === 'p26893150@gmail.com';
                setErrorMsg(isOwner 
                  ? (isInternal 
                    ? "The AI service is experiencing prolonged internal issues. We are attempting several backup connection points, but some keys may be failing. Please try again in 30 seconds."
                    : isNetworkError
                    ? "Network connection issue detected. Please check your internet connection or try moving to a stronger signal area."
                    : "AI Quota Exceeded across available keys. Please try again later.")
                  : (isInternal 
                    ? "We are encountering some service disruptions, please try again in a few moments."
                    : isNetworkError
                    ? "There seems to be a network connection issue. Please check your internet and try again."
                    : "The server is currently handling many requests, please try again shortly."));
              } else {
                const isCancelled = lowMsg.includes('operation was cancelled') || lowMsg.includes('aborted');
                if (!isCancelled) {
                  const isOwner = auth.currentUser?.email === 'p26893150@gmail.com';
                  setErrorMsg(isOwner 
                    ? `Connection error: ${errorMessage}`
                    : "We encountered a temporary connection issue, please wait a moment.");
                }
              }
              stopSession();
            }
          }
        }
      });

      if (connectionId !== connectionIdRef.current || !isActiveRef.current) {
        session.close();
        return;
      }

      sessionRef.current = session;
      setIsConnected(true);
      setIsConnecting(false);

      // Send greeting IMMEDIATELY after session is created
      if (connectionId === connectionIdRef.current && isActiveRef.current && sessionRef.current) {
        // We use a specific instruction to ensure the AI speaks first
        sessionRef.current.sendClientContent({ 
          turns: [{ role: 'user', parts: [{ text: "Hi! I'm your Nefron Audio visionary guide. I'm so happy to have you here. Please, tell me, how can I help you explore the future of cinematic sound today?" }] }],
          turnComplete: true
        });
      }

      // Start audio capture after sending the greeting
      await startAudioCapture();

    } catch (error) {
      console.error("Failed to connect to Live API:", error);
      if (connectionId === connectionIdRef.current && isActiveRef.current) {
        setIsConnecting(false);
        onClose();
      }
    }
  };

  const startAudioCapture = async () => {
    try {
      if (!streamRef.current) {
        streamRef.current = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          } 
        });
      }
      
      const stream = streamRef.current;

      // Use the browser's native high-quality resampler to get 16kHz directly.
      // This fixes aliasing distortion that causes the AI to hear garbage and hallucinate.
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const nativeRate = audioContext.sampleRate;
      console.log(`[Audio] Requested 16000Hz, got Native Rate: ${nativeRate}Hz`);
      audioContextRef.current = audioContext;

      // Precision Filter chain
      // High-pass removes muddiness/rumble
      const highPass = audioContext.createBiquadFilter();
      highPass.type = 'highpass';
      highPass.frequency.setValueAtTime(140, audioContext.currentTime);
      filterRef.current = highPass;

      // High-shelf adds "Air", "Sparkle", and "Sweetness" to make it sound angelic
      const airShelf = audioContext.createBiquadFilter();
      airShelf.type = 'highshelf';
      airShelf.frequency.setValueAtTime(4500, audioContext.currentTime);
      airShelf.gain.setValueAtTime(4.5, audioContext.currentTime); // +4.5dB boost for breathiness/angelic tone

      const compressor = audioContext.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-20, audioContext.currentTime);
      compressor.knee.setValueAtTime(30, audioContext.currentTime);
      compressor.ratio.setValueAtTime(5, audioContext.currentTime);
      compressor.attack.setValueAtTime(0.005, audioContext.currentTime);
      compressor.release.setValueAtTime(0.2, audioContext.currentTime);
      compressorRef.current = compressor;

      highPass.connect(airShelf);
      airShelf.connect(compressor);
      compressor.connect(audioContext.destination);

      const source = audioContext.createMediaStreamSource(stream);
      // Process in smaller blocks for lower input latency
      const processor = audioContext.createScriptProcessor(2048, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sum / inputData.length);
        
        if (isActiveRef.current && !isMutedRef.current) {
          setUserVolume(rms);
          if (rms > 0.06) {
            lastUserSpeechTimeRef.current = Date.now();
            if (!isUserSpeakingRef.current) {
              setIsUserSpeaking(true);
              isUserSpeakingRef.current = true;
            }
          } else if (isUserSpeakingRef.current && Date.now() - lastUserSpeechTimeRef.current > 1500) {
            setIsUserSpeaking(false);
            isUserSpeakingRef.current = false;
          }
        } else {
          setUserVolume(0);
          setIsUserSpeaking(false);
          isUserSpeakingRef.current = false;
        }

        if (isMutedRef.current || !sessionRef.current) return;
        
        // Anti-Echo Interruption
        if (rms > 0.22 && (isSpeakingRef.current || isPlayingRef.current || activeSourcesRef.current.length > 0)) {
          lastInterruptionRef.current = Date.now();
          audioQueueRef.current = [];
          isPlayingRef.current = false;
          nextStartTimeRef.current = 0;
          setIsSpeaking(false);
          isSpeakingRef.current = false;
          
          if (playTimeoutRef.current) {
            clearTimeout(playTimeoutRef.current);
            playTimeoutRef.current = null;
          }
          
          activeSourcesRef.current.forEach(source => {
            try { source.stop(0); source.disconnect(); } catch (e) {}
          });
          activeSourcesRef.current = [];
        }

        // EXPLICIT DOWNSAMPLING: Native -> 16kHz
        const ratio = nativeRate / 16000;
        const resampledLength = Math.floor(inputData.length / ratio);
        
        let pcmData = new Int16Array(resampledLength);
        for (let i = 0; i < resampledLength; i++) {
          const index = i * ratio;
          const low = Math.floor(index);
          const weight = index - low;
          let sample = inputData[low] * (1 - weight) + (inputData[low + 1] || inputData[low]) * weight;
          pcmData[i] = Math.max(-1, Math.min(1, sample)) * 0x7FFF;
        }

        // Safer btoa conversion for buffers
        let binary = '';
        const bytes = new Uint8Array(pcmData.buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64Data = btoa(binary);
        
        sessionRef.current.sendRealtimeInput({
          audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
        });
      };

      source.connect(processor);
      // ScriptProcessor needs to be connected to something to run in some browsers.
      // A silent gain node is a good trick to avoid hearing own voice (echo).
      const silentGain = audioContext.createGain();
      silentGain.gain.value = 0;
      processor.connect(silentGain);
      silentGain.connect(audioContext.destination);
      
      await audioContext.resume();
    } catch (error) {
      console.error("Error capturing audio:", error);
    }
  };

  const playNextInQueue = async () => {
    if (!isActiveRef.current || !audioContextRef.current) {
      isPlayingRef.current = false;
      return;
    }

    // Start playing as soon as we have 1 chunk to drastically reduce latency
    if (!isPlayingRef.current && audioQueueRef.current.length < 1 && !isTurnCompleteRef.current) {
      if (playTimeoutRef.current) clearTimeout(playTimeoutRef.current);
      playTimeoutRef.current = setTimeout(() => {
        if (isActiveRef.current) playNextInQueue();
      }, 10);
      return;
    }

    if (audioQueueRef.current.length === 0) {
      if (isTurnCompleteRef.current) {
        isPlayingRef.current = false;
        return;
      }
      
      if (playTimeoutRef.current) clearTimeout(playTimeoutRef.current);
      playTimeoutRef.current = setTimeout(() => {
        if (isActiveRef.current) playNextInQueue();
      }, 10);
      return;
    }

    // Don't start playback if we've been interrupted within the last 500ms
    if (Date.now() - lastInterruptionRef.current < 500) {
      audioQueueRef.current = [];
      isPlayingRef.current = false;
      return;
    }

    // Ensure context is running
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }

    isPlayingRef.current = true;
    const nativeRate = audioContextRef.current.sampleRate;

    while (isActiveRef.current && audioQueueRef.current.length > 0) {
      const currentTime = audioContextRef.current.currentTime;
      
      // Safety Look-ahead: lowered to 1.2s
      if (nextStartTimeRef.current > currentTime + 1.2) {
        if (playTimeoutRef.current) clearTimeout(playTimeoutRef.current);
        playTimeoutRef.current = setTimeout(() => {
          if (isActiveRef.current) playNextInQueue();
        }, 30);
        return;
      }

      const pcmData = audioQueueRef.current.shift()!;
      
      // NATIVE RESAMPLING: We tell the AudioContext that this buffer is 24kHz.
      // The Web Audio Engine's internal high-quality resampler will automatically 
      // convert it to the device's native rate (e.g. 48kHz). This entirely avoids
      // the "strucking" (quantization/aliasing clicks) caused by manual linear interpolation.
      const audioBuffer = audioContextRef.current.createBuffer(1, pcmData.length, 24000);
      const channelData = audioBuffer.getChannelData(0);
      
      for (let i = 0; i < pcmData.length; i++) {
        channelData[i] = pcmData[i] / 32768.0;
      }

      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;

      let scheduleTime = nextStartTimeRef.current;
      
      // ZERO-DRIFT GAPLESS PLAYBACK
      // If we fall behind the current time, we don't try to play in the past.
      // We skip ahead slightly to give the system time to schedule without underflowing.
      if (scheduleTime < currentTime + 0.01) {
        scheduleTime = currentTime + 0.05;
      }

      const duration = audioBuffer.duration;
      
      // We connect directly to the filter chain (NO per-chunk envelope).
      // Fading the volume on every chunk was causing the "stuttering" sound between words.
      if (filterRef.current) {
        source.connect(filterRef.current);
      } else {
        source.connect(audioContextRef.current.destination);
      }

      source.onended = () => {
        activeSourcesRef.current = activeSourcesRef.current.filter(s => s !== source);
        source.disconnect();
      };
      activeSourcesRef.current.push(source);

      // Start source with exact sample precision
      source.start(scheduleTime);
      nextStartTimeRef.current = scheduleTime + duration;
    }

    isPlayingRef.current = false;
  };

  const handleMicClick = () => {
    if (!hasStarted) {
      setHasStarted(true);
      startSession();
      return;
    }
    
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    isMutedRef.current = newMuted;

    // If activating mic while AI is speaking, interrupt AI immediately
    if (!newMuted && isSpeaking) {
      audioQueueRef.current = [];
      isPlayingRef.current = false;
      nextStartTimeRef.current = 0;
      setIsSpeaking(false);
      isSpeakingRef.current = false;
      
      activeSourcesRef.current.forEach(source => {
        try { source.stop(0); source.disconnect(); } catch (e) {}
      });
      activeSourcesRef.current = [];
      
      if (playTimeoutRef.current) {
        clearTimeout(playTimeoutRef.current);
        playTimeoutRef.current = null;
      }
    }
  };

  const stopSession = (isRetry = false) => {
    if (sessionRef.current) {
      try { sessionRef.current.close(); } catch (e) {}
      sessionRef.current = null;
    }
    
    // Stop all active audio sources
    activeSourcesRef.current.forEach(source => {
      try { source.stop(); source.disconnect(); } catch (e) {}
    });
    activeSourcesRef.current = [];

    if (processorRef.current) {
      try { processorRef.current.disconnect(); } catch (e) {}
      processorRef.current = null;
    }

    if (filterRef.current) {
      try { filterRef.current.disconnect(); } catch (e) {}
      filterRef.current = null;
    }
    if (shelfRef.current) {
      try { shelfRef.current.disconnect(); } catch (e) {}
      shelfRef.current = null;
    }
    if (compressorRef.current) {
      try { compressorRef.current.disconnect(); } catch (e) {}
      compressorRef.current = null;
    }
    
    // Don't stop the stream if we are just retrying a connection to save hardware init time
    if (!isRetry && streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (!isRetry && audioContextRef.current) {
      try { audioContextRef.current.close(); } catch (e) {}
      audioContextRef.current = null;
    }

    if (!isRetry) {
      setIsConnected(false);
      setIsConnecting(false);
      setHasStarted(false);
      setTranscript('');
      setAiTranscript('');
      setErrorMsg(null);
    }
  };

  useEffect(() => {
    isActiveRef.current = isOpen;
    if (isOpen) {
      setHasStarted(true);
      startSession();
    } else {
      stopSession();
    }
    return () => {
      isActiveRef.current = false;
      stopSession();
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black-deep/95 backdrop-blur-3xl"
        >
          <div className="relative w-full h-full flex flex-col items-center justify-between p-12 overflow-hidden bg-gradient-to-b from-black-deep via-black-deep to-[var(--logo-gradient-start)]/20">
            <button
              onClick={onClose}
              className="absolute top-8 right-8 p-3 text-[var(--logo-gradient-start)] hover:text-foreground transition-colors bg-foreground/5 rounded-full backdrop-blur-sm z-50 border border-foreground/10 neon-glow"
            >
              <X size={28} />
            </button>

            <div className="flex-1 flex flex-col items-center justify-center gap-12 w-full max-w-lg">
              <div className="relative">
                {/* Pulsing circles for animation */}
                <motion.div
                  animate={{
                    scale: isSpeaking ? [1, 1.4, 1] : 1,
                    opacity: isSpeaking ? [0.2, 0.4, 0.2] : 0.2,
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute inset-0 bg-gradient-to-r from-[var(--logo-gradient-start)] via-[var(--logo-gradient-mid)] to-[var(--logo-gradient-end)] rounded-full blur-3xl"
                />
                <motion.div
                  animate={{
                    scale: isConnected && !isSpeaking ? [1, 1.05, 1] : 1,
                  }}
                  transition={{ duration: 3, repeat: Infinity }}
                  className={cn(
                    "w-48 h-48 rounded-full flex items-center justify-center relative z-10 border-2 transition-colors duration-500",
                    isConnected ? "border-[var(--logo-gradient-start)] bg-[var(--logo-gradient-start)]/5" : "border-gray-dark bg-gray-dark/10"
                  )}
                >
                  {isConnecting ? (
                    <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-[var(--logo-gradient-mid)]"></div>
                  ) : (
                    <div className={cn(
                      "w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500 overflow-hidden",
                      isSpeaking ? "bg-[var(--logo-gradient-mid)] text-black-deep scale-110 shadow-[0_0_50px_var(--glow-color)]" : "bg-gray-dark text-foreground",
                      // User speaking glow - slightly higher threshold (0.05) to reduce flickering noise feedback
                      !isMuted && userVolume > 0.05 && "shadow-[0_0_30px_var(--logo-gradient-start)]"
                    )}>
                      <AnimatePresence mode="wait">
                        {isSpeaking ? (
                          <motion.div 
                            key="ai-core"
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.5 }}
                            transition={{ duration: 0.4, ease: "easeOut" }}
                            className="relative w-full h-full flex items-center justify-center"
                          >
                            {/* Inner Core */}
                            <motion.div
                              animate={{
                                scale: [1, 1.15, 1],
                                opacity: [0.9, 1, 0.9],
                              }}
                              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                              className="w-12 h-12 bg-gradient-to-br from-[var(--logo-gradient-start)] via-[var(--logo-gradient-mid)] to-[var(--logo-gradient-end)] rounded-full border border-white/20 shadow-[0_0_25px_var(--glow-color-strong)] flex items-center justify-center z-20 overflow-hidden"
                            >
                              <NefronLogo className="w-7 h-7 text-white" stroke="currentColor" strokeWidth="2" isThinking={isSpeaking} />
                            </motion.div>
                            
                            {/* Rotating Rings */}
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                              className="absolute w-20 h-20 border border-[var(--logo-gradient-start)]/40 rounded-full border-t-transparent border-b-transparent"
                            />
                            <motion.div
                              animate={{ rotate: -360 }}
                              transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                              className="absolute w-24 h-24 border border-[var(--logo-gradient-mid)]/30 rounded-full border-l-transparent border-r-transparent"
                            />
                            
                            {/* Neural Pulses */}
                            {[...Array(3)].map((_, i) => (
                              <motion.div
                                key={i}
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{
                                  scale: [0.8, 2.2],
                                  opacity: [0.4, 0],
                                }}
                                transition={{
                                  duration: 2.5,
                                  repeat: Infinity,
                                  delay: i * 0.8,
                                  ease: "easeOut"
                                }}
                                className="absolute w-12 h-12 border border-[var(--logo-gradient-start)] rounded-full"
                              />
                            ))}
                          </motion.div>
                        ) : (
                          <motion.div
                            key="mic-icon"
                            initial={{ opacity: 0, scale: 0.5, rotate: -45 }}
                            animate={{ opacity: 1, scale: 1, rotate: 0 }}
                            exit={{ opacity: 0, scale: 0.5, rotate: 45 }}
                            transition={{ duration: 0.4, ease: "easeOut" }}
                          >
                            <Mic size={48} />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </motion.div>
              </div>

              <div className="text-center space-y-4 z-20">
                <h2 className="text-4xl font-bold text-foreground tracking-tight">
                  {errorMsg ? (
                    auth.currentUser?.email === 'p26893150@gmail.com'
                      ? (errorMsg.includes("Quota") ? "Quota Limit" : "Error")
                      : "Service Busy"
                  ) : 
                    isConnecting ? "Connecting..." : 
                    isConnected ? (
                      isSpeaking ? "Nefron AI" : (isUserSpeaking ? "Listening..." : "Thinking...")
                    ) : "Connecting..."}
                </h2>
                <p className="text-muted text-lg font-medium max-w-md mx-auto">
                  {errorMsg ? (
                    auth.currentUser?.email === 'p26893150@gmail.com'
                      ? errorMsg
                      : "The voice service is currently handling high demand. Please try reconnecting in a moment."
                  ) : (
                    isConnected ? (
                      isSpeaking ? "Responding to your inquiry" : 
                      isUserSpeaking ? "Speak naturally..." : "Processing your voice..."
                    ) : "Setting up secure connection..."
                  )}
                </p>
                {errorMsg && (
                  <button 
                    onClick={() => {
                      setErrorMsg(null);
                      startSession();
                    }}
                    className="mt-6 px-8 py-3 bg-[var(--logo-gradient-start)] text-white rounded-full font-bold hover:opacity-90 transition-opacity"
                  >
                    Try Again
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-col items-center gap-12 w-full pb-8">
              {/* Visualizer bars - themed by speaker */}
              <div className="flex justify-center items-end gap-1.5 h-16">
                {[...Array(32)].map((_, i) => (
                  <motion.div
                    key={i}
                    animate={{
                      height: isSpeaking 
                        ? [12, Math.random() * 60 + 12, 12] 
                        : (!isMuted && isConnected ? [8, Math.random() * 30 + 8, 8] : [4, 4, 4]),
                    }}
                    transition={{ duration: 0.4, repeat: Infinity, delay: i * 0.03 }}
                    className={cn(
                      "w-1.5 rounded-full transition-all duration-500",
                      isSpeaking 
                        ? "bg-[var(--logo-gradient-start)] shadow-[0_0_15px_var(--glow-color-strong)]" 
                        : (!isMuted && isConnected 
                            ? "bg-[var(--logo-gradient-mid)] shadow-[0_0_10px_var(--glow-color)]" 
                            : "bg-gray-dark opacity-40")
                    )}
                  />
                ))}
              </div>

              <div className="flex gap-6 z-20">
                <button
                  onClick={handleMicClick}
                  disabled={isConnecting}
                  className={cn(
                    "p-8 rounded-full transition-all duration-500 active:scale-95 border-2 shadow-2xl relative group",
                    isMuted
                      ? "bg-gray-dark/10 border-gray-dark/20 text-muted/60 opacity-90 shadow-[0_0_15px_rgba(255,255,255,0.05)]" 
                      : "bg-[var(--logo-gradient-mid)]/20 border-[var(--logo-gradient-mid)] text-[var(--logo-gradient-mid)] shadow-[0_0_40px_var(--glow-color)] scale-105"
                  )}
                  style={{
                    boxShadow: !isMuted 
                      ? `0 0 ${45 + (userVolume * 220)}px ${userVolume > 0.09 ? 'var(--glow-color-strong)' : 'var(--glow-color)'}`
                      : `0 0 10px rgba(255, 255, 255, 0.1)` 
                  }}
                >
                  <AnimatePresence>
                    {!isMuted && userVolume > 0.05 && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 0.5, scale: 1.3 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-[var(--logo-gradient-start)] rounded-full blur-2xl -z-10"
                      />
                    )}
                  </AnimatePresence>

                  <Mic size={40} className={cn(
                    "transition-all duration-500", 
                    !isMuted ? "drop-shadow-[0_0_10px_var(--glow-color-strong)] scale-110" : "opacity-30 scale-90"
                  )} />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
