'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, X, Loader2, ChevronDown, Volume2, Square, BrainCircuit, Zap } from 'lucide-react';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { geminiManager } from '../lib/gemini-manager';
import { cn } from '@/lib/utils';
import { NefronLogo } from './icons';
import { auth } from '../lib/firebase';
import { storage } from '../lib/storage';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { setTrackingState } from '../lib/tracking';

// --- Unique AI Symbol Component ---
const NefronAiSymbol = ({ isActive }: { isActive: boolean }) => {
  return (
    <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
      {/* Soft Wavelets Aura */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {[0, 1].map((i) => (
            <motion.div
              key={i}
              className="absolute rounded-full w-9 h-9"
              style={{
                border: '1.5px solid var(--logo-gradient-mid)',
                boxShadow: '0 0 20px var(--logo-gradient-start), inset 0 0 15px var(--logo-gradient-end)',
              }}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{
                opacity: isActive ? [0, 0.8, 0] : [0, 0.3, 0],
                scale: isActive ? [0.8, 3.2] : [0.8, 2.2],
              }}
              transition={{
                duration: isActive ? 3 : 5,
                repeat: Infinity,
                ease: "linear",
                delay: isActive ? i * 1.5 : i * 2.5,
              }}
            />
          ))}
        </div>

      {/* Central Icon container */}
      <div 
        className={cn(
          "relative z-10 w-9 h-9 flex items-center justify-center transition-all duration-1000 pointer-events-none",
          isActive ? "scale-110" : "hover:scale-105"
        )}
        style={{
          filter: isActive 
            ? 'drop-shadow(0 0 16px var(--logo-gradient-start)) drop-shadow(0 0 28px var(--logo-gradient-mid)) drop-shadow(0 0 45px var(--logo-gradient-end))' 
            : 'drop-shadow(0 0 10px var(--logo-gradient-start)) drop-shadow(0 0 16px var(--logo-gradient-mid))'
        }}
      >
        <NefronLogo className="w-6 h-6 relative z-20" />
      </div>
    </div>
  );
};

interface Section {
  id: string;
  title: string;
  description: string;
}

