/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from 'react';
import { DashboardLayout } from './components/dashboard-layout';
import { ChatInterface } from './components/chat-interface';
import { runEnvironmentIntegrityChecks } from './lib/security';
import { ShieldAlert } from 'lucide-react';

export default function App() {
  const [isPrivacyScreenActive, setIsPrivacyScreenActive] = React.useState(false);

  React.useEffect(() => {
    // Initialize Environment Integrity Checks
    try {
      runEnvironmentIntegrityChecks();
    } catch (e) {
      console.error(e);
    }

    // GLOBALLY suppress specific Firebase and Audio API unhandled promise rejections
    const handleRejection = (e: PromiseRejectionEvent) => {
      if (
        (e.reason && typeof e.reason.message === 'string' && (e.reason.message.includes('The play() request was interrupted') || e.reason.message.includes('call to pause()'))) ||
        (e.reason && e.reason.name === 'FirebaseError' && e.reason.code === 'unavailable')
      ) {
        e.preventDefault();
      }
    };
    window.addEventListener('unhandledrejection', handleRejection);

    // UI HARDENING: Prevent copy, cut, paste, and context menu globally
    const preventDefault = (e: Event) => e.preventDefault();
    
    document.addEventListener('contextmenu', preventDefault);
    document.addEventListener('copy', preventDefault);
    document.addEventListener('cut', preventDefault);
    document.addEventListener('paste', preventDefault);

    // SCREEN RECORDING / SCREENSHOT PREVENTION (Client-Side Simulation)
    // Aggressively clear clipboard on visibility change (backgrounded/closed)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsPrivacyScreenActive(true);
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText('').catch(() => {}); // Clear memory and catch promise rejection securely
          }
        } catch (e) {
          // Ignore securely
        }
      } else {
        // Require a tiny delay before un-blurring to bypass slow screen grabbers
        setTimeout(() => setIsPrivacyScreenActive(false), 200);
      }
    };
    
    // Additional event to detect common screenshot keyboard shortcuts (PC/Mac)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === 'PrintScreen' || 
        (e.metaKey && e.shiftKey && ['3', '4', '5'].includes(e.key)) || 
        (e.ctrlKey && e.shiftKey && ['3', '4', '5'].includes(e.key))
      ) {
        setIsPrivacyScreenActive(true);
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText('').catch(() => {});
          }
        } catch (err) {}
        
        // Hide after an appropriate delay
        setTimeout(() => setIsPrivacyScreenActive(false), 3000);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('contextmenu', preventDefault);
      document.removeEventListener('copy', preventDefault);
      document.removeEventListener('cut', preventDefault);
      document.removeEventListener('paste', preventDefault);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  return (
    <>
      <DashboardLayout>
        <ChatInterface />
      </DashboardLayout>

      {/* PRIVACY SCREEN OVERLAY */}
      {isPrivacyScreenActive && (
        <div className="fixed inset-0 z-[99999] bg-black flex flex-col items-center justify-center text-red-500 backdrop-blur-3xl">
          <ShieldAlert size={64} className="mb-4 animate-pulse" />
          <h1 className="text-2xl font-bold tracking-widest font-mono text-center px-4">
            SECURITY PROTOCOL ENGAGED
          </h1>
          <p className="font-mono mt-2 text-sm text-red-500/80 max-w-md text-center px-4">
            Access restricted processing backgrounded state. Display locked to prevent unauthorized screen capture.
          </p>
        </div>
      )}
    </>
  );
}
