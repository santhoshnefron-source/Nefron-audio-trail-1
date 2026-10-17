import { doc, setDoc, updateDoc, increment, getDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface TrackingStats {
  userId: string;
  email: string;
  loginCount: number;
  logoutCount: number;
  totalTime: number; // in seconds
  aboutTime: number; // in seconds
  narrativeAiTime: number; // in seconds
  chatTime: number; // in seconds
  completeVoiceTime: number; // in seconds
  chartedVoiceTime: number; // in seconds
  lastActiveAt: string;
  browserInfo: string;
  messageCount: number;
  lastLoginAt: string;
  lastLogoutAt?: string;
}

// Global active states for tracking durations
const activeStates = {
  about: false,
  narrative_ai: false,
  chat_box: false,
  complete_voice: false,
  charted_voice: false,
};

let trackingInterval: NodeJS.Timeout | null = null;
let currentUserId: string | null = null;
let currentUserEmail: string | null = null;
let accumulatedDurations = {
  totalTime: 0,
  aboutTime: 0,
  narrativeAiTime: 0,
  chatTime: 0,
  completeVoiceTime: 0,
  chartedVoiceTime: 0,
};

// Simple idle detection (idle after 2 minutes)
let lastUserActivity = Date.now();
const IDLE_THRESHOLD = 2 * 60 * 1000; // 2 minutes

if (typeof window !== 'undefined') {
  const resetActivity = () => {
    lastUserActivity = Date.now();
  };
  window.addEventListener('mousemove', resetActivity);
  window.addEventListener('keydown', resetActivity);
  window.addEventListener('click', resetActivity);
  window.addEventListener('scroll', resetActivity);
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function runWithRetry<T>(fn: () => Promise<T>, retries = 3, delayMs = 500): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0) {
      console.warn(`Firestore operation failed, retrying in ${delayMs}ms...`, error);
      await delay(delayMs);
      return runWithRetry(fn, retries - 1, delayMs * 2);
    }
    throw error;
  }
}

export function setTrackingState(key: keyof typeof activeStates, isActive: boolean) {
  activeStates[key] = isActive;
}

/**
 * Initializes tracking for a user when they log in or the app loads.
 */
export async function startTracking(userId: string, email: string) {
  if (currentUserId === userId) return;
  
  // Clean up existing tracker first
  stopTracking();
  
  currentUserId = userId;
  currentUserEmail = email;
  
  // Reset local accumulated buffers
  accumulatedDurations = {
    totalTime: 0,
    aboutTime: 0,
    narrativeAiTime: 0,
    chatTime: 0,
    completeVoiceTime: 0,
    chartedVoiceTime: 0,
  };

  const trackingDocRef = doc(db, 'tracking', userId);
  const browserInfo = typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown';

  try {
    const docSnap = await runWithRetry(() => getDoc(trackingDocRef));
    const sessionKey = `nefron_logged_in_session_${userId}`;
    const alreadyLoggedSession = sessionStorage.getItem(sessionKey);

    const isNewLogin = !alreadyLoggedSession;
    if (isNewLogin) {
      sessionStorage.setItem(sessionKey, 'true');
    }

    if (!docSnap.exists()) {
      // Create fresh document
      await runWithRetry(() => setDoc(trackingDocRef, {
        userId,
        email,
        loginCount: isNewLogin ? 1 : 0,
        logoutCount: 0,
        totalTime: 0,
        aboutTime: 0,
        narrativeAiTime: 0,
        chatTime: 0,
        completeVoiceTime: 0,
        chartedVoiceTime: 0,
        lastActiveAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
        browserInfo,
        messageCount: 0,
      }));
    } else {
      // Update existing document
      const updateData: any = {
        lastActiveAt: new Date().toISOString(),
        browserInfo,
      };
      if (isNewLogin) {
        updateData.loginCount = increment(1);
        updateData.lastLoginAt = new Date().toISOString();
      }
      await runWithRetry(() => updateDoc(trackingDocRef, updateData));
    }
  } catch (error) {
    console.error("Error starting tracking:", error);
  }

  // Set up periodic sync (every 5 seconds)
  trackingInterval = setInterval(() => {
    tickTracking();
  }, 1000); // Check every second, but flush to Firestore in chunks (e.g., every 5 ticks or when values are > 0)
}