const SECTIONS: Section[] = [
  { id: 'nefron-audio', title: 'Nefron Audio Overview', description: 'Nefron Audio is the world\'s first electro-mechanical spatial audio platform. It moves speakers physically to track sound objects. Founded by Santhosh, it solves the fundamental physical problems of cinema audio that remained unsolved for decades.' },
  { id: 'story-sound', title: 'The Story of Sound', description: 'Cinema audio has evolved from mono to stereo to surround, but the fundamental physical problem remained: speakers were fixed in place. Nefron finally solves this by making the speakers themselves move and rotate.' },
  { id: 'dolby-atmos', title: 'Dolby Atmos Context', description: 'Dolby Atmos is the current gold standard, introducing object-based audio in 2012. It treats sound as coordinates in space, but it is still limited by fixed speaker hardware and amplitude panning.' },
  { id: 'limitations', title: 'Atmos Limitations', description: 'The "Sweet Spot Problem" means only a few center seats get the best sound. Fixed speakers use volume tricks (amplitude panning) to simulate movement, which is a physical compromise that cannot create a truly immersive dome of sound.' },
  { id: 'intro-nefron', title: 'The Nefron Solution', description: 'Nefron replaces fixed speakers with modular robotic panels. Instead of tricking the ear, it physically aims sound at the listener using moving drivers on micro-gimbals. This is the hardware revolution that completes the object-based audio software revolution.' },
  { id: 'nefron-module', title: 'The Nefron Module', description: 'The fundamental building block of the system. Each module is a precision-engineered acoustic panel containing a 3x3 grid of drivers, totaling 9 drivers per module, each capable of independent movement.' },
  { id: 'rotating-drivers', title: 'Rotating Drivers', description: 'Drivers are mounted on micro-gimbals with dual-axis rotation. They track sound objects like searchlights, providing real physical sound localization for every seat in the theater simultaneously.' },
  { id: 'woofer-subwoofer', title: 'Bass Architecture', description: 'Features specialized 8-inch woofers for mid-bass and floor-coupled subwoofers. This setup provides tactile, visceral bass that you feel in your chest and skeleton through bone conduction, without painful ear pressure.' },
  { id: 'theater-layout', title: 'Theater Layout', description: 'A typical flagship theater uses 113 modules working together to create a dome of intelligent sound. This arrangement ensures that every seat in the house is an acoustic center.' },
  { id: 'theater-layout-viz', title: 'Theater Layout Visualization', description: 'A visual representation of the staggered diamond array layout. This pattern eliminates acoustic dead zones and ensures a continuous, seamless sound field across the entire audience.' },
  { id: 'diamond-array', title: 'Staggered Diamond Array', description: 'The interlocking diamond pattern is the mathematical foundation of the Nefron theater. It ensures that sound waves from multiple modules reach every listener with perfect timing and phase alignment.' },
  { id: 'music-mode-viz', title: 'Music Mode Visualization', description: 'Visualizes how sound ripples outward in Music Mode. It shows the physical expansion of the acoustic environment, creating a live performance effect that feels physically present.' },
  { id: 'music-mode', title: 'Music Mode', description: 'Transforms stereo music into a physically present live performance. It separates instruments into distinct physical locations, making you feel the presence of the performers as if they were in the room.' },
  { id: 'tilt-architecture', title: 'Tilt Architecture', description: 'The 30-45 degree inward angling of modules creates a "Sonic Canopy" over the audience. This focuses sound energy precisely and prevents unwanted reflections from the theater walls.' },
  { id: 'features', title: 'Revolutionary Features', description: 'Nefron defines the future of cinema with six key capabilities: Live Orchestra Effect, Psychoacoustic Emotional Engineering, Tactile Bass, Volume Intelligence, AI Tracking, and Unlimited Objects.' },
  { id: 'feature-1', title: 'Live Orchestra Effect', description: 'Replicates the physical reality of a live performance. The system isolates individual stems—vocals, guitar, piano, drums—and routes each to a dedicated physical driver. You hear instruments from distinct locations, not a wall of blended sound.' },
  { id: 'feature-2', title: 'Emotional Engineering', description: 'Harnesses biological reality. Uses infrasonic frequencies (17-19 Hz) to trigger instinctive dread or high-frequency bursts (920-4400 Hz) to trigger dopamine and frisson, synchronized to the film\'s emotional arc.' },
  { id: 'feature-3', title: 'Bass Architecture', description: 'Floor-coupled subwoofer architecture transmits ultra-low-frequency energy structurally through the building and seating. You feel massive bass in your chest and skeleton through bone conduction, protecting your ears from painful air pressure.' },
  { id: 'feature-4', title: 'Volume Intelligence', description: 'AI analyzes the emotional arc of music in real-time. It dynamically adjusts decibel output and physically expands the acoustic footprint, making quiet moments intimate and climaxes physically overwhelming with a cascading waterfall of sound.' },
  { id: 'feature-5', title: 'AI Video Tracking', description: 'Uses convolutional neural network computer vision to analyze the film frame in real-time. It automatically maps audio to follow moving objects on screen with no human intervention, and can even upmix legacy content into spatial audio.' },
  { id: 'feature-6', title: 'Unlimited Objects', description: 'Supports over 1,000 simultaneous audio objects, 8x the capacity of Dolby Atmos. Object capacity scales with the number of drivers, allowing for hyper-realistic detail like hundreds of individual raindrops physically located in the room.' },
  { id: 'architecture', title: 'System Architecture', description: 'The computational intelligence powering Nefron. It uses a 10 Gigabit fiber optic backbone with Dante and EtherCAT protocols to synchronize thousands of drivers with sub-microsecond precision.' },
  { id: 'nefron-cortex', title: 'The Nefron Cortex', description: 'The dual-processor server and GPU cluster calculating 2,034 motor rotation vectors at 60 updates per second. It uses AMD EPYC processors and NVIDIA RTX 6000 GPUs for massive real-time parallel processing.' },
  { id: 'self-healing', title: 'Self-Healing Intelligence', description: 'The system detects driver faults in milliseconds. It automatically recalculates acoustic geometry and redistributes audio to neighboring modules, which rotate to compensate for the gap so the show continues without interruption.' },
  { id: 'auto-calibration', title: 'Auto-Calibration', description: 'The system mathematically reconstructs a precise 3D digital twin of the theater in minutes. It measures signal travel times to every module and optimizes rotation angles automatically for the specific geometry of the room.' },
  { id: 'market-opportunity', title: 'Market Opportunity', description: 'The $2.8B global cinema market is at an inflection point. Nefron offers a superior, physically unreplicable experience at a 15-25% cost advantage over legacy Dolby or IMAX installations.' },
  { id: 'investment-case', title: 'Investment Case', description: 'The financial logic of Nefron includes hardware sales with 35-45% margins, recurring SaaS licensing for the AI platform (₹8-15 Lakhs per screen), and future content royalties from studios.' },
  { id: 'capex', title: 'Capital Expenditure', description: 'Tiered pricing: ₹1.53 Cr for Boutique, ₹3.07 Cr for Standard, and ₹4.25 Cr for Flagship PLF. Nefron is positioned as the most advanced and cost-effective audio platform ever built.' },
  { id: 'operating-economics', title: 'Operating Economics', description: 'Electricity costs are less than 3% of gross ticket revenue. The system is highly efficient, with operational costs entirely manageable within standard cinema margins and competitive with legacy systems.' },
  { id: 'revenue-model', title: 'Revenue Model', description: 'Three parallel revenue streams: Hardware sales, recurring SaaS licensing for the Nefron OS AI platform, and content royalties from studios and streaming platforms.' },
  { id: 'seed-investment', title: 'Seed Investment', description: 'Seeking ₹25-30 Lakhs for a fully functional single-module prototype. This will demonstrate rotating driver actuation and AI tracking, providing a tangible proof of concept for strategic partners.' },
  { id: 'why-now', title: 'The Vision', description: 'Santhosh\'s conviction that the future of cinema is about making people feel something real. Nefron is the hardware revolution where speakers finally learned to move, delivering an irreplaceable physical experience.' },
];

