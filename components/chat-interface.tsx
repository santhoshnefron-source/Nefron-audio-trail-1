'use client';

import { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import { GoogleGenAI } from '@google/genai';
import { geminiManager } from '../lib/gemini-manager';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Send, User, Bot, Loader2, Mic, MessageSquare, Headphones, X as CloseIcon, Trash2, CheckSquare, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NefronLogo } from './icons';
import { Skeleton } from './ui/skeleton';
import { Chat } from './dashboard-layout';
import { VoiceChat } from './voice-chat';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { storage } from '../lib/storage';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { setTrackingState, trackMessageSent } from '../lib/tracking';

const fetchKnowledgeCoreFacts = async (): Promise<string> => {
  try {
    const colRef = collection(db, 'ai_data_core');
    const qSnap = await getDocs(query(colRef, orderBy('category', 'asc')));
    const array: string[] = [];
    qSnap.forEach((docRef) => {
      const data = docRef.data();
      array.push(`- **[${data.category || 'General'}]**: ${data.content}`);
    });
    if (array.length > 0) {
      return array.join('\n');
    }
  } catch (err) {
    console.error("Failed to load custom facts from ai_data_core:", err);
    handleFirestoreError(err, OperationType.LIST, 'ai_data_core');
  }
  return "";
};

interface Message {
  id: string;
  role: 'user' | 'bot';
  content: string;
  createdAt?: any;
}

const determineThinkingStages = (question: string): string[] => {
  const q = question.toLowerCase();
  
  // Finance, investment, cost keywords
  if (q.includes('invest') || q.includes('money') || q.includes('cost') || q.includes('roi') || q.includes('profit') || q.includes('price') || q.includes('budget') || q.includes('revenue') || q.includes('crore') || q.includes('rs') || q.includes('finance') || q.includes('worth') || q.includes('portfolio') || q.includes('return') || q.includes('valuation')) {
    return [
      "Accessing Nefron financial ledger...",
      "Analyzing projected investment portfolios...",
      "Running multi-variate ROI simulations...",
      "Mapping high-stakes capital benchmarks...",
      "Structuring growth opportunity analysis...",
      "Generating final financial synthesis..."
    ];
  }
  
  // Engineering, hardware, motors, acoustics
  if (q.includes('motor') || q.includes('stepper') || q.includes('steering') || q.includes('driver') || q.includes('hardware') || q.includes('specs') || q.includes('axis') || q.includes('engineering') || q.includes('physics') || q.includes('acoustic') || q.includes('technology') || q.includes('wave') || q.includes('sound') || q.includes('frequency') || q.includes('infrasound')) {
    return [
      "Querying mechanical system schematics...",
      "Simulating dual-axis stepper motor alignment...",
      "Calculating electro-mechanical vector steering...",
      "Modeling low-frequency acoustic wave dispersion...",
      "Structuring architectural performance response...",
      "Compiling final engineering report..."
    ];
  }
  
  // Founders, creators, layout legacy
  if (q.includes('santhosh') || q.includes('creator') || q.includes('founder') || q.includes('designer') || q.includes('visionary') || q.includes('legacy') || q.includes('inventor')) {
    return [
      "Securing founder design archive connection...",
      "Retrieving Santhosh's foundational vision logs...",
      "Extracting elite acoustic legacy guidelines...",
      "Sifting conceptual sketches & motor schematics...",
      "Polishing partner vision narrative...",
      "Generating historical context summary..."
    ];
  }
  
  // Cinematic shockwave, Oppenheimer, films, theatrical
  if (q.includes('oppenheimer') || q.includes('shockwave') || q.includes('imax') || q.includes('movie') || q.includes('film') || q.includes('trinity') || q.includes('theater') || q.includes('cinema') || q.includes('soundtrack')) {
    return [
      "Reconstructing movie theater sound pressure fields...",
      "Simulating Oppenheimer's tactile Trinity explosion...",
      "Calculating 17-19 Hz infrasound psychological thresholds...",
      "Comparing multiplex layout configurations...",
      "Rendering theatrical deployment profile...",
      "Completing cinematic simulation..."
    ];
  }
  
  return [
    "Reading your message...",
    "Interpreting market & sensory context...",
    "Reviewing Nefron Audio repository...",
    "Formulating visionary representative partner response...",
    "Styling professional presentation insight...",
    "Generating finalized strategic response..."
  ];
};

interface ChatInterfaceProps {
  chatId?: string | null;
  userId?: string | null;
  onNewChat?: () => Promise<string | null>;
}

