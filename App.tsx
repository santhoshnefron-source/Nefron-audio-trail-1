/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from 'react';
import { DashboardLayout } from './components/dashboard-layout';
import { ChatInterface } from './components/chat-interface';
import { runEnvironmentIntegrityChecks } from './lib/security';

export default function App() {

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

    return () => {
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  return (
    <DashboardLayout>
      <ChatInterface />
    </DashboardLayout>
  );
}