let tickCount = 0;

async function tickTracking() {
  if (!currentUserId) return;

  // Check idle state
  const isIdle = Date.now() - lastUserActivity > IDLE_THRESHOLD;
  if (isIdle) return;

  // Increment total app time
  accumulatedDurations.totalTime += 1;

  // Track page-specific times
  if (activeStates.about) {
    accumulatedDurations.aboutTime += 1;
  }
  
  if (activeStates.narrative_ai) {
    accumulatedDurations.narrativeAiTime += 1;
  }

  // Voice features take precedence/overlap with standard chat page
  if (activeStates.complete_voice) {
    accumulatedDurations.completeVoiceTime += 1;
  } else if (activeStates.charted_voice) {
    accumulatedDurations.chartedVoiceTime += 1;
  } else if (activeStates.chat_box) {
    accumulatedDurations.chatTime += 1;
  }

  tickCount += 1;

  // Flush to Firestore every 5 seconds to reduce writes while keeping logs fresh
  if (tickCount >= 5) {
    tickCount = 0;
    await flushTrackingToFirestore();
  }
}

async function flushTrackingToFirestore() {
  if (!currentUserId) return;

  // Only write if there's actually active duration tracked
  const hasUpdates = Object.values(accumulatedDurations).some(val => val > 0);
  if (!hasUpdates) return;

  const trackingDocRef = doc(db, 'tracking', currentUserId);
  const increments = {
    totalTime: increment(accumulatedDurations.totalTime),
    aboutTime: increment(accumulatedDurations.aboutTime),
    narrativeAiTime: increment(accumulatedDurations.narrativeAiTime),
    chatTime: increment(accumulatedDurations.chatTime),
    completeVoiceTime: increment(accumulatedDurations.completeVoiceTime),
    chartedVoiceTime: increment(accumulatedDurations.chartedVoiceTime),
    lastActiveAt: new Date().toISOString(),
  };

  // Reset local buffers BEFORE the async call to prevent double-counting if network takes time
  const currentBuffer = { ...accumulatedDurations };
  accumulatedDurations = {
    totalTime: 0,
    aboutTime: 0,
    narrativeAiTime: 0,
    chatTime: 0,
    completeVoiceTime: 0,
    chartedVoiceTime: 0,
  };

  try {
    await runWithRetry(() => updateDoc(trackingDocRef, increments));
  } catch (error) {
    // If update fails, restore buffers so we don't lose data
    console.error("Failed to flush tracking to Firestore:", error);
    accumulatedDurations.totalTime += currentBuffer.totalTime;
    accumulatedDurations.aboutTime += currentBuffer.aboutTime;
    accumulatedDurations.narrativeAiTime += currentBuffer.narrativeAiTime;
    accumulatedDurations.chatTime += currentBuffer.chatTime;
    accumulatedDurations.completeVoiceTime += currentBuffer.completeVoiceTime;
    accumulatedDurations.chartedVoiceTime += currentBuffer.chartedVoiceTime;
  }
}

/**
 * Handles explicit logout count increment.
 */
export async function trackLogout(userId: string) {
  try {
    await flushTrackingToFirestore();
    const trackingDocRef = doc(db, 'tracking', userId);
    await runWithRetry(() => updateDoc(trackingDocRef, {
      logoutCount: increment(1),
      lastLogoutAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    }));
  } catch (error) {
    console.error("Error tracking logout:", error);
  }
  stopTracking();
}

/**
 * Tracks when a user sends a message in standard chat.
 */
export async function trackMessageSent(userId: string) {
  try {
    const trackingDocRef = doc(db, 'tracking', userId);
    await runWithRetry(() => updateDoc(trackingDocRef, {
      messageCount: increment(1),
    }));
  } catch (error) {
    console.error("Error tracking message:", error);
  }
}

/**
 * Stops the interval tracker.
 */
export function stopTracking() {
  if (trackingInterval) {
    clearInterval(trackingInterval);
    trackingInterval = null;
  }
  currentUserId = null;
  currentUserEmail = null;
}