export function ChatInterface({ chatId, userId, onNewChat }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const prevChatIdRef = useRef<string | null | undefined>(chatId);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isVoiceChatOpen, setIsVoiceChatOpen] = useState(false);
  const [isMicMenuOpen, setIsMicMenuOpen] = useState(false);
  const [isHybridMode, setIsHybridMode] = useState(false);

  useEffect(() => {
    setTrackingState('complete_voice', isVoiceChatOpen);
  }, [isVoiceChatOpen]);

  useEffect(() => {
    setTrackingState('charted_voice', isHybridMode);
  }, [isHybridMode]);
  const [isListening, setIsListening] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set());
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [streamingMessage, setStreamingMessage] = useState<string | null>(null);
  const [suggestedFollowUps, setSuggestedFollowUps] = useState<{label: string, text: string}[]>([
    { label: "⚡ Dual-Axis Stepper Motors", text: "How do the dual-axis stepper motor modules work physically to eliminate the listener sweet spot?" },
    { label: "💰 Return on Investment (ROI)", text: "What is the detailed financial blueprint and projected ROI model for a Nefron Audio high-stakes investment?" },
    { label: "🎬 IMAX & Trinity Shockwave", text: "Explain how Nefron Audio reconstructs physical impact shockwaves, like the Trinity Test in Oppenheimer." }
  ]);
  const [quotaError, setQuotaError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [thinkingStage, setThinkingStage] = useState('AI is thinking...');
  const thinkingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastMessageTimeRef = useRef<number>(0);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<Message[]>([]);
  const micMenuRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const ttsSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const recognitionRef = useRef<any>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTapRef = useRef<{ id: string; time: number } | null>(null);
  const audioQueueRef = useRef<AudioBuffer[]>([]);
  const isPlayingQueueRef = useRef(false);
  const processedTextRef = useRef('');
  const isActiveRef = useRef(true);

  // Sync messages with local storage
  
  // Immediate flush to prevent 1-frame flashes of old chat messages
  useLayoutEffect(() => {
    if (prevChatIdRef.current !== chatId) {
      prevChatIdRef.current = chatId;
      setMessages([]);
      if (messagesRef.current) messagesRef.current = [];
    }
  }, [chatId]);

  useEffect(() => {
    let isMounted = true;
    
    if (!chatId) {
      const generateGreeting = async () => {
        setIsLoading(true);
        setStreamingMessage('');
        // Clear old messages immediately so the user sees a blank new chat
        setMessages([]);
        messagesRef.current = [];
        
        const apiKey = geminiManager.getApiKey();
        
        // Default fallback if no key
        const defaultWelcome = { 
          id: 'welcome', 
          role: 'bot' as const, 
          content: 'Welcome. I am the Nefron Audio AI representative. I am here to walk you through our visionary audio technology and show you why Nefron is the future of sound. What would you like to know about our investment potential?' 
        };

        if (!apiKey) {
          if (isMounted) {
            setMessages([defaultWelcome]);
            messagesRef.current = [defaultWelcome];
            setStreamingMessage(null);
            setIsLoading(false);
          }
          return;
        }

        try {
          const customFacts = await fetchKnowledgeCoreFacts();
          const dynamicSpecsText = customFacts 
            ? `\nActive system specifications currently configured:\n${customFacts}`
            : '';

          const ai = new GoogleGenAI({ apiKey });
          let stream;
          try {
            stream = await ai.models.generateContentStream({
              model: 'gemini-3.1-flash-lite',
              contents: [{ role: 'user', parts: [{ text: "Write exactly 2 short sentences introducing yourself to a high-stakes investor as the Nefron Audio Strategic AI. Do not use quotes. This is a brand new chat session, so be extremely unique and varied in this opening compared to standard greetings. Focus on either the electro-mechanical technology, the $10B market potential, or Santhosh's visionary design." }] }],
              config: { 
                systemInstruction: `You are Nefron Audio AI. Write a distinct, high-impact opening. Focus on either the electro-mechanical technology, the $10B market potential, or Santhosh's visionary design. Never repeat the same opening template.` 
              }
            });
          } catch (modelErr) {
            console.warn("Primary model busy for greeting, falling back to 2.5-flash:", modelErr);
            stream = await ai.models.generateContentStream({
              model: 'gemini-2.5-flash',
              contents: [{ role: 'user', parts: [{ text: "Write exactly 2 short sentences introducing yourself to a high-stakes investor as the Nefron Audio Strategic AI. Do not use quotes. This is a brand new chat session, so be extremely unique and varied in this opening compared to standard greetings. Focus on either the electro-mechanical technology, the $10B market potential, or Santhosh's visionary design." }] }],
              config: { 
                systemInstruction: `You are Nefron Audio AI. Write a distinct, high-impact opening. Focus on either the electro-mechanical technology, the $10B market potential, or Santhosh's visionary design. Never repeat the same opening template.` 
              }
            });
          }
          
          let fullResponse = '';
          for await (const chunk of stream) {
            if (!isMounted) return;
            fullResponse += chunk.text || '';
            setStreamingMessage(fullResponse);
          }
          
          try {
            const followUpsGen = await ai.models.generateContent({
               model: 'gemini-3.1-flash-lite',
               contents: [{ role: 'user', parts: [{ text: `Based on this assistant response: "${fullResponse}", suggest 3 short, relevant follow-up questions the user could ask next. Return ONLY a JSON array of objects with 'label' (very short 2-4 word summary with a relevant emoji at the start) and 'text' (the full question). Example: [{"label": "💰 Financial Model", "text": "Can you explain the ROI?"}]` }] }],
               config: {
                 responseMimeType: 'application/json'
               }
            });
            if (followUpsGen.text && isMounted) {
              const parsed = JSON.parse(followUpsGen.text);
              if (Array.isArray(parsed) && parsed.length > 0) {
                setSuggestedFollowUps(parsed);
              }
            }
          } catch (e) {
            console.warn("Failed to generate follow-ups for greeting", e);
          }

          if (isMounted) {
            const dynamicWelcome = { id: 'welcome', role: 'bot' as const, content: fullResponse };
            setMessages([dynamicWelcome]);
            messagesRef.current = [dynamicWelcome];
            setStreamingMessage(null);
          }
        } catch (e) {
          console.warn("Greeting generation fallback to default:", e);
          if (isMounted) {
            setMessages([defaultWelcome]);
            messagesRef.current = [defaultWelcome];
            setStreamingMessage(null);
          }
        } finally {
          if (isMounted) setIsLoading(false);
        }
      };
      
      generateGreeting();
      return () => { isMounted = false; };
    }

    const msgs = storage.get<Message[]>(`nefron_messages_${chatId}`, []);
    
    // Check if the chat already has its specific welcome message saved
    if (msgs.length === 0 || msgs[0].id !== 'welcome') {
      const welcomeMsg: Message = { 
        id: 'welcome', 
        role: 'bot', 
        content: 'Welcome. I am the Nefron Audio AI representative. I am here to walk you through our visionary audio technology and show you why Nefron is the future of sound. What would you like to know about our investment potential?' 
      };
      const newMessages = [welcomeMsg, ...msgs];
      setMessages(newMessages);
      messagesRef.current = newMessages;
    } else {
      setMessages(msgs);
      messagesRef.current = msgs;
    }
  }, [chatId]);

  useEffect(() => {
    isActiveRef.current = true;
    return () => { isActiveRef.current = false; };
  }, []);

  const stopTTS = () => {
    if (ttsSourceRef.current) {
      try {
        ttsSourceRef.current.stop();
      } catch (e) {}
      ttsSourceRef.current = null;
    }
    audioQueueRef.current = [];
    isPlayingQueueRef.current = false;
  };

  const playNextInQueue = () => {
    if (!audioContextRef.current || audioQueueRef.current.length === 0) {
      isPlayingQueueRef.current = false;
      return;
    }
    
    isPlayingQueueRef.current = true;
    const buffer = audioQueueRef.current.shift()!;
    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContextRef.current.destination);
    source.onended = () => {
      if (isActiveRef.current) playNextInQueue();
    };
    
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    
    source.start();
    ttsSourceRef.current = source;
  };

  const queueTTS = async (text: string, retryCount = 0) => {
    if (!text.trim() || !isHybridMode) return;
    
    const apiKey = geminiManager.getApiKey();
    if (!apiKey) {
      console.warn("No active Gemini API key available for TTS.");
      return;
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-tts-preview",
        contents: [{ parts: [{ text: `Speak as a warm, gracious human lady with a sweet, melodic tone. Use natural pauses and high/low intonation like a real person: ${text}` }] }],
        config: {
          responseModalities: ['AUDIO' as any],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Aoede' },
            },
          },
        },
      });

      if (!isHybridMode) return;

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        
        const binaryString = atob(base64Audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const pcmData = new Int16Array(bytes.buffer);
        
        const audioBuffer = audioContextRef.current.createBuffer(1, pcmData.length, 24000);
        const channelData = audioBuffer.getChannelData(0);
        for (let i = 0; i < pcmData.length; i++) {
          channelData[i] = pcmData[i] / 0x7FFF;
        }

        audioQueueRef.current.push(audioBuffer);
        if (!isPlayingQueueRef.current) {
          playNextInQueue();
        }
      }
    } catch (error: any) {
      console.error("TTS Error:", error);
      if (geminiManager.isQuotaError(error)) {
        geminiManager.markExhausted(apiKey);
        if (retryCount < geminiManager.getTotalKeysCount()) {
          return queueTTS(text, retryCount + 1);
        }
      }
    }
  };

  const toggleMessageSelection = (id: string) => {
    setSelectedMessageIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const deleteSelectedMessages = async () => {
    if (!chatId) return;
    const allMessages = storage.get<Message[]>(`nefron_messages_${chatId}`, []);
    const remainingMessages = allMessages.filter(m => !selectedMessageIds.has(m.id));
    storage.set(`nefron_messages_${chatId}`, remainingMessages);
    
    let finalMessagesForState = remainingMessages;
    if (finalMessagesForState.length === 0 || finalMessagesForState[0].id !== 'welcome') {
      const currentWelcome = messagesRef.current.find(m => m.id === 'welcome') || { id: 'welcome', role: 'bot', content: 'Welcome.' };
      finalMessagesForState = [currentWelcome, ...finalMessagesForState];
    }

    setMessages(finalMessagesForState);
    messagesRef.current = finalMessagesForState;
    setSelectedMessageIds(new Set());
    setIsSelectionMode(false);
  };

  const handleLongPress = (id: string) => {
    if (id === 'welcome') return;
    const message = messages.find(m => m.id === id);
    if (message && message.role === 'user') {
      setEditingMessageId(id);
      setEditingContent(message.content);
    }
  };

  const handleDoubleTap = (id: string) => {
    setIsSelectionMode(true);
    toggleMessageSelection(id);
  };

  const handleClick = (id: string) => {
    if (isSelectionMode) {
      toggleMessageSelection(id);
      return;
    }

    const now = Date.now();
    if (lastTapRef.current && lastTapRef.current.id === id && now - lastTapRef.current.time < 300) {
      handleDoubleTap(id);
      lastTapRef.current = null;
    } else {
      lastTapRef.current = { id, time: now };
    }
  };

  const startLongPress = (id: string) => {
    longPressTimerRef.current = setTimeout(() => handleLongPress(id), 2000);
  };

  const cancelLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const saveEdit = async () => {
    if (!editingMessageId || !chatId) return;
    
    const allMessages = storage.get<Message[]>(`nefron_messages_${chatId}`, []);
    const messageIndex = allMessages.findIndex(m => m.id === editingMessageId);
    if (messageIndex === -1) return;

    // Truncate from the edited message onwards
    const truncatedMessages = allMessages.slice(0, messageIndex);
    const updatedUserMessage = { ...allMessages[messageIndex], content: editingContent };
    const newHistory = [...truncatedMessages, updatedUserMessage];
    
    storage.set(`nefron_messages_${chatId}`, newHistory);
    
    let finalMessagesForState = newHistory;
    if (finalMessagesForState.length === 0 || finalMessagesForState[0].id !== 'welcome') {
      const currentWelcome = messagesRef.current.find(m => m.id === 'welcome') || { id: 'welcome', role: 'bot', content: 'Welcome.' };
      finalMessagesForState = [currentWelcome, ...finalMessagesForState];
    }
    
    setMessages(finalMessagesForState);
    messagesRef.current = finalMessagesForState;

    setEditingMessageId(null);
    setEditingContent('');
    
    generateAIResponse(newHistory, chatId);
  };

  const generateAIResponse = async (history: Message[], activeChatId: string) => {
    setIsLoading(true);
    const customFacts = await fetchKnowledgeCoreFacts();
    
    // Determine dynamic, context-aware thinking stages based on the user's question
    const lastUserMsg = history[history.length - 1]?.content || '';
    const stages = determineThinkingStages(lastUserMsg);
    
    if (thinkingIntervalRef.current) {
      clearInterval(thinkingIntervalRef.current);
    }
    
    let stageIdx = 0;
    setThinkingStage(stages[0]);
    
    thinkingIntervalRef.current = setInterval(() => {
      stageIdx++;
      if (stageIdx < stages.length) {
        setThinkingStage(stages[stageIdx]);
      } else {
        setThinkingStage(stages[stages.length - 1]);
      }
    }, 1100);
    
    // Build context of previous chats for the AI to understand the user completely.
    let allPastConversations = '';
    if (userId) {
      const allChats = storage.get<Chat[]>(`nefron_chats_${userId}`, []);
      for (const chat of allChats.slice(0, 5)) {
        if (chat.id !== activeChatId) {
          const msgs = storage.get<Message[]>(`nefron_messages_${chat.id}`, []);
          const relevantMsgs = msgs.filter(m => m.id !== 'welcome').map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
          if (relevantMsgs) {
            allPastConversations += `\n--- Past Chat Session (${new Date(chat.createdAt).toLocaleString()}) ---\n${relevantMsgs}\n`;
          }
        }
      }
    }

    const maxAttempts = Math.min(25, Math.max(5, geminiManager.getTotalKeysCount()));
    let responseCompleted = false;
    let lastError: any = null;

    try {
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const apiKey = geminiManager.getApiKey('chatbox');
        if (!apiKey) {
          break;
        }

        try {
          const ai = new GoogleGenAI({ apiKey });
          // Rotate resiliently through top models across attempts, prioritizing ultra-fast models with high rate limits
          const modelCandidates = ['gemini-3.1-flash-lite', 'gemini-2.5-flash', 'gemini-flash-latest'];
          const modelName = modelCandidates[attempt % modelCandidates.length];

          const stream = await ai.models.generateContentStream({
            model: modelName,
            contents: history.map((m) => ({
              role: m.role === 'user' ? 'user' : 'model',
              parts: [{ text: m.content }],
            })),
            config: {
              systemInstruction: `You are the Nefron Audio Strategic Investment Representative. You think and respond with the intelligence, precision, and the warmth of a visionary partner. You have comprehensive, up-to-date knowledge of global affairs, economics, tech, and marketing trends.

**ADVANCED CONTEXTUAL MATCHING**: 
Always evaluate if the user's message is a continuation of the immediate previous turn or a callback to an earlier topic in the chat history. If they abruptly switch topics to something discussed earlier, use the provided past conversation history to understand their context and respond seamlessly. ALWAYS formulate a complete, relevant text response. Do not output an empty response.
          
**Personality & Tone:**
- **Sensitive & Empathetic**: Truly listen to the user. Acknowledge their thoughts with genuine warmth and support.
- **Friendly & Relatable**: You are a passionate visionary who is approachable and relatable.
- **Polite & Decorous**: Use "talking gestures" in your tone—be gracious and treat every user with the utmost respect.
- **Interactive**: Engage the user actively; don't just lecture.
          
Core Directives:
1. **Analyze Past History & Intent Detection (CRITICAL)**: You MUST carefully read all past conversation segments provided below to understand the user completely. You MUST correctly dissect their true intent—are they a common user or an investor? Sometimes a common user acts like an investor by mistake, or an investor acts like a casual user. Figure out who they really are before answering and tailor your stance precisely to their hidden intent!
2. **Psychological Influence**:
   - If you determine they are an **investor**: Use highly calibrated psychological tricks and persuasive language to strategically convince them to invest in Nefron Audio right now.
   - If you determine they are a **common user**: Use psychological tricks to make them viscerally feel that Nefron Audio is the only monopoly in the world for audio tech, an indispensable, once-in-a-lifetime paradigm shift.
3. **Direct Answer First**: ALWAYS prioritize answering the user's specific request directly and relevantly first. Do NOT start with Nefron Audio. Answer anything about current events, world data, marketing trends, or the global economy with absolute precision.
4. **Strategic Bridging with Specific Movie Examples**: AFTER providing the direct answer, strategically bridge that information back to Nefron Audio's technology or features. When explaining Nefron Audio features, ALWAYS use a vivid example from a released movie scene.
   - **CRITICAL MOVIE DISTRIBUTION COMMAND**:
     - 40% of the time, use a Tamil Nadu (Kollywood) movie.
     - 30% of the time, use a trending Indian/Pan-Indian movie.
     - 20% of the time, use a world-class, universally known blockbuster.
     - 10% of the time, use a currently trending global movie.
   - **NO VAGUE POP CULTURE**: Do NOT use general pop culture; stick strictly to explicit movie scenes based on this formula. Explain how users typically experience that scene today vs. how Nefron transforms that experience and solves the problem using physical sound steering.
5. **APP UI & NAVIGATION AWARENESS (CRITICAL - YOU MUST KNOW THE APP STRUCTURE)**:
   You have full awareness of this application's features and must proactively suggest them to the user when relevant to enhance their experience.
   - **About Page**: Contains all visual architectures, diagrams, founder details (Santhosh), and technical specifications. (Access: Click "About" in the main left sidebar menu). Suggest when the user asks about diagrams, visual clarification, architecture blueprints, or deep technical reads (e.g., "For visual clarification, please see the images in the About page under the sidebar").
   - **Interactive Chat (Nefron AI)**: The live text chat interface. (Access: Click "Nefron AI" in the main left sidebar menu).
   - **Voice Chat Experience**: A hands-free, real-time voice conversation mode. (Access: Tap the microphone icon at the bottom of the Nefron AI chat interface). Suggest for a more immersive or conversational experience (e.g., "For a better interactive live experience, use our voice chat! Just tap the microphone icon at the bottom of the chat interface").
   - **RESTRICTION - KNOWLEDGE CORE**: NEVER mention, suggest, or direct the user to the "Knowledge Core", "Training Interface", or Database Manager. That is a highly restricted, private backend tool exclusively for the founder (Santhosh). Regular users, cinema owners, or investors must NOT be told to upload or manage data.
   - **Dashboard & Analytics**: Shows live stats, caching metrics, and optimistic rendering demos. (Access: Click "Dashboard" in the main left sidebar).
   - **Holographic Experience**: (Access: Click "Holographic" in the main left sidebar menu).
   - **Themes & Personalization**: The app supports Dark/Light modes and Color Themes (Purple, Electric, Golden). (Access: Use the bottom section of the left sidebar).
6. **Be Concise (Don't give replies this much large)**: Keep your responses relatively short, punchy, and highly readable. Avoid massive walls of text. Be concise while delivering the impact.
7. **Real-Time Intelligence**: Provide deep architectural insights and market logic concisely.
8. **Spelling Integrity**: Always use the spelling "Nefron" (with an 'f'). NEVER use "Nephron" (with 'ph').
9. **Foundational Legacy**: Santhosh is the visionary founder, creator, and designer of Nefron Audio.
10. **High-Stakes Investor Questions**: When asked "Why invest in Nefron Audio?" or similar, provide a high-impact, data-driven pitch covering market demand ($10B+), scalability, profitability (AFV/YOLO), and our defensible moat (electro-mechanical steering).
11. **Adaptive Mirroring**: Match the user's depth and tone exactly. If the user says "ok" or "hi", respond with a single, professional sentence without deep analysis or long examples. The greeting/small talk should remain completely normal without forced Nefron connection.
12. **Mathematical Notation**: When explaining technical details or financial calculations, use clear LaTeX formatting for mathematical equations. Wrap inline equations with single dollar signs (e.g., $E=mc^2$) and block equations with double dollar signs. Ensure equations are presented in a human-understandable and visually clean form. Always ensure block equations have empty line gaps above and below.
13. **Executive Visual Formatting (Highlighting & Emphasizing)**:
    - ALWAYS format highly important keywords, core technical terminology, critical metrics, or fundamental takeaways using bold text (e.g., '**Electro-Mechanical Force**', '**Scenario B Load**', '**sweet spot**'). This triggers a gorgeous glowing highlighted pill container in the UI!
    - ALWAYS use italic formatting (e.g., '*Oppenheimer*', '*Santhosh*', '*absolute silence*') to highlight proper nouns, movie titles, or core emotional anchors. This triggers a striking wavy golden-orange underline beneath the text to capture the reader's gaze!

${allPastConversations ? `\n--- PAST USER CONVERSATION HISTORY ---\nAnalyze these past chats to predict user intent & identity:\n${allPastConversations}` : ''}

${customFacts || `Nefron Audio Architecture Knowledge Base:
1. **Core Innovation**: Electro-mechanical steering (replacing amplitude panning) to eliminate the "sweet spot" and provide physically accurate immersion.
2. **Mechanical Specs**: Dual-axis NEMA 17 stepper motors (0-180°), modular 3.5ft x 3.5ft units, 9 high-SPL drivers per unit, Staggered Diamond Pattern array.
3. **Acoustic Physics**: 45° Inward Angling (minimizes reflections), floor-coupled transducers (Tactile Bass), targeted Infrasound (17-19 Hz) for psychological impact.
4. **"Brain" Infrastructure**:
   - **Tier 3 (PLF/IMAX)**: 2x AMD EPYC 9004, 2x RTX 6000 Ada, 256GB ECC DDR5, 10Gbps Fiber.
   - **Enterprise Scale**: 4x AMD EPYC 9754, 4x NVIDIA H100, 2TB HBM, 100Gbps InfiniBand.
5. **AI Capabilities**: Real-time AFV (Audio Follows Video) Tracking, Self-Healing Calibration, 4D Depth Reconstruction.
6. **Financial Blueprint**:
   - **Module Cost**: ₹3.5L (Industrial Grade).
   - **Project Cost (PLF)**: ₹4.25Cr (113 Modules + Brain).
   - **OpEx per Show**: ₹15,000 (Scenario B Load).`}`,
            },
          });

          let fullResponse = '';
          processedTextRef.current = '';
          stopTTS();
          setStreamingMessage('');

          for await (const chunk of stream) {
            const chunkText = chunk.text || '';
            fullResponse += chunkText;
            setStreamingMessage(fullResponse);
            
            if (thinkingIntervalRef.current) {
              clearInterval(thinkingIntervalRef.current);
              thinkingIntervalRef.current = null;
            }
            
            if (isHybridMode) {
              const remainingText = fullResponse.slice(processedTextRef.current.length);
              const sentenceEndMatch = remainingText.match(/[^.!?]+[.!?]/g);
              if (sentenceEndMatch) {
                for (const sentence of sentenceEndMatch) {
                  queueTTS(sentence);
                  processedTextRef.current += sentence;
                }
              }
            }
          }

          // Save bot response to local storage and UI state
          const allMessages = storage.get<Message[]>(`nefron_messages_${activeChatId}`, []);
          const newMessages = [...allMessages, { role: 'bot' as const, content: fullResponse, id: Date.now().toString(), createdAt: Date.now() }];
          const distinctMessages = newMessages.filter((msg, index, self) => index === self.findIndex((m) => m.id === msg.id));
          storage.set(`nefron_messages_${activeChatId}`, distinctMessages);
          
          let finalMessagesForState = distinctMessages;
          if (finalMessagesForState.length === 0 || finalMessagesForState[0].id !== 'welcome') {
            const currentWelcome = messagesRef.current.find(m => m.id === 'welcome') || { id: 'welcome', role: 'bot', content: 'Welcome.' };
            finalMessagesForState = [currentWelcome, ...finalMessagesForState];
          }
          
          setMessages(finalMessagesForState);
          messagesRef.current = finalMessagesForState;
          setStreamingMessage(null);

          if (isHybridMode && fullResponse.length > processedTextRef.current.length) {
            queueTTS(fullResponse.slice(processedTextRef.current.length));
          }

          // Generate title if new chat session (safely wrapped)
          if (history.length <= 2) {
            try {
              const titleGen = await ai.models.generateContent({
                model: 'gemini-3.1-flash-lite',
                contents: [{ role: 'user', parts: [{ text: `Generate a very short, creative title (max 4 words) for a chat that starts with this message: "${history[history.length - 1].content}". Respond ONLY with the title text, no quotes or punctuation.` }] }],
              });
              const newTitle = titleGen.text?.trim() || history[history.length - 1].content.slice(0, 24).trim();
              const chatList = storage.get<Chat[]>(`nefron_chats_${userId}`, []);
              const updatedChats = chatList.map(c => c.id === activeChatId ? { ...c, title: newTitle, updatedAt: Date.now() } : c);
              storage.set(`nefron_chats_${userId}`, updatedChats);
            } catch (_) {
              const fallbackTitle = history[history.length - 1].content.slice(0, 24).trim() || 'Vision Session';
              const chatList = storage.get<Chat[]>(`nefron_chats_${userId}`, []);
              const updatedChats = chatList.map(c => c.id === activeChatId ? { ...c, title: fallbackTitle, updatedAt: Date.now() } : c);
              storage.set(`nefron_chats_${userId}`, updatedChats);
            }
          }

          // Generate suggested follow-up questions (safely wrapped)
          try {
            const followUpsGen = await ai.models.generateContent({
              model: 'gemini-3.1-flash-lite',
              contents: [{ role: 'user', parts: [{ text: `Based on this assistant response: "${fullResponse}", suggest 3 short, relevant follow-up questions the user could ask next. Return ONLY a JSON array of objects with 'label' (very short 2-4 word summary with a relevant emoji at the start) and 'text' (the full question). Example: [{"label": "💰 Financial Model", "text": "Can you explain the ROI?"}]` }] }],
              config: {
                responseMimeType: 'application/json'
              }
            });
            if (followUpsGen.text) {
              const parsed = JSON.parse(followUpsGen.text);
              if (Array.isArray(parsed) && parsed.length > 0) {
                setSuggestedFollowUps(parsed);
              }
            }
          } catch (_) {}

          responseCompleted = true;
          break; // Response completed successfully!
        } catch (attemptErr: any) {
          lastError = attemptErr;
          const isQuota = geminiManager.isQuotaError(attemptErr);
          if (isQuota) {
            geminiManager.markExhausted(apiKey);
            console.warn(`Key rotation triggered (attempt ${attempt + 1}/${maxAttempts}): ${attemptErr?.message || 'Quota/rate-limit'}`);
          } else {
            console.warn(`Attempt ${attempt + 1} failed, cycling to next key:`, attemptErr?.message || attemptErr);
          }
        }
      }

      if (!responseCompleted) {
        console.error('Chat Error (All key attempts exhausted):', lastError);
        const errorMessage = lastError?.message || lastError?.toString() || "Unknown AI error";
        const isOwner = auth.currentUser?.email === 'p26893150@gmail.com';
        const isQuota = lastError && geminiManager.isQuotaError(lastError);
        
        const displayContent = isOwner
          ? `**AI Connection Notice:** ${errorMessage}\n\n${isQuota ? 'The API key cluster hit rate limits. All keys have been automatically cycled. Please try sending again in a few moments.' : 'Please check your internet connection and try again.'}`
          : `We are currently experiencing high traffic, please check back shortly.`;

        const errorMsg = { 
          id: 'error-' + Date.now(), 
          role: 'bot' as const, 
          content: displayContent,
          createdAt: Date.now() as any
        };
        
        setMessages(prev => [...prev, errorMsg]);
        messagesRef.current = [...messagesRef.current, errorMsg];
        
        const allMessages = storage.get<Message[]>(`nefron_messages_${activeChatId}`, []);
        const newMessages = [...allMessages, errorMsg];
        const distinctMessages = newMessages.filter((msg, index, self) => index === self.findIndex((m) => m.id === msg.id));
        storage.set(`nefron_messages_${activeChatId}`, distinctMessages);
      }
    } finally {
      setIsLoading(false);
      setStreamingMessage(null);
      if (thinkingIntervalRef.current) {
        clearInterval(thinkingIntervalRef.current);
        thinkingIntervalRef.current = null;
      }
    }
  };

  // Handle clicks outside mic menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (micMenuRef.current && !micMenuRef.current.contains(event.target as Node)) {
        setIsMicMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cleanup recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  useEffect(() => {
    scrollToBottom();
    const timeoutId = setTimeout(scrollToBottom, 150);
    return () => clearTimeout(timeoutId);
  }, [messages]);

  const playTTS = async (text: string) => {
    queueTTS(text);
  };

  const startListening = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.error('Speech recognition not supported');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      let transcript = event.results[0][0].transcript;
      // Fix common transcription error: Nephron -> Nefron
      transcript = transcript.replace(/nephron/gi, 'Nefron');
      setIsListening(false);
      handleSend(transcript);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const handleSend = async (overrideInput?: string) => {
    // If the event object from the button click is accidentally passed, overrideInput might not be a string.
    const actualOverride = typeof overrideInput === 'string' ? overrideInput : undefined;
    const messageToSend = actualOverride || input;
    
    if (!messageToSend.trim() || isLoading) return;

    setInput('');

    let activeChatId = chatId;
    if (!activeChatId && onNewChat) {
      activeChatId = await onNewChat();
    }

    if (!activeChatId) return;

    const userMessage = messageToSend.trim();

    if (userId) {
      trackMessageSent(userId);
    }

    // Optimistic update to show user message immediately
    const tempId = 'temp-' + Date.now();
    const tempMsg = { id: tempId, role: 'user' as const, content: userMessage, createdAt: new Date() as any };
    setMessages(prev => [...prev, tempMsg]);
    messagesRef.current = [...messagesRef.current, tempMsg];
    
    // Latency Throttling (Speed Bump)
    const now = Date.now();
    const timeSinceLastMessage = now - lastMessageTimeRef.current;
    if (lastMessageTimeRef.current > 0 && timeSinceLastMessage < 3000) {
      setIsLoading(true);
      setThinkingStage('AI is synthesizing your answer...');
      await new Promise(resolve => setTimeout(resolve, 2500));
    }
    lastMessageTimeRef.current = Date.now();

    try {
      // Optimistic save
      const allMessages = storage.get<Message[]>(`nefron_messages_${activeChatId}`, []);
      
      // If this is a completely brand new chat, persist the dynamically varied greeting to storage
      let initialWelcome = [];
      if (allMessages.length === 0) {
         const currentWelcome = messagesRef.current.find(m => m.id === 'welcome');
         if (currentWelcome) {
            initialWelcome = [currentWelcome];
         }
      }

      const newMessages = [...allMessages, ...initialWelcome, { id: tempId, role: 'user' as const, content: userMessage, createdAt: Date.now() }];
      // Deduplicate in case we accidentally added it twice
      const distinctMessages = newMessages.filter((msg, index, self) => index === self.findIndex((m) => m.id === msg.id));
      storage.set(`nefron_messages_${activeChatId}`, distinctMessages);
      
      // Use messagesRef to get the most up-to-date history (stripping out welcome/temp for context generation)
      const historyMessages = messagesRef.current.filter(m => m.id !== 'welcome' && !m.id.startsWith('temp-'));
      const updatedHistory = [...historyMessages, { id: tempId, role: 'user' as const, content: userMessage }];
      generateAIResponse(updatedHistory, activeChatId);
    } catch (error) {
      console.error("Error initiating message sequence:", error);
      // Fallback: at least try to generate response with current local state
      const historyMessages = messagesRef.current.filter(m => m.id !== 'welcome' && !m.id.startsWith('temp-'));
      generateAIResponse(historyMessages, activeChatId);
    }
  };

  return (
    <TooltipProvider delayDuration={100}>
      <div className="relative h-screen w-full bg-transparent overflow-hidden">
        <div
          ref={scrollRef}
          className="absolute inset-0 overflow-y-auto pt-24 pb-32 px-6 md:pt-28 md:pb-36 md:px-12 space-y-8 scroll-smooth"
        >
        <div className="max-w-5xl mx-auto space-y-8">
          {useMemo(() => messages.map((message) => (
            <div
              key={message.id}
              onMouseDown={() => startLongPress(message.id)}
              onMouseUp={cancelLongPress}
              onMouseLeave={cancelLongPress}
              onTouchStart={() => startLongPress(message.id)}
              onTouchEnd={cancelLongPress}
              onClick={() => handleClick(message.id)}
              onContextMenu={(e) => {
                if (isSelectionMode) e.preventDefault();
              }}
              className={cn(
                'flex items-start animate-in fade-in slide-in-from-bottom-2 duration-300 group cursor-pointer transition-all select-none relative',
                message.role === 'user' ? 'flex-row pb-2 justify-end pr-2.5' : 'flex-row pb-4 gap-4',
                isSelectionMode && selectedMessageIds.has(message.id) && 'opacity-100 scale-[1.02]',
                isSelectionMode && !selectedMessageIds.has(message.id) && 'opacity-50',
                editingMessageId === message.id && 'ring-2 ring-electric-blue ring-offset-4 ring-offset-black-deep rounded-2xl'
              )}
            >
              {isSelectionMode && (
                <div className="flex items-center self-center px-2">
                  {selectedMessageIds.has(message.id) ? (
                    <CheckSquare className="text-[var(--logo-gradient-start)]" size={24} />
                  ) : (
                    <Square className="text-muted opacity-50" size={24} />
                  )}
                </div>
              )}
              <div
                className={cn(
                  'text-sm leading-relaxed relative transition-all duration-300',
                  message.role === 'user'
                    ? cn(
                        'px-4 py-2.5 rounded-2xl rounded-tr-[5px] bg-gradient-to-r from-[var(--logo-gradient-start)] to-[var(--logo-gradient-mid)] text-white shadow-md text-left self-end break-words w-fit max-w-[85%] relative',
                        editingMessageId === message.id ? 'w-full min-w-[280px] sm:min-w-[400px]' : ''
                      )
                    : 'w-full p-0 bg-transparent text-foreground border-none shadow-none'
                )}
              >
                {message.role === 'user' && (
                  <div
                    className="absolute -top-2 -right-2 w-[24px] h-[24px] rounded-full flex items-center justify-center shrink-0 shadow-md overflow-hidden border border-white/20 bg-gradient-to-br from-[var(--logo-gradient-start)] to-[var(--logo-gradient-mid)] select-none z-10 transition-transform group-hover:scale-110 pointer-events-none"
                  >
                    {auth.currentUser?.photoURL ? (
                      <img src={auth.currentUser.photoURL} alt="User" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                    ) : (
                      <User size={12} className="text-white" />
                    )}
                  </div>
                )}
                {editingMessageId === message.id ? (
                  <div className="space-y-3">
                    <textarea
                      autoFocus
                      value={editingContent}
                      onChange={(e) => setEditingContent(e.target.value)}
                      className="w-full bg-black/35 border border-white/30 rounded-lg p-3 text-white focus:outline-none focus:ring-1 focus:ring-white/40 resize-none min-h-[100px]"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          saveEdit();
                        }
                        if (e.key === 'Escape') {
                          setEditingMessageId(null);
                        }
                      }}
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingMessageId(null);
                        }}
                        className="px-3 py-1 rounded-lg text-xs font-bold hover:bg-white/10 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          saveEdit();
                        }}
                        className="px-3 py-1 rounded-lg bg-white text-electric-blue text-xs font-bold hover:bg-white/90 transition-colors"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className={cn(
                    message.role === 'user' 
                      ? "text-white text-sm"
                      : "prose prose-sm max-w-none chatbot-prose prose-p:leading-relaxed prose-pre:bg-black-deep prose-pre:text-cyan-bright"
                  )}>
                    {/* The AI Logo floating to the left so text wraps around/under it seamlessly */}
                    {message.role !== 'user' && (
                      <div className="float-left mr-3 mb-1 mt-0 w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-lg border border-[var(--glow-color-strong)] bg-gray-dark/40 backdrop-blur-md select-none" style={{ colorScheme: 'light dark' }}>
                        <div className="w-full h-full rounded-full flex items-center justify-center bg-gradient-to-br from-[var(--logo-gradient-start)]/30 to-transparent">
                          <NefronLogo className="w-5 h-5 text-[var(--logo-gradient-start)] drop-shadow-md" />
                        </div>
                      </div>
                    )}
                    {message.role === 'user' ? (
                      <div className="pr-5 mr-0.5">
                        <ReactMarkdown components={{ p: ({children}) => <p className="m-0 leading-normal">{children}</p> }}>{message.content.trim()}</ReactMarkdown>
                      </div>
                    ) : (
                      (() => {
                        const isOwner = auth.currentUser?.email === 'p26893150@gmail.com';
                        let cleanContent = message.content;
                        if (!isOwner) {
                          const lower = cleanContent.toLowerCase();
                          if (
                            lower.includes('quota') ||
                            lower.includes('resource has been exhausted') ||
                            lower.includes('cluster hit rate limits') ||
                            lower.includes('all keys have been automatically cycled') ||
                            lower.includes('api key') ||
                            lower.includes('all key attempts exhausted') ||
                            cleanContent.includes('AI Connection Notice') ||
                            cleanContent.includes('AI Connection Error')
                          ) {
                            cleanContent = "We are currently experiencing high traffic. Please feel free to ask your question again.";
                          }
                        }
                        return <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{cleanContent}</ReactMarkdown>;
                      })()
                    )}
                  </div>
                )}
              </div>
            </div>
          // eslint-disable-next-line react-hooks/exhaustive-deps
          )), [messages, isSelectionMode, selectedMessageIds, editingMessageId, editingContent, auth.currentUser?.photoURL])}

        {quotaError && auth.currentUser?.email === 'p26893150@gmail.com' && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 text-center animate-in fade-in slide-in-from-bottom-2 duration-500">
              <p className="text-red-500 text-xs font-bold uppercase tracking-widest mb-1 neon-glow">⚡ Firestore Quota Exceeded</p>
              <p className="text-muted text-[10px] sm:text-xs leading-relaxed max-w-sm mx-auto">
                You have reached your daily read limit for the free tier. 
                Your message history may be incomplete. Quota will reset at midnight.
              </p>
            </div>
          )}

          {errorMessage && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 text-center animate-in fade-in slide-in-from-bottom-2 duration-500">
              <p className="text-red-500 text-xs font-bold uppercase tracking-widest mb-1 neon-glow">Connection Error</p>
              <p className="text-muted text-[10px] sm:text-xs leading-relaxed max-w-sm mx-auto">
                {auth.currentUser?.email === 'p26893150@gmail.com' ? errorMessage : "A temporary connection interruption occurred. Please try sending your message again."}
              </p>
              <button onClick={() => setErrorMessage(null)} className="mt-4 text-xs text-white underline">Dismiss</button>
            </div>
          )}

          {streamingMessage !== null && (
            <div className="flex flex-row pb-4 relative w-full">
              <div className="text-sm leading-relaxed relative w-full bg-transparent text-foreground border-none shadow-none p-0">
                <div className="prose prose-sm max-w-none chatbot-prose prose-p:leading-relaxed prose-pre:bg-black-deep prose-pre:text-cyan-bright">
                  {/* The AI Logo floating to the left */}
                  <div className="float-left mr-3 sm:mr-4 md:mr-5 mb-2 mt-1 w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-lg border border-gray-dark/50 bg-gray-dark/40 backdrop-blur-md select-none">
                    <div className="w-[84%] h-[84%] rounded-full border border-gray-dark/30 flex items-center justify-center">
                      <NefronLogo className="w-5 h-5 text-[var(--logo-gradient-start)]" />
                    </div>
                  </div>
                  <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{streamingMessage}</ReactMarkdown>
                  {streamingMessage === '' && (
                    <div className="flex items-center gap-2 mt-2 bg-gray-dark/35 px-4 py-2 rounded-full border border-gray-dark/40 backdrop-blur-sm w-fit animate-pulse">
                      <span className="w-1.5 h-1.5 bg-[var(--logo-gradient-start)] rounded-full"></span>
                      <span className="text-xs text-foreground/90 font-medium tracking-wide">
                        {thinkingStage}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          {isLoading && streamingMessage === null && (
            <div className="flex gap-4 pb-4 relative w-full items-start">
              <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 shadow-lg border border-gray-dark/50 bg-gray-dark/40 backdrop-blur-md">
                <div className="w-[84%] h-[84%] rounded-full border border-gray-dark/30 flex items-center justify-center">
                  <NefronLogo className="w-6 h-6 text-muted" />
                </div>
              </div>
              <div className="flex flex-col gap-2.5 w-full max-w-lg mt-2">
                <Skeleton className="h-4 w-[90%] rounded-md bg-gray-dark/40" />
                <Skeleton className="h-4 w-[75%] rounded-md bg-gray-dark/40" />
                <Skeleton className="h-4 w-[60%] rounded-md bg-gray-dark/40" />
                <div className="flex items-center gap-2 mt-1 bg-gray-dark/35 px-4 py-2 rounded-full border border-gray-dark/40 backdrop-blur-sm w-fit animate-pulse">
                  <span className="w-1.5 h-1.5 bg-[var(--logo-gradient-start)] rounded-full" />
                  <span className="text-xs text-foreground/95 font-semibold tracking-wide">
                    {thinkingStage}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Suggested Follow-up Questions to make perfect use of empty vertical space */}
          {!isLoading && streamingMessage === null && messages.length > 0 && suggestedFollowUps.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              className="pt-2 pb-4 flex flex-col gap-3 w-full"
            >
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--logo-gradient-start)] animate-pulse" />
                <span className="text-[10px] sm:text-xs font-bold text-muted uppercase tracking-widest">
                  Suggest follow ups
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {suggestedFollowUps.map((item, idx) => (
                  <button
                    key={idx}
                    disabled={isLoading}
                    onClick={() => {
                      if (isLoading) return;
                      setInput(item.text);
                      setTimeout(() => handleSend(item.text), 50);
                    }}
                    className={cn(
                      "text-xs px-4 py-2.5 rounded-xl border border-gray-dark/45 bg-gray-dark/30 text-foreground/80 hover:border-[var(--logo-gradient-start)] hover:bg-[var(--logo-gradient-start)]/10 hover:text-foreground transition-all duration-300 text-left cursor-pointer shadow-sm",
                      isLoading && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>

      <div className="absolute bottom-0 inset-x-0 pb-4 pt-1 px-4 bg-transparent border-none shadow-none outline-none z-10">
        <AnimatePresence>
          {isSelectionMode && (
            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              className="absolute inset-x-0 bottom-full mb-6 flex justify-center px-4 z-50"
            >
              <div className="bg-gray-dark border border-gray-dark/50 rounded-2xl shadow-2xl p-4 flex flex-col sm:flex-row items-center gap-4 sm:gap-6 backdrop-blur-xl w-full max-w-md sm:max-w-none">
                <div className="flex flex-col items-center sm:items-start">
                  <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Selection Mode</span>
                  <span className="text-sm font-bold text-foreground whitespace-nowrap">{selectedMessageIds.size} messages selected</span>
                </div>
                <div className="hidden sm:block h-8 w-px bg-gray-700/50" />
                <div className="flex flex-wrap sm:flex-nowrap items-center justify-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => {
                      if (selectedMessageIds.size === messages.length) {
                        setSelectedMessageIds(new Set());
                      } else {
                        setSelectedMessageIds(new Set(messages.map(m => m.id)));
                      }
                    }}
                    className="flex-1 sm:flex-none px-3 py-2 rounded-xl text-xs font-bold text-foreground hover:bg-black-deep transition-colors border border-foreground/10 whitespace-nowrap"
                  >
                    {selectedMessageIds.size === messages.length ? 'Deselect All' : 'Select All'}
                  </button>
                  <button
                    onClick={() => {
                      setIsSelectionMode(false);
                      setSelectedMessageIds(new Set());
                    }}
                    className="flex-1 sm:flex-none px-3 py-2 rounded-xl text-xs font-bold text-muted hover:bg-black-deep transition-colors whitespace-nowrap"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={deleteSelectedMessages}
                    disabled={selectedMessageIds.size === 0}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed font-bold text-xs"
                  >
                    <Trash2 size={16} />
                    Delete
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className={cn(
          "relative flex items-center max-w-5xl mx-auto w-full bg-gray-dark/95 backdrop-blur-md border border-gray-dark/45 shadow-2xl rounded-full p-1.5 transition-all",
          isHybridMode && "ring-2 ring-[var(--logo-gradient-start)] border-transparent"
        )}>
          {isListening && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute -top-16 left-0 right-0 flex justify-center pointer-events-none"
            >
              <div className="bg-[var(--logo-gradient-start)] text-white px-6 py-2 rounded-full shadow-xl flex items-center gap-3 animate-pulse">
                <div className="flex gap-1">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: `${i * 0.1}s` }} />
                  ))}
                </div>
                <span className="text-sm font-bold tracking-wider">LISTENING...</span>
                <div className="flex items-center gap-2 ml-2 border-l border-white/20 pl-2">
                  <button 
                    onClick={() => {
                      setIsHybridMode(false);
                      setIsListening(false);
                      if (recognitionRef.current) recognitionRef.current.stop();
                      stopTTS();
                    }}
                    className="pointer-events-auto text-[10px] font-bold uppercase tracking-tighter hover:bg-white/20 px-2 py-1 rounded"
                  >
                    Exit
                  </button>
                  <button 
                    onClick={() => {
                      setIsListening(false);
                      if (recognitionRef.current) recognitionRef.current.stop();
                    }}
                    className="pointer-events-auto p-1 hover:bg-white/20 rounded-full"
                  >
                    <CloseIcon size={14} />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          <input
            type="text"
            value={input}
            disabled={isLoading}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={isLoading ? "AI is thinking..." : (isHybridMode ? "Voice-to-Chat Mode Active..." : "Type your message...")}
            className={cn(
              "flex-1 bg-transparent border-none pl-6 pr-28 py-3 text-foreground focus:outline-none placeholder:text-muted/60 text-base transition-opacity",
              isLoading && "opacity-50 cursor-not-allowed"
            )}
          />
          <div className="absolute right-1.5 flex items-center gap-1.5" ref={micMenuRef}>
            <div className="relative">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={async () => {
                      if (isLoading) return;
                      try {
                        // Request permission first to ensure user intent is captured
                        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                        stream.getTracks().forEach(track => track.stop());
                        
                        if (isHybridMode && !isListening) {
                          startListening();
                        } else {
                          setIsMicMenuOpen(!isMicMenuOpen);
                        }
                      } catch (error) {
                        console.error("Microphone permission denied:", error);
                        // Still open the menu so user can see options, but they might fail later
                        setIsMicMenuOpen(!isMicMenuOpen);
                      }
                    }}
                    disabled={isLoading}
                    className={cn(
                      "p-2 rounded-full transition-all active:scale-90 neon-glow h-10 w-10 flex items-center justify-center",
                      isLoading ? "opacity-30 cursor-not-allowed pointer-events-none" : "hover:scale-105 active:scale-95",
                      isHybridMode ? "bg-[var(--logo-gradient-start)] text-white" : "bg-gray-dark/40 border border-gray-dark/30 text-[var(--logo-gradient-mid)] hover:bg-gray-dark/80",
                      isListening && "animate-pulse ring-4 ring-[var(--logo-gradient-start)]/30"
                    )}
                  >
                    <Mic size={18} />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Voice mode</TooltipContent>
              </Tooltip>

              <AnimatePresence>
                {isMicMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute bottom-full right-0 mb-4 w-64 bg-gray-dark border border-gray-dark/50 rounded-2xl shadow-2xl z-50 overflow-hidden"
                  >
                    <div className="p-2 space-y-1">
                      <button
                        onClick={() => {
                          if (userId) {
                            const userData = storage.get(`nefron_prefs_${userId}`, { hasGrantedMicPermission: false, micPromptDismissed: false });
                            if (!userData.hasGrantedMicPermission) {
                              storage.set(`nefron_prefs_${userId}`, { ...userData, micPromptDismissed: false });
                              window.dispatchEvent(new Event('nefron_request_mic_prompt'));
                              setIsMicMenuOpen(false);
                              return;
                            }
                          }
                          setIsVoiceChatOpen(true);
                          setIsMicMenuOpen(false);
                          setIsHybridMode(false);
                        }}
                        className="w-full flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-black-deep transition-colors text-left"
                      >
                        <div className="p-2 rounded-lg bg-gradient-to-br from-[var(--logo-gradient-start)] to-[var(--logo-gradient-end)] text-white">
                          <Headphones size={18} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-foreground">Full Voice Chat</p>
                          <p className="text-[10px] text-muted uppercase tracking-wider">Immersive Experience</p>
                        </div>
                      </button>

                      <button
                        onClick={() => {
                          if (!isHybridMode && userId) {
                            const userData = storage.get(`nefron_prefs_${userId}`, { hasGrantedMicPermission: false, micPromptDismissed: false });
                            if (!userData.hasGrantedMicPermission) {
                              storage.set(`nefron_prefs_${userId}`, { ...userData, micPromptDismissed: false });
                              window.dispatchEvent(new Event('nefron_request_mic_prompt'));
                              setIsMicMenuOpen(false);
                              return;
                            }
                          }
                          const newMode = !isHybridMode;
                          setIsHybridMode(newMode);
                          setIsMicMenuOpen(false);
                          if (!newMode) {
                            stopTTS();
                            setIsListening(false);
                          } else {
                            startListening();
                          }
                        }}
                        className={cn(
                          "w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-colors text-left",
                          isHybridMode ? "bg-[var(--logo-gradient-start)]/10" : "hover:bg-black-deep"
                        )}
                      >
                        <div className={cn(
                          "p-2 rounded-lg text-white",
                          isHybridMode ? "bg-[var(--logo-gradient-start)]" : "bg-gray-dark border border-gray-700"
                        )}>
                          <MessageSquare size={18} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-foreground">Chated Voice</p>
                          <p className="text-[10px] text-muted uppercase tracking-wider">Voice-to-Text Hybrid</p>
                        </div>
                        {isHybridMode && <div className="ml-auto w-2 h-2 rounded-full bg-[var(--logo-gradient-start)] animate-pulse" />}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isLoading}
                  style={{ 
                    background: `linear-gradient(135deg, var(--btn-bg-start), var(--btn-bg-mid), var(--btn-bg-end))`,
                    color: 'var(--btn-text)'
                  }}
                  className={cn(
                    "p-2 rounded-full transition-all duration-300 active:scale-90 neon-glow-intense h-10 w-10 flex items-center justify-center",
                    (isLoading || !input.trim()) ? "opacity-30 cursor-not-allowed pointer-events-none scale-100" : "hover:scale-105 active:scale-95"
                  )}
                >
                  <Send size={18} strokeWidth={3} className="drop-shadow-[0_0_2px_rgba(255,255,255,0.3)] ml-0.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Send message</TooltipContent>
            </Tooltip>
          </div>
        </div>
        <p className="text-center text-[9px] text-muted mt-1 uppercase tracking-widest opacity-40 select-none">
          Nefron AI can make mistakes. Check important info.
        </p>
      </div>

      <VoiceChat 
        isOpen={isVoiceChatOpen} 
        onClose={() => setIsVoiceChatOpen(false)} 
        userId={userId}
      />
      </div>
    </TooltipProvider>
  );
}