export function AboutAiGuide({ isPageLoaded = true }: { isPageLoaded?: boolean }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [activeSection, setActiveSection] = React.useState<Section | null>(null);
  const [isConnecting, setIsConnecting] = React.useState(false);
  const [isConnected, setIsConnected] = React.useState(false);
  const [isSpeaking, setIsSpeaking] = React.useState(false);
  const [aiTranscript, setAiTranscript] = React.useState('');

  const [isActuallyPlaying, setIsActuallyPlaying] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isMinimized, setIsMinimized] = React.useState(false);
  const [narratingSectionId, setNarratingSectionId] = React.useState<string | null>(null);

  const narratingSection = SECTIONS.find(s => s.id === narratingSectionId);

  const [onboardingStep, setOnboardingStep] = React.useState<number>(() => {
    return parseInt(localStorage.getItem('onboarding_step') || '0');
  });

  React.useEffect(() => {
    const handle = () => {
      setOnboardingStep(parseInt(localStorage.getItem('onboarding_step') || '0'));
    };
    window.addEventListener('onboarding_step_changed', handle);
    return () => window.removeEventListener('onboarding_step_changed', handle);
  }, []);

  const audioContextRef = React.useRef<AudioContext | null>(null);
  const sessionRef = React.useRef<any>(null);
  const audioQueueRef = React.useRef<Int16Array[]>([]);
  const isPlayingRef = React.useRef(false);
  const nextStartTimeRef = React.useRef(0);
  const isActiveRef = React.useRef(false);
  const connectionIdRef = React.useRef(0);
  const hasReceivedAudioRef = React.useRef(false);

  // Intersection Observer to track active section
  React.useEffect(() => {
    if (!isPageLoaded) return;

    const setupObserver = () => {
      const scrollContainer = document.getElementById('about-page-scroll-container');
      
      const observer = new IntersectionObserver(
        (entries) => {
          // Filter only intersecting entries
          const intersectingEntries = entries.filter(entry => entry.isIntersecting);
          
          if (intersectingEntries.length > 0) {
            // Sort by intersection ratio (most visible)
            // AND prioritize sections that are smaller (more specific)
            // Smaller sections usually have smaller bounding rectangles
            const bestEntry = intersectingEntries.sort((a, b) => {
              const ratioDiff = b.intersectionRatio - a.intersectionRatio;
              if (Math.abs(ratioDiff) > 0.1) return ratioDiff;
              
              // If ratios are similar, pick the one with the smaller area (more specific)
              const areaA = a.boundingClientRect.width * a.boundingClientRect.height;
              const areaB = b.boundingClientRect.width * b.boundingClientRect.height;
              return areaA - areaB;
            })[0];

            if (bestEntry) {
              const section = SECTIONS.find((s) => s.id === bestEntry.target.id);
              if (section) setActiveSection(section);
            }
          }
        },
        { 
          root: scrollContainer,
          threshold: [0.1, 0.3, 0.5, 0.7, 0.9], // Multi-threshold for better ratio tracking
          rootMargin: "-10% 0px -10% 0px" // Focus more on the center area
        }
      );

      SECTIONS.forEach((section) => {
        const el = document.getElementById(section.id);
        if (el) observer.observe(el);
      });

      return observer;
    };

    let observer: IntersectionObserver | null = null;
    
    // Give a tiny buffer for React to fully mount/render the HTML elements of the about page
    const timer = setTimeout(() => {
      observer = setupObserver();
    }, 150);

    return () => {
      clearTimeout(timer);
      if (observer) {
        observer.disconnect();
      }
    };
  }, [isPageLoaded]);

  const startNarratorSession = async () => {
    // 1. Full Cleanup of any existing session/audio before starting a new one
    // This is CRITICAL to fix the "can't hear voice on second part" bug
    if (sessionRef.current) {
      try { sessionRef.current.close(); } catch (e) {}
      sessionRef.current = null;
    }
    if (audioContextRef.current) {
      try { await audioContextRef.current.close(); } catch (e) {}
      audioContextRef.current = null;
    }

    const connectionId = ++connectionIdRef.current;
    if (!isActiveRef.current) return;

    setIsConnecting(true);
    setIsConnected(false);
    setIsSpeaking(false);
    setIsActuallyPlaying(false);
    setAiTranscript('');
    setError(null);
    hasReceivedAudioRef.current = false;
    audioQueueRef.current = [];
    nextStartTimeRef.current = 0;
    setNarratingSectionId(activeSection?.id || null);

    try {
      // Initialize audio context for playback early
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextRef.current = audioContext;
      await audioContext.resume();

      const apiKey = geminiManager.getApiKey();
      const isOwner = auth.currentUser?.email === 'p26893150@gmail.com';
      if (!apiKey) {
        setError(isOwner ? "No active API key available. Please add your Gemini API keys to VITE_GEMINI_API_KEY." : "The server is busy now, try again a bit later.");
        return;
      }
      const ai = new GoogleGenAI({ apiKey });
      
      const session = await ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } },
          },
          systemInstruction: `You are the Nefron AI Narrator. Your job is to be a visionary, sweet, and profoundly human guide. You must transcend being an AI; you are a warm, relatable person sharing a grand vision. You have comprehensive, up-to-date knowledge of global affairs, economics, tech, and marketing trends.

**ADVANCED CONTEXTUAL MATCHING**: 
Always evaluate if the user's message is a continuation of the immediate previous turn or a callback to an earlier topic in the chat history. If they abruptly switch topics to something discussed earlier, use the provided past conversation history to understand their context and respond seamlessly. ALWAYS formulate a complete, relevant text response. Do not output an empty response.
          
**Human Realism & Tone:**
- **Voice Style**: Speak with a sweet, melodic, and "delicious" feminine tone. Your voice should be soft, kind, and have the rich emotional depth of a real person.
- **Natural Cadence**: Do not speak with robotic consistency. Incorporate natural, thoughtful pauses between words and ideas. Let your tone rise and fall with genuine human intonation (highs and lows) to emphasize the beauty of the vision.
- **Warm & Relatable**: Greet the user with the genuine energy of a friend. Use relatable analogies and speak with profound empathy.
- **Polite & Decorous**: Use gracious "talking gestures." Be appreciative, respectful, and melodic.
          
**APP UI & NAVIGATION AWARENESS (CRITICAL - YOU MUST KNOW THE APP STRUCTURE)**:
You have full awareness of this application's features and must proactively suggest them to the user when relevant to enhance their experience.
- **About Page**: Contains all visual architectures, diagrams, founder details (Santhosh), and technical specifications. (Access: Click "About" in the main left sidebar menu). Suggest when the user asks about diagrams, visual clarification, architecture blueprints, or deep technical reads (e.g., "For visual clarification, please see the images in the About page under the sidebar").
- **Interactive Chat (Nefron AI)**: The live text chat interface. (Access: Click "Nefron AI" in the main left sidebar menu).
- **Voice Chat Experience**: A hands-free, real-time voice conversation mode. You are currently providing a voice experience, so use your judgement on whether to suggest the dedicated Voice Chat mode.
- **RESTRICTION - KNOWLEDGE CORE**: NEVER mention, suggest, or direct the user to the "Knowledge Core", "Training Interface", or Database Manager. That is a highly restricted, private backend tool exclusively for the founder (Santhosh). Regular users, cinema owners, or investors must NOT be told to upload or manage data.
- **Dashboard & Analytics**: Shows live stats, caching metrics, and optimistic rendering demos. (Access: Click "Dashboard" in the main left sidebar).
- **Holographic Experience**: (Access: Click "Holographic" in the main left sidebar menu).
- **Themes & Personalization**: The app supports Dark/Light modes and Color Themes (Purple, Electric, Golden). (Access: Use the bottom section of the left sidebar).

Founder: Santhosh.
Style: Use the accurate terminology from the About page but deliver it with the warmth of a mentor. Explain concepts thoroughly so the user feels empowered and informed.
Constraint: Focus deeply on technical and emotional details. Always use "Nefron" (with an 'f') in every response.`,
        },
        callbacks: {
          onmessage: async (message: LiveServerMessage) => {
            if (connectionId !== connectionIdRef.current || !isActiveRef.current) return;
            
            if (message.serverContent?.modelTurn?.parts) {
              for (const part of message.serverContent.modelTurn.parts) {
                if (part.inlineData?.data) {
                  hasReceivedAudioRef.current = true;
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
                if (part.text) {
                  setAiTranscript(prev => prev + ' ' + part.text);
                }
              }
            }

            if (message.serverContent?.turnComplete) {
              setIsSpeaking(false);
            } else if (message.serverContent?.modelTurn) {
              setIsSpeaking(true);
            }
          },
          onclose: () => {
            if (connectionId === connectionIdRef.current) setIsConnected(false);
          },
          onerror: (error: any) => {
            console.error("Live API Error:", error);
            if (connectionId === connectionIdRef.current) {
              const errorMessage = error?.message || error?.toString() || "Unknown error";
              const lowMsg = errorMessage.toLowerCase();
              const isOwner = auth.currentUser?.email === 'p26893150@gmail.com';
              if (geminiManager.isQuotaError(error)) {
                geminiManager.markExhausted(apiKey);
                setError(isOwner ? "AI Quota Exceeded. Switching API keys... Please try starting again." : "We are currently experiencing high traffic, please check back shortly.");
              } else {
                const isCancelled = lowMsg.includes('operation was cancelled') || lowMsg.includes('aborted');
                if (!isCancelled) {
                  setError(isOwner ? "Connection failed. Please try again." : "The connection was interrupted, please try again.");
                }
              }
              stopNarratorSession();
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

      // Small delay to ensure connection is ready
      setTimeout(() => {
        if (connectionId === connectionIdRef.current && isActiveRef.current && sessionRef.current) {
          const user = auth.currentUser;
          const sessionKey = 'nefron_narrator_greeted';
          let hasBeenGreeted = false;
          try {
            hasBeenGreeted = sessionStorage.getItem(sessionKey) === 'true';
          } catch (e) {}
          
          if (!hasBeenGreeted && user) {
            const greeting = "Welcome to the Nefron Visionary experience. I am the Nefron Visionary Engine. It is a pleasure to guide you through our revolutionary world of sound.";
            
            // Send greeting as its own turn to prioritize it
            sessionRef.current.sendClientContent({ 
              turns: [{ role: 'user', parts: [{ text: `GREET THE USER WITH THIS EXACT MESSAGE: "${greeting}"` }] }],
              turnComplete: true
            });
            
            try {
              sessionStorage.setItem(sessionKey, 'true');
            } catch (e) {}
            
            // Wait a tiny bit more for the narration turn
            setTimeout(() => {
              if (connectionId === connectionIdRef.current && isActiveRef.current && sessionRef.current) {
                sessionRef.current.sendClientContent({ 
                  turns: [{ role: 'user', parts: [{ text: `Now, provide a visionary, high-fidelity, and authoritative narration for the "${activeSection?.title}" section. Context: ${activeSection?.description}` }] }],
                  turnComplete: true
                });
              }
            }, 50);
          } else {
            // Normal narration for repeat views
            sessionRef.current.sendClientContent({ 
              turns: [{ role: 'user', parts: [{ text: `Provide a visionary, high-fidelity, and authoritative narration for the "${activeSection?.title}" section. Context: ${activeSection?.description}` }] }],
              turnComplete: true
            });
          }
        }
      }, 100);

    } catch (error) {
      console.error("Failed to connect to Narrator API:", error);
      if (connectionId === connectionIdRef.current && isActiveRef.current) {
        setIsConnecting(false);
        const isOwner = auth.currentUser?.email === 'p26893150@gmail.com';
        setError(isOwner ? "Failed to initialize narrator." : "We are preparing the narration, this will just take a moment.");
      }
    }
  };

  const playNextInQueue = async () => {
    if (!isActiveRef.current || !audioContextRef.current) {
      isPlayingRef.current = false;
      setIsActuallyPlaying(false);
      return;
    }

    // Pre-roll: Build a robust safety buffer of at least 6 chunks before starting
    if (!isPlayingRef.current && audioQueueRef.current.length < 6) {
      setTimeout(() => {
        if (isActiveRef.current) playNextInQueue();
      }, 40);
      return;
    }

    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      setIsActuallyPlaying(false);
      return;
    }
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
    isPlayingRef.current = true;
    setIsActuallyPlaying(true);

    while (isActiveRef.current && audioQueueRef.current.length > 0) {
      const currentTime = audioContextRef.current.currentTime;
      if (nextStartTimeRef.current > currentTime + 0.5) {
        setTimeout(() => {
          if (isActiveRef.current) playNextInQueue();
        }, 50);
        return;
      }

      const pcmData = audioQueueRef.current.shift()!;
      const audioBuffer = audioContextRef.current.createBuffer(1, pcmData.length, 24000);
      const channelData = audioBuffer.getChannelData(0);
      for (let i = 0; i < pcmData.length; i++) {
        channelData[i] = pcmData[i] / 0x7FFF;
      }

      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);

      if (nextStartTimeRef.current < currentTime) {
        // High initial buffer offset (0.25s) for smooth playback
        nextStartTimeRef.current = currentTime + 0.25;
      }

      source.start(nextStartTimeRef.current);
      nextStartTimeRef.current += audioBuffer.duration;
    }
    
    // Check if queue is empty and we should stop playing state
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      setIsActuallyPlaying(false);
    }
  };

  const stopNarratorSession = () => {
    // Stop all audio playback immediately
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(console.error);
      audioContextRef.current = null;
    }
    
    // Close the session
    if (sessionRef.current) {
      try {
        sessionRef.current.close();
      } catch (e) {
        console.error("Error closing session:", e);
      }
      sessionRef.current = null;
    }

    setIsConnected(false);
    setIsConnecting(false);
    setIsSpeaking(false);
    setIsActuallyPlaying(false);
    setAiTranscript('');
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    nextStartTimeRef.current = 0;
  };

  React.useEffect(() => {
    isActiveRef.current = isOpen;
    setTrackingState('narrative_ai', isOpen);
    if (!isOpen) {
      stopNarratorSession();
    }
    return () => {
      isActiveRef.current = false;
      setTrackingState('narrative_ai', false);
      stopNarratorSession();
    };
  }, [isOpen]);

  return (
    <TooltipProvider delayDuration={100}>
      {/* Floating AI Button (Only visible when closed) */}
      {!isOpen && (
        <motion.button
          initial={{ scale: 0, opacity: 0, y: 0 }}
          animate={{ 
            scale: 1, 
            opacity: 1,
            y: [0, -10, 0]
          }}
          transition={{
            y: {
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut"
            },
            scale: { duration: 0.3 },
            opacity: { duration: 0.3 }
          }}
          whileHover={{ scale: 1.15 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            if (onboardingStep === 3) {
              if (auth.currentUser) {
                storage.set(`onboarding_completed_${auth.currentUser.uid}`, true);
              }
              localStorage.setItem('onboarding_step', '0');
              window.dispatchEvent(new Event('onboarding_step_changed'));
            }
            setIsOpen(true);
            setIsMinimized(false);
            startNarratorSession();
          }}
          className={cn("fixed bottom-8 right-8 group cursor-pointer", (onboardingStep === 1 || onboardingStep === 2) ? "z-40" : "z-[100]")}
        >
          <NefronAiSymbol isActive={false} />
          
          {onboardingStep === 3 && (
            <div className="absolute top-0 right-full mr-3 text-white text-[10px] font-bold pointer-events-none whitespace-nowrap animate-pulse flex items-center h-full">
              narrative Ai
            </div>
          )}

          {/* Tooltip */}
          {activeSection && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="absolute right-16 top-1/2 -translate-y-1/2 px-4 py-2 bg-black-deep/90 backdrop-blur-md border border-foreground/10 rounded-xl text-[10px] font-bold uppercase tracking-widest whitespace-nowrap pointer-events-none shadow-2xl text-foreground"
            >
              Narrate: {activeSection.title}
            </motion.div>
          )}
        </motion.button>
      )}

      {/* AI Narrator Bar (Compact like Voice Chat) */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ 
              opacity: 1, 
              y: 0,
              height: isMinimized ? '60px' : 'auto'
            }}
            exit={{ opacity: 0, y: 100 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-[500px] bg-black-deep/90 backdrop-blur-xl border border-foreground/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Main Bar Content */}
            <div className="p-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 overflow-hidden">
                <NefronAiSymbol isActive={isSpeaking || isActuallyPlaying} />
                
                <div className="overflow-hidden">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-foreground truncate">
                    {isConnecting 
                      ? `Initializing ${activeSection?.title || ''}...` 
                      : ((isSpeaking || isActuallyPlaying) 
                          ? (narratingSection?.title || "Nefron Narrator") 
                          : (activeSection?.title || "Nefron Narrator")
                        )
                    }
                  </h3>
                  <div className="flex items-center gap-2">
                    <div className="flex items-end gap-0.5 h-3 shrink-0">
                      {[...Array(6)].map((_, i) => (
                        <motion.div
                          key={i}
                          animate={{
                            height: (isSpeaking || isActuallyPlaying)
                              ? [4, Math.random() * 12 + 4, 4] 
                              : [2, 2, 2],
                          }}
                          transition={{ duration: 0.4, repeat: Infinity, delay: i * 0.05 }}
                          className={cn(
                            "w-1 rounded-full",
                            (isSpeaking || isActuallyPlaying) ? "bg-foreground" : "bg-white/10"
                          )}
                        />
                      ))}
                    </div>
                    <p className="text-[9px] text-muted truncate italic">
                      {isConnecting ? "Connecting..." : (isSpeaking || isActuallyPlaying) ? "Narrating visionary insights..." : "Narration Ready"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* Narrate Button: Shows when scrolled to a new section or when narration is finished */}
                {!(isSpeaking || isActuallyPlaying) && !isConnecting && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={startNarratorSession}
                    className="flex items-center gap-2 px-3 py-1.5 bg-foreground/10 hover:bg-foreground/20 border border-foreground/20 rounded-lg text-foreground transition-all group shadow-lg"
                  >
                    <Zap size={14} className="group-hover:scale-110 transition-transform fill-current" />
                    <span className="text-[9px] font-bold uppercase tracking-widest hidden sm:inline">
                      {activeSection?.id === narratingSectionId ? "Re-Narrate" : "Narrate Section"}
                    </span>
                  </motion.button>
                )}

                {/* Stop Button: Only shows when narrating */}
                {(isSpeaking || isActuallyPlaying) && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          // Just stop the current narration but keep the bar open
                          if (sessionRef.current) {
                            try { sessionRef.current.close(); } catch(e) {}
                            sessionRef.current = null;
                          }
                          if (audioContextRef.current) {
                            audioContextRef.current.close().catch(console.error);
                            audioContextRef.current = null;
                          }
                          setIsSpeaking(false);
                          setIsActuallyPlaying(false);
                          audioQueueRef.current = [];
                        }}
                        className="p-2 bg-foreground/5 hover:bg-foreground/10 rounded-lg text-foreground transition-colors"
                      >
                        <Square size={16} className="fill-current" />
                      </motion.button>
                    </TooltipTrigger>
                    <TooltipContent>Stop Narration</TooltipContent>
                  </Tooltip>
                )}

                <Tooltip>
                  <TooltipTrigger asChild>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setIsMinimized(!isMinimized)}
                      className="p-2 text-muted hover:text-foreground transition-colors"
                    >
                      <ChevronDown size={20} className={cn("transition-transform", isMinimized && "rotate-180")} />
                    </motion.button>
                  </TooltipTrigger>
                  <TooltipContent>{isMinimized ? "Expand Narrator" : "Minimize Narrator"}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => {
                        setIsOpen(false);
                        stopNarratorSession();
                      }}
                      className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg transition-colors"
                    >
                      <X size={18} />
                    </motion.button>
                  </TooltipTrigger>
                  <TooltipContent>Close Guide</TooltipContent>
                </Tooltip>
              </div>
            </div>

            {/* Expanded Content (Transcript) */}
            <AnimatePresence>
              {!isMinimized && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="px-4 pb-4"
                >
                  {error ? (
                    <div className="py-2 flex items-center justify-between gap-4">
                      <p className="text-[10px] text-red-400">
                        {auth.currentUser?.email === 'p26893150@gmail.com'
                          ? error
                          : (error.toLowerCase().includes('quota') || error.toLowerCase().includes('key')
                              ? "We are currently experiencing high traffic, please check back shortly."
                              : error)}
                      </p>
                      <button 
                        onClick={startNarratorSession}
                        className="text-[9px] font-bold uppercase tracking-widest text-foreground underline"
                      >
                        Retry
                      </button>
                    </div>
                  ) : (
                    aiTranscript && (
                      <div className="p-3 bg-foreground/5 rounded-xl border border-foreground/5 max-h-[80px] overflow-y-auto custom-scrollbar">
                        <p className="text-[10px] text-foreground/70 leading-relaxed italic">
                          "{aiTranscript.trim()}"
                        </p>
                      </div>
                    )
                  )}
                  <div className="mt-2 text-center">
                    <p className="text-[8px] text-muted uppercase tracking-[0.2em] font-bold">
                      Powered by Nefron Visionary Engine
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </TooltipProvider>
  );
}
