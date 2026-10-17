'use client';

import * as React from 'react';
import { SplashScreen } from './splash-screen';
import { cn } from '@/lib/utils';
import { NefronLogo, CometIcon } from './icons';
import { Info, ChevronLeft, Settings, Sun, Moon, Check, Sparkles, History, LogOut, User as UserIcon, X as CloseIcon, Trash2, Loader2, Mic, Database, Activity, BarChart3, AlertCircle, Flag, Key } from 'lucide-react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'motion/react';
import { auth, googleProvider, signInWithPopup, onAuthStateChanged, User, db } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { storage } from '../lib/storage';
import { geminiManager } from '../lib/gemini-manager';

import { ErrorBoundary } from './error-boundary';
import { AboutPage } from './about-page';
import { ChatHistoryItem } from './chat-history-item';
import { TrainingInterface } from './training-interface';
import { ExperiencePage } from './experience-page';
import { DashboardStats } from './dashboard-stats';
import { ReportPage } from './report-page';
import { ApiKeysManagement } from './api-keys-management';
import { PrivacyPolicyModal } from './privacy-policy-modal';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { startTracking, trackLogout, setTrackingState } from '../lib/tracking';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface Chat {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = React.useState(true);
  const [splashFinished, setSplashFinished] = React.useState(false);
  const [user, setUser] = React.useState<User | null>(null);
  const [theme, setTheme] = React.useState<'dark' | 'light'>(() => {
    // Fallback to light golden default for first-time or pre-golden visits
    const isGolden = storage.getItemString('nefron-setup-golden');
    if (!isGolden) return 'light';
    return (storage.getItemString('nefron-theme') as 'dark' | 'light') || 'light';
  });
  const [colorTheme, setColorTheme] = React.useState<'purple' | 'electric' | 'golden'>(() => {
    // Fallback to light golden default for first-time or pre-golden visits
    const isGolden = storage.getItemString('nefron-setup-golden');
    if (!isGolden) return 'golden';
    return (storage.getItemString('nefron-color-theme') as 'purple' | 'electric' | 'golden') || 'golden';
  });
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const [menuView, setMenuView] = React.useState<'main' | 'settings'>('main');
  const [onboardingStep, setOnboardingStep] = React.useState<number>(0);

  const setStep = (step: number) => {
    setOnboardingStep(step);
    localStorage.setItem('onboarding_step', step.toString());
    window.dispatchEvent(new Event('onboarding_step_changed'));
  };

  React.useEffect(() => {
    const handle = () => {
      setOnboardingStep(parseInt(localStorage.getItem('onboarding_step') || '0'));
    };
    window.addEventListener('onboarding_step_changed', handle);
    return () => window.removeEventListener('onboarding_step_changed', handle);
  }, []);

  const [activePage, setActivePage] = React.useState<'ai' | 'about' | 'training' | 'experience' | 'stats' | 'report' | 'apikeys'>(() => {
    // Always default to about on fresh load if not specified
    return 'about';
  });
  const [isHistoryOpen, setIsHistoryOpen] = React.useState(false);
  const [authError, setAuthError] = React.useState<string | null>(null);
  const [chats, setChats] = React.useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = React.useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = React.useState(false);
  const [quotaError, setQuotaError] = React.useState<boolean>(false);
  const [hasGrantedMic, setHasGrantedMic] = React.useState<boolean | null>(null);
  const [showMicPrompt, setShowMicPrompt] = React.useState(false);
  const [micError, setMicError] = React.useState<string | null>(null);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = React.useState(false);
  const settingsRef = React.useRef<HTMLDivElement>(null);
  const historyRef = React.useRef<HTMLDivElement>(null);
  const longPressTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const hasInitializedRef = React.useRef(false);

  React.useEffect(() => {
    geminiManager.fetchStatuses().catch(e => console.error("Error fetching statuses on mount:", e));
  }, []);

  React.useEffect(() => {
    if (user && hasGrantedMic !== null && !showMicPrompt) {
      const isCompleted = storage.get(`onboarding_completed_${user.uid}`, false);
      if (!isCompleted) {
        if (onboardingStep === 0) setStep(1);
      } else {
        if (onboardingStep !== 0) setStep(0);
      }
    }
  }, [user, hasGrantedMic, showMicPrompt, onboardingStep]);

  const generateAnonymousName = () => {
    const adjectives = ['Visionary', 'Echo', 'Sonic', 'Harmonic', 'Strategic', 'Quantum', 'Ethereal', 'Resonant', 'Dynamic', 'Stellar'];
    const nouns = ['Session', 'Dialogue', 'Vision', 'Frequency', 'Pulse', 'Nexus', 'Thread', 'Stream', 'Wave', 'Core'];
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const num = Math.floor(Math.random() * 900) + 100;
    return `${adj} ${noun} #${num}`;
  };

  // Auth listener
  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // FIRST: Check if this email is restricted!
        try {
          if (currentUser.email) {
            const emailKey = currentUser.email.toLowerCase().trim();
            const restrictionRef = doc(db, 'restrictions', emailKey);
            const restrictionSnap = await getDoc(restrictionRef);
            if (restrictionSnap.exists()) {
              setAuthError("oops something whent wrong ");
              await auth.signOut();
              setUser(null);
              setLoading(false);
              return;
            }
          }
        } catch (e: any) {
          const errMsg = e?.message || String(e);
          if (errMsg.includes('offline') || e?.code === 'unavailable') {
            console.warn("Could not check user restriction because client is offline.");
          } else {
            console.error("Error checking user restriction:", e);
          }
        }

        // Check if this is the first time the app is being initialized for this user/browser
        // Using a fresh key to ensure the new defaults are applied to existing users who haven't set preferences
        try {
          const isGoldenInitialized = storage.getItemString('nefron-setup-golden');
          
          if (!isGoldenInitialized) {
            // Upgrade to beautiful Light Golden theme by default to match the requested design
            setTheme('light');
            setColorTheme('golden');
            storage.setItemString('nefron-theme', 'light');
            storage.setItemString('nefron-color-theme', 'golden');
            storage.setItemString('nefron-setup-golden', 'true');
            storage.setItemString('nefron-setup-final', 'true');
          }
        } catch (e) {
          console.warn("LocalStorage access failed:", e);
        }

        // Start tracking activity!
        if (currentUser.uid && currentUser.email) {
          startTracking(currentUser.uid, currentUser.email);
        }

        // SYNC: Check if the Firestore user profile exists.
        // If the profile document does NOT exist in Firestore (because it was removed/erased by admin),
        // we reset local preferences so they are prompted for mic permission again!
        try {
          const userDocRef = doc(db, 'users', currentUser.uid);
          const userSnap = await getDoc(userDocRef);
          if (!userSnap.exists()) {
            // Document was deleted/erased by admin, reset their mic permission local state!
            storage.removeItem(`nefron_prefs_${currentUser.uid}`);
            setHasGrantedMic(false);
            setShowMicPrompt(true);
          } else {
            const dbData = userSnap.data();
            if (dbData && dbData.hasGrantedMicPermission) {
              const localData = storage.get(`nefron_prefs_${currentUser.uid}`, { hasGrantedMicPermission: false, micPromptDismissed: false });
              storage.set(`nefron_prefs_${currentUser.uid}`, { ...localData, hasGrantedMicPermission: true });
              setHasGrantedMic(true);
              setShowMicPrompt(false);
            }
          }
        } catch (e) {
          console.warn("Error checking DB user profile:", e);
        }
      }
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []); // Empty dependency array for the listener

  // Synchronize active pages with tracking system
  React.useEffect(() => {
    setTrackingState('about', activePage === 'about');
    setTrackingState('chat_box', activePage === 'ai');
  }, [activePage]);

  // Fetch chats
  React.useEffect(() => {
    if (!user) {
      setChats([]);
      hasInitializedRef.current = false;
      return;
    }

    const chatList = storage.get<Chat[]>(`nefron_chats_${user.uid}`, []);
    setChats(chatList);
    
    // Only auto-select on the VERY FIRST load of a non-empty chat list
    if (!hasInitializedRef.current && chatList.length > 0) {
      setCurrentChatId(chatList[0].id);
      hasInitializedRef.current = true;
    }
  }, [user]);

  // Fetch user profile for mic permission
  React.useEffect(() => {
    if (!user) {
      setHasGrantedMic(null);
      setShowMicPrompt(false);
      return;
    }
    
    const userData = storage.get(`nefron_prefs_${user.uid}`, { hasGrantedMicPermission: false, micPromptDismissed: false });
    setHasGrantedMic(userData.hasGrantedMicPermission || false);
    
    if (userData.hasGrantedMicPermission !== true && !userData.micPromptDismissed) {
      setShowMicPrompt(true);
    } else {
      setShowMicPrompt(false);
    }

    const handleRequestMic = () => {
      setShowMicPrompt(true);
    };
    window.addEventListener('nefron_request_mic_prompt', handleRequestMic);
    return () => window.removeEventListener('nefron_request_mic_prompt', handleRequestMic);
  }, [user]);

  const handleGrantMicPermission = async () => {
    setMicError(null);
    try {
      // Check if mediaDevices is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('MediaDevicesNotSupported');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      
      if (user) {
        const userData = storage.get(`nefron_prefs_${user.uid}`, { hasGrantedMicPermission: false, micPromptDismissed: false });
        storage.set(`nefron_prefs_${user.uid}`, { ...userData, hasGrantedMicPermission: true });

        // Save to Firestore as well!
        try {
          await setDoc(doc(db, 'users', user.uid), {
            hasGrantedMicPermission: true,
            updatedAt: new Date().toISOString(),
            userId: user.uid
          });
        } catch (dbErr) {
          console.error("Failed to save mic permission to Firestore:", dbErr);
        }
      }
      setHasGrantedMic(true);
      setShowMicPrompt(false);
    } catch (error: any) {
      console.error("Microphone permission denied during prompt:", error);
      
      const isIframe = typeof window !== 'undefined' && window.self !== window.top;
      
      const isOwner = auth.currentUser?.email === 'p26893150@gmail.com';
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError' || error.message?.includes('denied')) {
        setMicError(
          isIframe 
            ? "Microphone access was denied. Browsers often block microphone access inside previews. Please click 'Open in New Tab' at the top right of the screen to use voice features."
            : "Microphone access was denied. Please check your browser's address bar or site settings to 'Allow' microphone access."
        );
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError' || error.message?.includes('Requested device not found') || error.message?.includes('device not found')) {
        setMicError(isOwner ? "No microphone was found on your device. Please connect a microphone and try again." : "We couldn't detect a microphone, please make sure it's connected properly.");
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        setMicError(isOwner ? "Your microphone is already in use by another application." : "Your microphone seems to be busy, please check if another app is using it.");
      } else if (error.message === 'MediaDevicesNotSupported') {
        setMicError(isOwner ? "Your browser does not support microphone access in this context." : "It looks like your browser doesn't support this feature right now.");
      } else {
        setMicError(isOwner ? `Microphone error: ${error.message || 'Unknown error'}. Please try again.` : "We ran into a tiny issue, please try again.");
      }
    }
  };

  const handleSkipMicPermission = async () => {
    if (user) {
      const userData = storage.get(`nefron_prefs_${user.uid}`, { hasGrantedMicPermission: false, micPromptDismissed: false });
      storage.set(`nefron_prefs_${user.uid}`, { ...userData, hasGrantedMicPermission: false, micPromptDismissed: true });
    }
    setShowMicPrompt(false);
  };

  const createNewChat = async () => {
    if (!user) return null;
    // If already in a new/empty chat state, don't create another one
    if (currentChatId === null) return null;
    
    // Just set currentChatId to null to indicate a "new chat" state
    // The actual Firestore document will be created when the first message is sent
    setCurrentChatId(null);
    setIsHistoryOpen(false);
    return null;
  };

  // This is called by ChatInterface when the first message is sent in a null chatId state
  const handleNewChatCreation = async () => {
    if (!user) return null;
    const newChat: Chat = {
      id: Date.now().toString(),
      title: 'New Vision Session',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    const chatList = storage.get<Chat[]>(`nefron_chats_${user.uid}`, []);
    const updatedChats = [newChat, ...chatList];
    storage.set(`nefron_chats_${user.uid}`, updatedChats);
    setChats(updatedChats);
    setCurrentChatId(newChat.id);
    return newChat.id;
  };

  const deleteChat = async (id: string) => {
    if (!user) return;
    const chatList = storage.get<Chat[]>(`nefron_chats_${user.uid}`, []);
    const updatedChats = chatList.filter((c) => c.id !== id);
    storage.set(`nefron_chats_${user.uid}`, updatedChats);
    setChats(updatedChats);
    if (currentChatId === id) {
      setCurrentChatId(null);
    }
  };

  const handleLongPressStart = () => {
    longPressTimerRef.current = setTimeout(() => {
      setIsHistoryOpen(true);
    }, 1200);
  };

  const handleLongPressEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      if (error && (error.code === 'auth/popup-closed-by-user' || (error.message && error.message.includes('popup-closed-by-user')))) {
        console.warn("Login cancelled: Popup was closed by user.");
        setAuthError("The login popup was closed before completion. Please try again.");
      } else {
        console.error("Login failed:", error);
        if (error.code === 'auth/unauthorized-domain') {
          const currentDomain = window.location.hostname;
          setAuthError(`This domain (${currentDomain}) is not authorized. Please make sure you added the domain to the NEW studio-8672... project.`);
        } else {
          setAuthError("We encountered a hiccup during login. If you are in the preview, please open the app in a new tab.");
        }
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    // Clear local state immediately for perceived performance
    setCurrentChatId(null);
    try {
      sessionStorage.removeItem('nefron_narrator_greeted');
    } catch(e) {}
    
    // Non-blocking logout tracking
    if (user?.uid) {
      trackLogout(user.uid).catch(console.error);
    }
    
    await auth.signOut();
  };

  // Initialize theme from localStorage as soon as possible is now handled by lazy state initialization
  React.useLayoutEffect(() => {
    // We still apply the theme to the document element here to ensure it's set before first paint
    if (theme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
    document.documentElement.setAttribute('data-color-theme', colorTheme);
  }, []);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
        setMenuView('main');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleTheme = (newTheme: 'dark' | 'light') => {
    setTheme(newTheme);
    storage.setItemString('nefron-theme', newTheme);
  };

  const toggleColorTheme = (newColorTheme: 'purple' | 'electric' | 'golden') => {
    setColorTheme(newColorTheme);
    storage.setItemString('nefron-color-theme', newColorTheme);
  };

  React.useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
      document.body.style.backgroundColor = colorTheme === 'golden' ? '#FAF6EE' : '#F1F5F9';
    } else {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
      document.body.style.backgroundColor = colorTheme === 'golden' ? '#0F0E0C' : '#0B0C10';
    }
    document.documentElement.setAttribute('data-color-theme', colorTheme);
  }, [theme, colorTheme]);

  const handleSplashFinished = React.useCallback(() => {
    setSplashFinished(true);
  }, []);

  if (!splashFinished) {
    return <SplashScreen onFinished={handleSplashFinished} />;
  }

  if (loading) {
    return null; // Auth is still checking, but splash is done (unlikely given 7s duration)
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-black-deep flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-gray-dark border border-foreground/10 rounded-3xl p-8 text-center shadow-2xl">
          <NefronLogo className="w-20 h-20 mx-auto mb-6" />
          <h1 className="text-3xl font-headline tracking-widest neon-glow bg-gradient-to-r from-[var(--logo-gradient-start)] via-[var(--logo-gradient-mid)] to-[var(--logo-gradient-end)] bg-clip-text text-transparent mb-4">
            Nefron Audio
          </h1>
          <p className="text-muted mb-8">Sign in to access your visionary audio AI assistant and keep your conversations synced.</p>
          
          {authError && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex flex-col gap-3">
              <p className="text-red-500 text-sm">{authError}</p>
              {typeof window !== 'undefined' && window.self !== window.top && (
                <a 
                  href={window.location.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] font-bold uppercase tracking-widest text-red-500 underline decoration-red-500/30 hover:decoration-red-500 transition-all text-center block"
                >
                  Open in New Tab ↗
                </a>
              )}
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={isLoggingIn}
            className={cn(
              "w-full py-4 rounded-2xl bg-electric-blue text-white font-bold hover:bg-electric-blue/90 transition-all shadow-lg shadow-electric-blue/20 flex items-center justify-center gap-3",
              isLoggingIn && "opacity-70 cursor-not-allowed"
            )}
          >
            {isLoggingIn ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                Signing in...
              </>
            ) : (
              <>
                <UserIcon size={20} />
                Continue with Google
              </>
            )}
          </button>
          
          <p className="mt-6 text-[10px] text-muted uppercase tracking-widest">
            Ensure popups are enabled for this site
          </p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <TooltipProvider delayDuration={100}>
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        transition={{ duration: 1, ease: "easeOut" }}
        className={cn('min-h-screen transition-colors duration-300 bg-black-deep')}
      >
        <div className="flex flex-col min-h-screen">
          <div className={cn("absolute top-0 left-0 right-0 p-4 flex items-center justify-between pointer-events-none transition-all duration-300", onboardingStep > 0 ? "" : "z-50")}>
            <AnimatePresence>
              {quotaError && user?.email === 'p26893150@gmail.com' && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="absolute top-0 left-0 right-0 bg-red-500/20 text-red-400 text-[10px] py-1.5 px-4 text-center font-bold tracking-widest border-b border-red-500/30 overflow-hidden leading-tight pointer-events-auto"
                >
                  ⚡ FIRESTORE QUOTA EXCEEDED. READS ARE CURRENTLY LIMITED. RESET AT MIDNIGHT. <br className="sm:hidden" />
                  SEE MORE AT FIREBASE.GOOGLE.COM/PRICING
                </motion.div>
              )}
            </AnimatePresence>
            
            {activePage === 'stats' ? (
              <div />
            ) : (
              <div className={cn("flex items-center gap-2 px-4 py-2.5 rounded-full border border-gray-dark/45 backdrop-blur-md shadow-lg pointer-events-auto transition-transform hover:scale-[1.02]", theme === 'light' ? "bg-white/40" : "bg-black/40", onboardingStep > 0 ? "relative z-40" : "")}>
                <NefronLogo className="w-5 h-5 md:w-6 h-6 text-[var(--logo-gradient-start)]" />
                <h2 className={cn("text-xl sm:text-2xl font-headline tracking-widest bg-gradient-to-r from-[var(--logo-gradient-start)] via-[var(--logo-gradient-mid)] to-[var(--logo-gradient-end)] bg-clip-text text-transparent whitespace-nowrap", theme === 'light' ? "font-semibold" : "font-bold")}>
                  Nefron Audio
                </h2>
              </div>
            )}
            
            <div className="flex items-center gap-2 pointer-events-auto">
              {/* New Chat Button - Only visible on AI page */}
              {activePage === 'ai' && (
                <div className={cn("relative", onboardingStep > 0 ? "z-40" : "")} ref={historyRef}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={createNewChat}
                        onMouseDown={handleLongPressStart}
                        onMouseUp={handleLongPressEnd}
                        onMouseLeave={handleLongPressEnd}
                        onTouchStart={handleLongPressStart}
                        onTouchEnd={handleLongPressEnd}
                        className={cn(
                          "relative flex items-center gap-2 px-4 py-2 rounded-full border border-gray-dark/40 backdrop-blur-md text-foreground shadow-lg transition-all duration-300 group overflow-hidden",
                          theme === 'light' ? "bg-white/40 hover:bg-white/60" : "bg-black/40 hover:bg-black/60"
                        )}
                      >
                        {/* Animated background glow */}
                        <div className="absolute inset-0 bg-gradient-to-r from-electric-blue/10 to-electric-green/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        
                        {/* Shimmer effect */}
                        <motion.div
                          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12"
                          initial={{ x: '-100%' }}
                          animate={{ x: '200%' }}
                          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                        />
                        
                        <Sparkles size={18} className="relative z-10 group-hover:rotate-12 transition-transform" />
                        <span className="relative z-10 text-xs font-bold tracking-widest uppercase hidden sm:block">New Vision</span>
                        
                        {/* Pulsing ring */}
                        <div className="absolute inset-0 rounded-full border border-electric-blue/50 animate-ping opacity-20 group-hover:opacity-40" />
                      </motion.button>
                    </TooltipTrigger>
                    <TooltipContent>New Vision (Long press for history)</TooltipContent>
                  </Tooltip>
                  {/* History menu remains here... */}
                  <AnimatePresence>
                    {isHistoryOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute right-0 top-full mt-2 w-72 bg-gray-dark border border-foreground/10 rounded-xl shadow-2xl z-50 overflow-hidden"
                      >
                        <div className="p-2">
                          <div className="flex items-center justify-between px-3 py-2 border-b border-foreground/5 mb-2">
                            <div className="flex items-center gap-2 text-muted">
                              <History size={14} />
                              <span className="text-[10px] font-bold uppercase tracking-widest">Recent Chats</span>
                            </div>
                            <button 
                              onClick={() => setIsHistoryOpen(false)}
                              className="text-muted hover:text-foreground"
                            >
                              <CloseIcon size={14} />
                            </button>
                          </div>
                          <div className="max-h-64 overflow-y-auto space-y-1 custom-scrollbar">
                            {chats.length === 0 ? (
                              <p className="text-center py-4 text-xs text-muted italic">No recent chats</p>
                            ) : (
                              chats.map(chat => (
                                <ChatHistoryItem 
                                  key={chat.id} 
                                  chat={chat} 
                                  isActive={currentChatId === chat.id}
                                  onSelect={(id) => {
                                    setCurrentChatId(id);
                                    setIsHistoryOpen(false);
                                  }}
                                  onDelete={deleteChat}
                                />
                              ))
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Navigation Menu Button */}
              <div className={cn("relative", (onboardingStep === 1 || onboardingStep === 2) ? "z-[100]" : (onboardingStep > 0 ? "z-40" : ""))} ref={settingsRef}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button 
                      onClick={() => {
                        setIsMenuOpen(!isMenuOpen);
                        setMenuView('main');
                        if (onboardingStep === 1) setStep(2);
                      }}
                      className={cn(
                        "p-2.5 rounded-full border border-gray-dark/45 backdrop-blur-md text-foreground shadow-lg hover:scale-105 transition-all duration-300",
                        theme === 'light' ? "bg-white/40 hover:bg-white/60" : "bg-black/40 hover:bg-black/60",
                        onboardingStep === 1 ? "ring-2 ring-electric-blue animate-pulse" : ""
                      )}
                    >
                      <div className="flex gap-1 items-center justify-center">
                        <div className="w-1 h-1 rounded-full bg-[var(--color-cyan-glow)] shadow-[0_0_2px_var(--color-cyan-glow)]" />
                        <div className="w-1 h-1 rounded-full bg-[var(--color-electric-green)] shadow-[0_0_2px_var(--color-electric-green)]" />
                        <div className="w-1 h-1 rounded-full bg-[var(--color-electric-blue)] shadow-[0_0_2px_var(--color-electric-blue)]" />
                      </div>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>App menu</TooltipContent>
                </Tooltip>
                
                {onboardingStep === 1 && (
                  <div className="absolute top-full right-0 mt-3 text-white text-[10px] font-bold pointer-events-none whitespace-nowrap animate-pulse">
                    option
                  </div>
                )}
                {/* User menu remains here... */}
                <AnimatePresence>
                  {isMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className={cn("absolute right-0 top-full mt-2 w-64 bg-gray-dark border border-foreground/10 rounded-xl shadow-2xl overflow-hidden", onboardingStep === 2 ? "z-[100]" : "z-50")}
                    >
                      <div className="p-2">
                        {menuView === 'main' ? (
                          <div className="space-y-1">
                            {user ? (
                              <div className="flex items-center gap-3 px-3 py-3 border-b border-foreground/5 mb-2">
                                <img src={user.photoURL || ''} className="w-8 h-8 rounded-full border border-electric-blue/30" alt="" />
                                <div className="flex flex-col min-w-0">
                                  <span className="text-sm font-bold truncate">{user.displayName}</span>
                                  <span className="text-[10px] text-muted truncate">{user.email}</span>
                                </div>
                              </div>
                            ) : (
                              <div className="px-3 py-3 border-b border-foreground/5 mb-2 flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-electric-blue animate-pulse" />
                                <span className="text-xs text-muted font-bold">Guest Access</span>
                              </div>
                            )}

                            <button
                              onClick={() => {
                                setActivePage('about');
                                setIsMenuOpen(false);
                              }}
                              className={cn(
                                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                                activePage === 'about' ? "bg-electric-blue/10 text-electric-blue font-bold" : "text-muted hover:bg-black-deep/50 hover:text-foreground"
                              )}
                            >
                              <Info size={18} />
                              <span>About</span>
                            </button>

                            <button
                              onClick={() => {
                                setActivePage('ai');
                                setIsMenuOpen(false);
                              }}
                              className={cn(
                                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                                activePage === 'ai' ? "bg-electric-blue/10 text-electric-blue font-bold" : "text-muted hover:bg-black-deep/50 hover:text-foreground"
                              )}
                            >
                              <CometIcon className="w-[18px] h-[18px]" />
                              <span>AI Assistant</span>
                            </button>

                            {user.email === 'p26893150@gmail.com' && (
                              <>
                                <button
                                  onClick={() => {
                                    setActivePage('training');
                                    setIsMenuOpen(false);
                                  }}
                                  className={cn(
                                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                                    activePage === 'training' ? "bg-amber-500/10 text-amber-500 font-bold" : "text-muted hover:bg-black-deep/50 hover:text-foreground"
                                  )}
                                >
                                  <Database size={18} className="text-amber-500" />
                                  <span>AI Training</span>
                                </button>
                                <button
                                  onClick={() => {
                                    setActivePage('experience');
                                    setIsMenuOpen(false);
                                  }}
                                  className={cn(
                                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                                    activePage === 'experience' ? "bg-[var(--logo-gradient-start)]/10 text-[var(--logo-gradient-start)] font-bold" : "text-muted hover:bg-black-deep/50 hover:text-foreground"
                                  )}
                                >
                                  <Activity size={18} className="text-[var(--logo-gradient-start)]" />
                                  <span>Experience Lab</span>
                                </button>
                                {user?.email === 'p26893150@gmail.com' && (
                                  <button
                                    onClick={() => {
                                      setActivePage('stats');
                                      setIsMenuOpen(false);
                                    }}
                                    className={cn(
                                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                                      activePage === 'stats' ? "bg-green-500/10 text-green-500 font-bold" : "text-muted hover:bg-black-deep/50 hover:text-foreground"
                                    )}
                                  >
                                    <BarChart3 size={18} className={activePage === 'stats' ? "text-green-500" : ""} />
                                    <span>Metrics Dashboard</span>
                                  </button>
                                )}
                              </>
                            )}

                            <button
                              onClick={() => setMenuView('settings')}
                              className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm text-muted hover:bg-black-deep/50 hover:text-foreground transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <Settings size={18} />
                                <span>Settings</span>
                              </div>
                              <Check size={14} className="opacity-0" />
                            </button>

                            {user?.email === 'p26893150@gmail.com' && (
                              <button
                                onClick={() => {
                                  setActivePage('apikeys');
                                  setIsMenuOpen(false);
                                }}
                                className={cn(
                                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                                  activePage === 'apikeys' ? "bg-cyan-500/10 text-cyan-500 font-bold" : "text-muted hover:bg-black-deep/50 hover:text-foreground"
                                )}
                              >
                                <Key size={18} className={activePage === 'apikeys' ? "text-cyan-500" : "text-cyan-500/80"} />
                                <div className="flex justify-between items-center w-full">
                                  <span>API Keys Console</span>
                                  <span className="text-[10px] bg-cyan-500/10 text-cyan-400 px-1.5 py-0.5 rounded-full font-mono border border-cyan-500/15">
                                    {geminiManager.getTotalKeysCount()}
                                  </span>
                                </div>
                              </button>
                            )}

                            <button
                              onClick={() => {
                                setActivePage('report');
                                setIsMenuOpen(false);
                              }}
                              className={cn(
                                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                                activePage === 'report' ? "bg-electric-blue/10 text-electric-blue font-bold" : "text-muted hover:bg-black-deep/50 hover:text-foreground"
                              )}
                            >
                              <Flag size={18} className={activePage === 'report' ? "text-electric-blue" : ""} />
                              <span>{user?.email === 'p26893150@gmail.com' ? 'System Reports' : 'Report & Feedback'}</span>
                            </button>

                            <div className="border-t border-foreground/5 mt-1 pt-2">
                              <button
                                onClick={handleLogout}
                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-500 hover:bg-red-500/10 transition-colors"
                              >
                                <LogOut size={18} />
                                <span>Sign Out</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <button 
                              onClick={() => setMenuView('main')}
                              className="flex items-center gap-2 px-3 py-1 text-xs text-electric-blue hover:text-electric-green transition-colors mb-2"
                            >
                              <ChevronLeft size={14} />
                              <span>Back to Menu</span>
                            </button>

                            <div>
                              <p className="px-3 py-1 text-[10px] font-bold text-muted uppercase tracking-widest">Display Mode</p>
                              <div className="space-y-1 mt-1">
                                <button
                                  onClick={() => toggleTheme('light')}
                                  className={cn(
                                    "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors",
                                    theme === 'light' ? "bg-electric-blue/10 text-foreground font-bold" : "text-muted hover:bg-black-deep/50 hover:text-foreground"
                                  )}
                                >
                                  <div className="flex items-center gap-3">
                                    <Sun size={16} />
                                    <span>Light Mode</span>
                                  </div>
                                  {theme === 'light' && <Check size={14} className="text-electric-blue" />}
                                </button>
                                <button
                                  onClick={() => toggleTheme('dark')}
                                  className={cn(
                                    "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors",
                                    theme === 'dark' ? "bg-electric-blue/10 text-foreground font-bold" : "text-muted hover:bg-black-deep/50 hover:text-foreground"
                                  )}
                                >
                                  <div className="flex items-center gap-3">
                                    <Moon size={16} />
                                    <span>Dark Mode</span>
                                  </div>
                                  {theme === 'dark' && <Check size={14} className="text-electric-blue" />}
                                </button>
                              </div>
                            </div>

                            <div className="border-t border-foreground/10 pt-2">
                              <p className="px-3 py-1 text-[10px] font-bold text-muted uppercase tracking-widest">Color Theme</p>
                              <div className="space-y-1 mt-1">
                                <button
                                  onClick={() => toggleColorTheme('purple')}
                                  className={cn(
                                    "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors",
                                    colorTheme === 'purple' ? "bg-electric-blue/10 text-foreground font-bold" : "text-muted hover:bg-black-deep/50 hover:text-foreground"
                                  )}
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="w-3 h-3 rounded-full bg-gradient-to-r from-[#8B5CF6] to-[#3B82F6]" />
                                    <span>Purple Gradient</span>
                                  </div>
                                  {colorTheme === 'purple' && <Check size={14} className="text-electric-blue" />}
                                </button>
                                <button
                                  onClick={() => toggleColorTheme('electric')}
                                  className={cn(
                                    "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors",
                                    colorTheme === 'electric' ? "bg-electric-blue/10 text-foreground font-bold" : "text-muted hover:bg-black-deep/50 hover:text-foreground"
                                  )}
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="w-3 h-3 rounded-full bg-gradient-to-r from-[#39FF14] to-[#007FFF]" />
                                    <span>Electric Theme</span>
                                  </div>
                                  {colorTheme === 'electric' && <Check size={14} className="text-electric-blue" />}
                                </button>
                                <button
                                  onClick={() => toggleColorTheme('golden')}
                                  className={cn(
                                    "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors",
                                    colorTheme === 'golden' ? "bg-electric-blue/10 text-foreground font-bold" : "text-muted hover:bg-black-deep/50 hover:text-foreground"
                                  )}
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="w-3 h-3 rounded-full bg-gradient-to-r from-[#C58350] via-[#D8831A] to-[#8C5325]" />
                                    <span>Golden Brown</span>
                                  </div>
                                  {colorTheme === 'golden' && <Check size={14} className="text-electric-blue" />}
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
          <main className="flex-1 bg-black-deep overflow-hidden relative pt-0">
            <AnimatePresence mode="wait">
              {activePage === 'ai' ? (
                <motion.div
                  key="ai-page"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="h-full"
                >
                  {React.isValidElement(children) && user ? React.cloneElement(children as React.ReactElement<any>, { 
                    chatId: currentChatId, 
                    userId: user.uid,
                    onNewChat: handleNewChatCreation
                  }) : (
                    <div className="h-full flex flex-col items-center justify-center p-6 text-center">
                      <NefronLogo className="w-16 h-16 text-electric-blue mb-6 animate-pulse" />
                      <h2 className="text-xl font-bold mb-4">Strategic AI Access Required</h2>
                      <p className="text-muted text-sm max-w-sm mb-8">
                        Please log in to your visionary account to access the Nefron Strategic Investor AI and real-time audio analysis tools.
                      </p>
                      <button
                        onClick={handleLogin}
                        disabled={isLoggingIn}
                        className="px-8 py-3 bg-electric-blue text-white rounded-full font-bold hover:scale-105 active:scale-95 transition-all shadow-lg shadow-electric-blue/20 flex items-center gap-3"
                      >
                        {isLoggingIn ? <Loader2 className="animate-spin" /> : <UserIcon size={18} />}
                        Start AI Session
                      </button>
                    </div>
                  )}
                </motion.div>
              ) : activePage === 'training' && user ? (
                <motion.div
                  key="training-page"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="absolute inset-0 pt-16"
                >
                  <TrainingInterface userId={user.uid} />
                </motion.div>
              ) : activePage === 'stats' && user?.email === 'p26893150@gmail.com' ? (
                <motion.div
                  key="stats-page"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                  className="absolute inset-0 z-10 bg-black-deep"
                >
                  <DashboardStats />
                </motion.div>
              ) : activePage === 'apikeys' && user?.email === 'p26893150@gmail.com' ? (
                <motion.div
                  key="apikeys-page"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                  className="absolute inset-0 z-10 bg-black-deep pt-16 overflow-y-auto"
                >
                  <ApiKeysManagement />
                </motion.div>
              ) : activePage === 'experience' && user ? (
                <motion.div
                  key="experience-page"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="absolute inset-0 pt-16"
                >
                  <ExperiencePage userId={user.uid} userEmail={user.email || ''} />
                </motion.div>
              ) : activePage === 'report' ? (
                <motion.div
                  key="report-page"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="absolute inset-0 pt-16"
                >
                  <ReportPage user={user} onBack={() => setActivePage('about')} />
                </motion.div>
              ) : (
                <AboutPage />
              )}
            </AnimatePresence>
          </main>
        </div>

        {/* Mic Permission Prompt Overlay */}
        <AnimatePresence>
          {showMicPrompt && user && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black-deep/80 backdrop-blur-sm p-4"
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="max-w-md w-full bg-gray-dark border border-electric-blue/30 rounded-3xl p-8 text-center shadow-[0_0_50px_rgba(0,127,255,0.2)]"
              >
                <div className="w-20 h-20 bg-electric-blue/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-electric-blue/20">
                  <Mic size={40} className="text-electric-blue animate-pulse" />
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-4">Enable Voice Features</h3>
                <p className="text-muted mb-6 text-sm leading-relaxed">
                  To experience Nefron AI's full voice capabilities, we need your permission to access the microphone. This will only be asked once per account.
                </p>
                
                <p className="text-xs text-muted/85 mb-8 max-w-xs mx-auto leading-relaxed">
                  By continuing, you accept the{' '}
                  <button
                    type="button"
                    onClick={() => setShowPrivacyPolicy(true)}
                    className="text-electric-blue hover:underline font-semibold cursor-pointer focus:outline-none inline"
                  >
                    privacy policy
                  </button>{' '}
                  of Nefron Audio.
                </p>
                
                {micError && (
                  <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-xs flex flex-col gap-3">
                    <p className="leading-relaxed">{micError}</p>
                    {typeof window !== 'undefined' && window.self !== window.top && (
                      <a 
                        href={window.location.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] font-bold uppercase tracking-widest text-red-500 underline decoration-red-500/30 hover:decoration-red-500 transition-all text-left block"
                      >
                        Open in New Tab ↗
                      </a>
                    )}
                  </div>
                )}

                <div className="flex flex-col gap-3">
                  <button
                    onClick={handleGrantMicPermission}
                    className="w-full py-4 rounded-2xl bg-electric-blue text-white font-bold hover:bg-electric-blue/90 transition-all shadow-lg shadow-electric-blue/20"
                  >
                    Grant Access
                  </button>
                  <button
                    onClick={handleSkipMicPermission}
                    className="w-full py-3 rounded-2xl bg-transparent text-muted hover:text-foreground transition-all text-xs uppercase tracking-widest"
                  >
                    Continue Without Voice
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Privacy Policy Modal */}
        <AnimatePresence>
          {showPrivacyPolicy && (
            <PrivacyPolicyModal isOpen={showPrivacyPolicy} onClose={() => setShowPrivacyPolicy(false)} />
          )}
        </AnimatePresence>
      </motion.div>
        {/* Onboarding Overlay */}
        {onboardingStep > 0 && (
          <div 
            className={cn(
              "fixed inset-0 pointer-events-auto transition-opacity duration-300",
              onboardingStep === 3 ? "z-[80]" : "z-[90]",
              "bg-black/60"
            )}
            onClick={() => {
              if (onboardingStep === 2) {
                setIsMenuOpen(false);
                setStep(3);
              }
            }}
          />
        )}
        
        {/* Invisible overlay for step 2 to catch "anywhere" clicks */}
        {onboardingStep === 2 && (
          <div 
            className="fixed inset-0 z-[110] pointer-events-auto"
            onClick={() => {
              setIsMenuOpen(false);
              setStep(3);
            }}
          />
        )}
      </TooltipProvider>
    </ErrorBoundary>
  );
}
