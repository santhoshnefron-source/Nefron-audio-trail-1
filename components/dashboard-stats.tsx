import { useState, useEffect } from 'react';
import { 
  Users, Activity, Clock, MessageSquare, Headphones, 
  FileText, BrainCircuit, Mic, Laptop, Calendar, ChevronRight, 
  RefreshCw, ShieldAlert, CheckCircle, Info, LogIn, LogOut, Cpu,
  Trash2, AlertTriangle, X
} from 'lucide-react';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { Skeleton } from './ui/skeleton';

export interface UserTrackingData {
  userId: string;
  email: string;
  loginCount: number;
  logoutCount: number;
  totalTime: number;
  aboutTime: number;
  narrativeAiTime: number;
  chatTime: number;
  completeVoiceTime: number;
  chartedVoiceTime: number;
  lastActiveAt: string;
  lastLoginAt: string;
  lastLogoutAt?: string;
  browserInfo: string;
  messageCount: number;
}

// Helpers for precise duration breakdowns
interface DurationBreakdown {
  hours: number;
  minutes: number;
  seconds: number;
}

function getDurationBreakdown(totalSeconds: number): DurationBreakdown {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  return { hours, minutes, seconds };
}

function formatDurationExplicit(totalSeconds: number): string {
  const { hours, minutes, seconds } = getDurationBreakdown(totalSeconds);
  const hLabel = hours === 1 ? 'hour' : 'hours';
  const mLabel = minutes === 1 ? 'minute' : 'minutes';
  const sLabel = seconds === 1 ? 'second' : 'seconds';
  return `${hours} ${hLabel}, ${minutes} ${mLabel}, ${seconds} ${sLabel}`;
}

function formatDurationDigital(totalSeconds: number): string {
  const { hours, minutes, seconds } = getDurationBreakdown(totalSeconds);
  const pad = (num: number) => String(num).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function parseUserAgent(ua: string) {
  if (!ua) return 'Unknown Device';
  
  let os = 'Unknown OS';
  if (ua.includes('Windows')) os = 'Windows OS';
  else if (ua.includes('Macintosh') || ua.includes('Mac OS')) os = 'macOS';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS Device';
  else if (ua.includes('Linux')) os = 'Linux OS';
  
  let browser = 'Unknown Browser';
  if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Edge')) browser = 'Edge';
  
  return `${browser} on ${os}`;
}

export function DashboardStats() {
  const [users, setUsers] = useState<UserTrackingData[]>([]);
  const [restrictedEmails, setRestrictedEmails] = useState<string[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeMobileTab, setActiveMobileTab] = useState<'list' | 'inspector'>('list');

  // Custom Modal/Dialog States for iFrame compatibility
  const [modalConfig, setModalConfig] = useState<{
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm?: () => void;
    type: 'confirm' | 'info' | 'error' | 'success';
  } | null>(null);

  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const trackingCol = collection(db, 'tracking');
    const trackingQuery = query(trackingCol, orderBy('lastActiveAt', 'desc'));

    const unsubscribe = onSnapshot(
      trackingQuery, 
      (snapshot) => {
        const list: UserTrackingData[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ userId: docSnap.id, ...docSnap.data() } as UserTrackingData);
        });
        setUsers(list);
        setLoading(false);

        // Auto select first user if none is selected yet, using functional update to avoid stale closures
        setSelectedUserId((prev) => {
          if (prev) {
            // Keep the same selection if it still exists in the list
            const stillExists = list.some(u => u.userId === prev);
            if (stillExists) return prev;
          }
          return list.length > 0 ? list[0].userId : null;
        });
      },
      (err) => {
        console.error("Error fetching tracking database:", err);
        const isOwner = auth.currentUser?.email === 'p26893150@gmail.com';
        setError(isOwner ? "Missing permissions or Firestore configuration error. Make sure you are signed in with the authorized admin email." : "We're currently tidying up the stats, please check back shortly.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Fetch restricted emails
  useEffect(() => {
    const restrictionsCol = collection(db, 'restrictions');
    const unsubscribe = onSnapshot(
      restrictionsCol,
      (snapshot) => {
        const list: string[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.id.toLowerCase().trim());
        });
        setRestrictedEmails(list);
      },
      (err) => {
        console.error("Error fetching restrictions:", err);
      }
    );
    return () => unsubscribe();
  }, []);

  // Merge real tracked users with virtual restricted users who might not have tracked data
  const mergedUsers: UserTrackingData[] = [...users];
  restrictedEmails.forEach(restrictedEmail => {
    const exists = users.some(u => u.email.toLowerCase().trim() === restrictedEmail);
    if (!exists) {
      mergedUsers.push({
        userId: `restricted_${restrictedEmail.replace(/[^a-zA-Z0-9]/g, '_')}`,
        email: restrictedEmail,
        loginCount: 0,
        logoutCount: 0,
        totalTime: 0,
        aboutTime: 0,
        narrativeAiTime: 0,
        chatTime: 0,
        completeVoiceTime: 0,
        chartedVoiceTime: 0,
        lastActiveAt: '',
        lastLoginAt: '',
        browserInfo: 'No session data - account is restricted',
        messageCount: 0
      });
    }
  });

  const selectedUser = mergedUsers.find(u => u.userId === selectedUserId) || null;

  const handleRemoveUser = (userId: string, email: string) => {
    if (userId.startsWith('restricted_')) {
      setModalConfig({
        type: 'info',
        title: 'Virtual Entry Only',
        message: "This is a virtual entry representing a restricted email with no active tracking logs. To remove this, please click 'Remove Email Restriction' first."
      });
      return;
    }

    setModalConfig({
      type: 'confirm',
      title: 'Erase User Records',
      message: `Are you absolutely sure you want to remove ${email}? This will erase all of their session tracking and mic permission profile data from the database.`,
      confirmText: 'Erase Records',
      cancelText: 'Cancel',
      onConfirm: async () => {
        setActionLoading(true);
        setModalConfig(null);
        try {
          await deleteDoc(doc(db, 'tracking', userId));
          await deleteDoc(doc(db, 'users', userId));
          setSelectedUserId(null);
          setToast({
            type: 'success',
            message: `Successfully removed ${email} and erased all associated records.`
          });
        } catch (err: any) {
          console.error("Error removing user:", err);
          setToast({
            type: 'error',
            message: `Failed to remove user: ${err.message || err}`
          });
        } finally {
          setActionLoading(false);
        }
      }
    });
  };

  const handleRestrictEmail = (email: string) => {
    setModalConfig({
      type: 'confirm',
      title: 'Restrict Email Address',
      message: `Are you sure you want to restrict ${email} from accessing this application? They will be blocked from logging in.`,
      confirmText: 'Block Email',
      cancelText: 'Cancel',
      onConfirm: async () => {
        setActionLoading(true);
        setModalConfig(null);
        try {
          const emailKey = email.toLowerCase().trim();
          await setDoc(doc(db, 'restrictions', emailKey), {
            email: email,
            restrictedAt: new Date().toISOString(),
            restrictedBy: 'p26893150@gmail.com'
          });
          setToast({
            type: 'success',
            message: `Successfully restricted ${email}. They can no longer log in.`
          });
        } catch (err: any) {
          console.error("Error restricting email:", err);
          setToast({
            type: 'error',
            message: `Failed to restrict email: ${err.message || err}`
          });
        } finally {
          setActionLoading(false);
        }
      }
    });
  };

  const handleRemoveRestriction = (email: string) => {
    setModalConfig({
      type: 'confirm',
      title: 'Remove Restriction',
      message: `Are you sure you want to remove the restriction for ${email}?`,
      confirmText: 'Allow Access',
      cancelText: 'Cancel',
      onConfirm: async () => {
        setActionLoading(true);
        setModalConfig(null);
        try {
          const emailKey = email.toLowerCase().trim();
          await deleteDoc(doc(db, 'restrictions', emailKey));
          setToast({
            type: 'success',
            message: `Successfully removed restriction for ${email}.`
          });
        } catch (err: any) {
          console.error("Error removing restriction:", err);
          setToast({
            type: 'error',
            message: `Failed to remove restriction: ${err.message || err}`
          });
        } finally {
          setActionLoading(false);
        }
      }
    });
  };

  // Compute aggregated system-level statistics
  const totalRegisteredUsers = users.length;
  
  const activeUsersCount = users.filter(user => {
    if (!user.lastActiveAt) return false;
    const diff = Date.now() - new Date(user.lastActiveAt).getTime();
    return diff < 15000; // Active within past 15 seconds
  }).length;

  const totalLogins = users.reduce((sum, u) => sum + (u.loginCount || 0), 0);
  const totalLogouts = users.reduce((sum, u) => sum + (u.logoutCount || 0), 0);
  const totalMessagesSent = users.reduce((sum, u) => sum + (u.messageCount || 0), 0);
  const totalSystemTime = users.reduce((sum, u) => sum + (u.totalTime || 0), 0);

  return (
    <div className="w-full h-full flex flex-col md:flex-row gap-6 p-4 md:p-6 bg-[#050505] text-gray-200 overflow-hidden">
      
      {/* LEFT CONTAINER: Users Directory and Quick Aggregates */}
      <div className={`flex flex-col gap-6 w-full md:w-[320px] lg:w-[380px] shrink-0 h-full overflow-hidden ${
        activeMobileTab === 'list' ? 'flex' : 'hidden md:flex'
      }`}>
        
        {/* Real-time System Analytics Header */}
        <div className="p-5 bg-gradient-to-r from-emerald-500/10 to-transparent border border-emerald-500/20 rounded-2xl flex flex-col gap-1.5 shadow-[0_0_15px_rgba(16,185,129,0.05)]">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-widest">Live Telemetry Matrix Core</span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">System Telemetry Console</h2>
          <p className="text-xs text-gray-400 leading-relaxed">Admin tracking interface for monitoring real-time active sessions, user journeys, features durations, and logs.</p>
        </div>

        {/* Global Overview Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[#111111] border border-white/5 p-4 rounded-xl flex flex-col gap-1">
            <div className="flex items-center gap-2 text-gray-400">
              <Users size={14} className="text-emerald-400" />
              <span className="text-[10px] font-mono uppercase tracking-wider">Total Enrolled</span>
            </div>
            {loading ? (
              <Skeleton className="h-8 w-16 bg-white/5 mt-1" />
            ) : (
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-2xl font-black text-white">{totalRegisteredUsers}</span>
                <span className="text-[10px] text-emerald-400 font-mono">emails</span>
              </div>
            )}
          </div>

          <div className="bg-[#111111] border border-white/5 p-4 rounded-xl flex flex-col gap-1">
            <div className="flex items-center gap-2 text-gray-400">
              <Activity size={14} className="text-emerald-400 animate-pulse" />
              <span className="text-[10px] font-mono uppercase tracking-wider">Active Now</span>
            </div>
            {loading ? (
              <Skeleton className="h-8 w-16 bg-white/5 mt-1" />
            ) : (
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-2xl font-black text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]">{activeUsersCount}</span>
                <span className="text-[10px] text-emerald-400/80 font-mono">online</span>
              </div>
            )}
          </div>

          <div className="bg-[#111111] border border-white/5 p-4 rounded-xl flex flex-col gap-1">
            <div className="flex items-center gap-2 text-gray-400">
              <MessageSquare size={14} className="text-indigo-400" />
              <span className="text-[10px] font-mono uppercase tracking-wider">Total Messages</span>
            </div>
            {loading ? (
              <Skeleton className="h-8 w-16 bg-white/5 mt-1" />
            ) : (
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-2xl font-black text-white">{totalMessagesSent}</span>
                <span className="text-[10px] text-indigo-400/80 font-mono">queries</span>
              </div>
            )}
          </div>

          <div className="bg-[#111111] border border-white/5 p-4 rounded-xl flex flex-col gap-1">
            <div className="flex items-center gap-2 text-gray-400">
              <Clock size={14} className="text-amber-400" />
              <span className="text-[10px] font-mono uppercase tracking-wider">Combined Usage</span>
            </div>
            {loading ? (
              <Skeleton className="h-8 w-16 bg-white/5 mt-1" />
            ) : (
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-sm font-bold text-amber-400 font-mono">{formatDurationDigital(totalSystemTime)}</span>
              </div>
            )}
          </div>
        </div>

        {/* User Directory Panel */}
        <div className="bg-[#111111] border border-white/5 rounded-2xl flex flex-col overflow-hidden shadow-xl flex-1 min-h-0">
          <div className="p-4 border-b border-white/5 bg-white/[0.02] flex items-center justify-between shrink-0">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">Registered Users Queue</h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/5 text-gray-400">
              {users.length} Users
            </span>
          </div>

          {error && (
            <div className="p-4 m-4 rounded-xl border border-red-500/20 bg-red-500/5 flex gap-3 items-start shrink-0">
              <ShieldAlert className="text-red-400 shrink-0 mt-0.5" size={16} />
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-red-300">Access Restricted</span>
                <span className="text-[10px] text-red-400/90 leading-normal">{error}</span>
              </div>
            </div>
          )}

          <div className="flex flex-col overflow-y-auto custom-scrollbar divide-y divide-white/[0.03] flex-1">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="p-4 flex flex-col gap-2">
                  <Skeleton className="h-4 w-48 bg-white/5" />
                  <div className="flex gap-2">
                    <Skeleton className="h-3 w-16 bg-white/5" />
                    <Skeleton className="h-3 w-20 bg-white/5" />
                  </div>
                </div>
              ))
            ) : mergedUsers.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-500 flex flex-col gap-2 items-center">
                <Info size={18} />
                <span>No tracked user sessions found. Let someone log in first to trigger metrics.</span>
              </div>
            ) : (
              mergedUsers.map((item) => {
                const isActive = item.lastActiveAt && (Date.now() - new Date(item.lastActiveAt).getTime() < 15000);
                const isSelected = selectedUserId === item.userId;
                const isRestricted = restrictedEmails.includes(item.email.toLowerCase().trim());

                return (
                  <button
                    key={item.userId}
                    id={`user-selector-${item.userId}`}
                    onClick={() => {
                      setSelectedUserId(item.userId);
                      setActiveMobileTab('inspector');
                    }}
                    className={`w-full p-4 flex items-center justify-between text-left transition-all relative ${
                      isSelected 
                        ? 'bg-emerald-500/[0.03] border-l-2 border-emerald-500' 
                        : 'hover:bg-white/[0.01]'
                    }`}
                  >
                    <div className="flex flex-col gap-1.5 min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        {/* Live Status indicator */}
                        <div 
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            isRestricted 
                              ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'
                              : isActive 
                                ? 'bg-emerald-400 animate-pulse ring-4 ring-emerald-500/15' 
                                : 'bg-gray-600'
                          }`} 
                        />
                        <span className="text-sm font-semibold text-white truncate max-w-[140px] lg:max-w-[100px] xl:max-w-[160px]">
                          {item.email}
                        </span>
                        {isRestricted && (
                          <span className="text-[8px] font-mono font-bold bg-red-500/20 border border-red-500/30 text-red-400 px-1 py-0.5 rounded uppercase">
                            Restricted
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-3 text-[10px] font-mono text-gray-400">
                        <span className="flex items-center gap-1">
                          In: <strong className="text-emerald-400">{item.loginCount || 0}</strong>
                        </span>
                        <span className="flex items-center gap-1">
                          Out: <strong className="text-amber-500">{item.logoutCount || 0}</strong>
                        </span>
                        <span className="text-gray-600">|</span>
                        <span className="text-gray-400">
                          {formatDurationDigital(item.totalTime || 0)}
                        </span>
                      </div>
                    </div>

                    <ChevronRight 
                      size={16} 
                      className={`text-gray-600 transition-transform duration-300 ${
                        isSelected ? 'text-emerald-400 translate-x-1' : ''
                      }`} 
                    />
                  </button>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* RIGHT CONTAINER: Dedicated Detailed User Metrics Profiler */}
      <div className={`flex-1 bg-[#111111] border border-white/5 rounded-2xl flex flex-col overflow-hidden shadow-xl ${
        activeMobileTab === 'inspector' ? 'flex' : 'hidden md:flex'
      }`}>
        <AnimatePresence mode="wait">
          {selectedUser ? (
            <motion.div
              key={selectedUser.userId}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="flex-1 flex flex-col h-full overflow-hidden"
            >
              
              {/* Profile Header */}
              <div className="p-6 border-b border-white/5 bg-white/[0.01] flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
                <div className="flex flex-col gap-3">
                  {/* Mobile Back Button */}
                  <button
                    onClick={() => setActiveMobileTab('list')}
                    className="md:hidden flex items-center gap-2 text-xs text-emerald-400 font-mono hover:text-emerald-300 w-fit transition-colors"
                  >
                    <span>← Back to Directory</span>
                  </button>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-widest px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                        Active User Profiler
                      </span>
                      {selectedUser.lastActiveAt && (Date.now() - new Date(selectedUser.lastActiveAt).getTime() < 15000) && (
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ring-4 ring-emerald-500/10" />
                      )}
                    </div>
                    <h3 className="text-xl font-bold text-white truncate max-w-full md:max-w-md">
                      {selectedUser.email}
                    </h3>
                    <p className="text-[10px] font-mono text-gray-500">
                      ID: {selectedUser.userId}
                    </p>
                  </div>
                </div>

                <div className="bg-black/40 border border-white/5 rounded-xl px-4 py-3 flex flex-col items-center justify-center shrink-0 min-w-[140px]">
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Login Balance</span>
                  <div className="flex items-center gap-3 mt-1 text-sm font-mono font-bold">
                    <span className="text-emerald-400 flex items-center gap-1"><LogIn size={12} /> {selectedUser.loginCount || 0}</span>
                    <span className="text-gray-600">/</span>
                    <span className="text-amber-500 flex items-center gap-1"><LogOut size={12} /> {selectedUser.logoutCount || 0}</span>
                  </div>
                </div>
              </div>

              {/* Detailed Active Times Dashboard Area */}
              <div className="p-6 flex flex-col gap-6 overflow-y-auto custom-scrollbar flex-1">
                
                {/* Visual Digital Clock for TOTAL APP TIME */}
                <div className="bg-gradient-to-br from-emerald-500/[0.03] to-transparent border border-emerald-500/10 rounded-2xl p-6 flex flex-col items-center justify-center gap-4 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-3 text-[10px] font-mono text-emerald-500/40 font-bold tracking-wider flex items-center gap-1">
                    <Cpu size={12} className="animate-spin-slow" /> CORE ACTIVE COUNTER
                  </div>
                  
                  <div className="flex flex-col items-center gap-1">
                    <div className="p-2 rounded-full bg-emerald-500/10 text-emerald-400 mb-1">
                      <Clock size={24} className="animate-pulse" />
                    </div>
                    <span className="text-xs text-gray-400 font-mono font-bold uppercase tracking-widest">Total App Usage Duration</span>
                  </div>

                  {/* Dramatic 3-Column Split Breakdown */}
                  <div className="grid grid-cols-3 gap-3 w-full max-w-md">
                    <div className="bg-[#151515] border border-white/5 rounded-xl p-3 flex flex-col items-center shadow-inner">
                      <span className="text-3xl md:text-4xl font-black text-white font-mono leading-none">
                        {getDurationBreakdown(selectedUser.totalTime).hours}
                      </span>
                      <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mt-2">Hours</span>
                    </div>
                    <div className="bg-[#151515] border border-white/5 rounded-xl p-3 flex flex-col items-center shadow-inner">
                      <span className="text-3xl md:text-4xl font-black text-white font-mono leading-none">
                        {getDurationBreakdown(selectedUser.totalTime).minutes}
                      </span>
                      <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mt-2">Minutes</span>
                    </div>
                    <div className="bg-[#151515] border border-white/5 rounded-xl p-3 flex flex-col items-center shadow-inner">
                      <span className="text-3xl md:text-4xl font-black text-white font-mono leading-none">
                        {getDurationBreakdown(selectedUser.totalTime).seconds}
                      </span>
                      <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mt-2">Seconds</span>
                    </div>
                  </div>

                  {/* Explanatory sentence */}
                  <div className="text-xs bg-black/50 border border-white/5 rounded-xl py-2.5 px-4 text-center max-w-lg leading-relaxed text-gray-300 font-mono">
                    Used our app for <strong className="text-emerald-400">{getDurationBreakdown(selectedUser.totalTime).hours} hours</strong>,{' '}
                    <strong className="text-emerald-400">{getDurationBreakdown(selectedUser.totalTime).minutes} minutes</strong>, and{' '}
                    <strong className="text-emerald-400">{getDurationBreakdown(selectedUser.totalTime).seconds} seconds</strong>
                  </div>
                </div>

                {/* ADMINISTRATIVE SECURITY CONTROL PANEL */}
                <div className="p-5 bg-red-950/10 border border-red-500/20 rounded-2xl flex flex-col gap-4">
                  <div className="flex items-center gap-2">
                    <ShieldAlert size={16} className="text-red-400" />
                    <span className="text-xs font-mono font-bold text-red-400 uppercase tracking-wider">Administrative Security Actions</span>
                  </div>
                  
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => handleRemoveUser(selectedUser.userId, selectedUser.email)}
                      disabled={actionLoading}
                      className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 hover:border-red-500/50 rounded-xl text-xs font-bold text-red-300 transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                      <Trash2 size={14} className="text-red-400" />
                      Erase Database Records & Remove User
                    </button>

                    {restrictedEmails.includes(selectedUser.email.toLowerCase().trim()) ? (
                      <button
                        onClick={() => handleRemoveRestriction(selectedUser.email)}
                        disabled={actionLoading}
                        className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 hover:border-emerald-500/50 rounded-xl text-xs font-bold text-emerald-300 transition-colors flex items-center gap-2 disabled:opacity-50"
                      >
                        <CheckCircle size={14} className="text-emerald-400" />
                        Remove Email Restriction
                      </button>
                    ) : (
                      <button
                        onClick={() => handleRestrictEmail(selectedUser.email)}
                        disabled={actionLoading}
                        className="px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 hover:border-amber-500/50 rounded-xl text-xs font-bold text-amber-300 transition-colors flex items-center gap-2 disabled:opacity-50"
                      >
                        <ShieldAlert size={14} className="text-amber-400" />
                        Restrict Email Address
                      </button>
                    )}
                  </div>
                  
                  <p className="text-[10px] text-gray-500 font-mono leading-relaxed">
                    * Removing a user erases all tracking metrics and clears their microphone grant token. They will be prompted for mic access again on their next login. Restricting an email blocks it from logging in immediately, displaying an authentication error.
                  </p>
                </div>

                {/* Indepth Sections Breakdown */}
                <div className="flex flex-col gap-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-white">Platform Section Duration Metrics</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* SECTION 1: ABOUT PAGE */}
                    <div className="bg-[#151515] hover:bg-[#181818] border border-white/5 hover:border-white/10 rounded-xl p-5 flex flex-col gap-4 transition-all duration-300 shadow-md">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                            <FileText size={16} />
                          </div>
                          <div>
                            <h5 className="font-semibold text-white text-sm">About Page</h5>
                            <p className="text-[10px] text-gray-500 font-mono">System Knowledge Specs</p>
                          </div>
                        </div>
                        <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400">
                          {selectedUser.totalTime > 0 ? Math.round(((selectedUser.aboutTime || 0) / selectedUser.totalTime) * 100) : 0}% of app
                        </span>
                      </div>

                      {/* Precise Grid breakdown */}
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-[#0c0c0c] border border-white/[0.03] rounded-lg py-2 flex flex-col">
                          <span className="text-xl font-extrabold font-mono text-white">
                            {getDurationBreakdown(selectedUser.aboutTime).hours}
                          </span>
                          <span className="text-[9px] text-gray-500 font-medium uppercase tracking-wider mt-0.5">Hours</span>
                        </div>
                        <div className="bg-[#0c0c0c] border border-white/[0.03] rounded-lg py-2 flex flex-col">
                          <span className="text-xl font-extrabold font-mono text-white">
                            {getDurationBreakdown(selectedUser.aboutTime).minutes}
                          </span>
                          <span className="text-[9px] text-gray-500 font-medium uppercase tracking-wider mt-0.5">Minutes</span>
                        </div>
                        <div className="bg-[#0c0c0c] border border-white/[0.03] rounded-lg py-2 flex flex-col">
                          <span className="text-xl font-extrabold font-mono text-white">
                            {getDurationBreakdown(selectedUser.aboutTime).seconds}
                          </span>
                          <span className="text-[9px] text-gray-500 font-medium uppercase tracking-wider mt-0.5">Seconds</span>
                        </div>
                      </div>

                      {/* Human Sentence format */}
                      <div className="text-[11px] bg-black/40 border border-white/[0.03] rounded-lg p-2.5 text-gray-400 font-mono text-center leading-relaxed">
                        Spent <strong className="text-blue-400">{getDurationBreakdown(selectedUser.aboutTime).hours} hours</strong>,{' '}
                        <strong className="text-blue-400">{getDurationBreakdown(selectedUser.aboutTime).minutes} minutes</strong>, and{' '}
                        <strong className="text-blue-400">{getDurationBreakdown(selectedUser.aboutTime).seconds} seconds</strong> in this part.
                      </div>

                      {/* Mini progress indicator */}
                      <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-blue-500 h-full rounded-full transition-all duration-500"
                          style={{ 
                            width: `${selectedUser.totalTime > 0 ? Math.min(100, ((selectedUser.aboutTime || 0) / selectedUser.totalTime) * 100) : 0}%` 
                          }}
                        />
                      </div>
                    </div>

                    {/* SECTION 2: NARRATIVE AI */}
                    <div className="bg-[#151515] hover:bg-[#181818] border border-white/5 hover:border-white/10 rounded-xl p-5 flex flex-col gap-4 transition-all duration-300 shadow-md">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                            <BrainCircuit size={16} />
                          </div>
                          <div>
                            <h5 className="font-semibold text-white text-sm">Narrative AI</h5>
                            <p className="text-[10px] text-gray-500 font-mono">Session AI Guide</p>
                          </div>
                        </div>
                        <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/10 text-purple-400">
                          {selectedUser.totalTime > 0 ? Math.round(((selectedUser.narrativeAiTime || 0) / selectedUser.totalTime) * 100) : 0}% of app
                        </span>
                      </div>

                      {/* Precise Grid breakdown */}
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-[#0c0c0c] border border-white/[0.03] rounded-lg py-2 flex flex-col">
                          <span className="text-xl font-extrabold font-mono text-white">
                            {getDurationBreakdown(selectedUser.narrativeAiTime).hours}
                          </span>
                          <span className="text-[9px] text-gray-500 font-medium uppercase tracking-wider mt-0.5">Hours</span>
                        </div>
                        <div className="bg-[#0c0c0c] border border-white/[0.03] rounded-lg py-2 flex flex-col">
                          <span className="text-xl font-extrabold font-mono text-white">
                            {getDurationBreakdown(selectedUser.narrativeAiTime).minutes}
                          </span>
                          <span className="text-[9px] text-gray-500 font-medium uppercase tracking-wider mt-0.5">Minutes</span>
                        </div>
                        <div className="bg-[#0c0c0c] border border-white/[0.03] rounded-lg py-2 flex flex-col">
                          <span className="text-xl font-extrabold font-mono text-white">
                            {getDurationBreakdown(selectedUser.narrativeAiTime).seconds}
                          </span>
                          <span className="text-[9px] text-gray-500 font-medium uppercase tracking-wider mt-0.5">Seconds</span>
                        </div>
                      </div>

                      {/* Human Sentence format */}
                      <div className="text-[11px] bg-black/40 border border-white/[0.03] rounded-lg p-2.5 text-gray-400 font-mono text-center leading-relaxed">
                        Spent <strong className="text-purple-400">{getDurationBreakdown(selectedUser.narrativeAiTime).hours} hours</strong>,{' '}
                        <strong className="text-purple-400">{getDurationBreakdown(selectedUser.narrativeAiTime).minutes} minutes</strong>, and{' '}
                        <strong className="text-purple-400">{getDurationBreakdown(selectedUser.narrativeAiTime).seconds} seconds</strong> in this part.
                      </div>

                      {/* Mini progress indicator */}
                      <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-purple-500 h-full rounded-full transition-all duration-500"
                          style={{ 
                            width: `${selectedUser.totalTime > 0 ? Math.min(100, ((selectedUser.narrativeAiTime || 0) / selectedUser.totalTime) * 100) : 0}%` 
                          }}
                        />
                      </div>
                    </div>

                    {/* SECTION 3: CHAT BOX */}
                    <div className="bg-[#151515] hover:bg-[#181818] border border-white/5 hover:border-white/10 rounded-xl p-5 flex flex-col gap-4 transition-all duration-300 shadow-md">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                            <MessageSquare size={16} />
                          </div>
                          <div>
                            <h5 className="font-semibold text-white text-sm">Chat Box</h5>
                            <p className="text-[10px] text-gray-500 font-mono">AI Chat Console</p>
                          </div>
                        </div>
                        <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400">
                          {selectedUser.totalTime > 0 ? Math.round(((selectedUser.chatTime || 0) / selectedUser.totalTime) * 100) : 0}% of app
                        </span>
                      </div>

                      {/* Precise Grid breakdown */}
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-[#0c0c0c] border border-white/[0.03] rounded-lg py-2 flex flex-col">
                          <span className="text-xl font-extrabold font-mono text-white">
                            {getDurationBreakdown(selectedUser.chatTime).hours}
                          </span>
                          <span className="text-[9px] text-gray-500 font-medium uppercase tracking-wider mt-0.5">Hours</span>
                        </div>
                        <div className="bg-[#0c0c0c] border border-white/[0.03] rounded-lg py-2 flex flex-col">
                          <span className="text-xl font-extrabold font-mono text-white">
                            {getDurationBreakdown(selectedUser.chatTime).minutes}
                          </span>
                          <span className="text-[9px] text-gray-500 font-medium uppercase tracking-wider mt-0.5">Minutes</span>
                        </div>
                        <div className="bg-[#0c0c0c] border border-white/[0.03] rounded-lg py-2 flex flex-col">
                          <span className="text-xl font-extrabold font-mono text-white">
                            {getDurationBreakdown(selectedUser.chatTime).seconds}
                          </span>
                          <span className="text-[9px] text-gray-500 font-medium uppercase tracking-wider mt-0.5">Seconds</span>
                        </div>
                      </div>

                      {/* Human Sentence format */}
                      <div className="text-[11px] bg-black/40 border border-white/[0.03] rounded-lg p-2.5 text-gray-400 font-mono text-center leading-relaxed">
                        Spent <strong className="text-emerald-400">{getDurationBreakdown(selectedUser.chatTime).hours} hours</strong>,{' '}
                        <strong className="text-emerald-400">{getDurationBreakdown(selectedUser.chatTime).minutes} minutes</strong>, and{' '}
                        <strong className="text-emerald-400">{getDurationBreakdown(selectedUser.chatTime).seconds} seconds</strong> in this part.
                      </div>

                      {/* Mini progress indicator */}
                      <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                          style={{ 
                            width: `${selectedUser.totalTime > 0 ? Math.min(100, ((selectedUser.chatTime || 0) / selectedUser.totalTime) * 100) : 0}%` 
                          }}
                        />
                      </div>
                    </div>

                    {/* SECTION 4: COMPLETE VOICE CHAT */}
                    <div className="bg-[#151515] hover:bg-[#181818] border border-white/5 hover:border-white/10 rounded-xl p-5 flex flex-col gap-4 transition-all duration-300 shadow-md">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-lg bg-pink-500/10 text-pink-400">
                            <Headphones size={16} />
                          </div>
                          <div>
                            <h5 className="font-semibold text-white text-sm">Complete Voice Chat</h5>
                            <p className="text-[10px] text-gray-500 font-mono">Immersive Real-Time Voice</p>
                          </div>
                        </div>
                        <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-pink-500/10 text-pink-400">
                          {selectedUser.totalTime > 0 ? Math.round(((selectedUser.completeVoiceTime || 0) / selectedUser.totalTime) * 100) : 0}% of app
                        </span>
                      </div>

                      {/* Precise Grid breakdown */}
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-[#0c0c0c] border border-white/[0.03] rounded-lg py-2 flex flex-col">
                          <span className="text-xl font-extrabold font-mono text-white">
                            {getDurationBreakdown(selectedUser.completeVoiceTime).hours}
                          </span>
                          <span className="text-[9px] text-gray-500 font-medium uppercase tracking-wider mt-0.5">Hours</span>
                        </div>
                        <div className="bg-[#0c0c0c] border border-white/[0.03] rounded-lg py-2 flex flex-col">
                          <span className="text-xl font-extrabold font-mono text-white">
                            {getDurationBreakdown(selectedUser.completeVoiceTime).minutes}
                          </span>
                          <span className="text-[9px] text-gray-500 font-medium uppercase tracking-wider mt-0.5">Minutes</span>
                        </div>
                        <div className="bg-[#0c0c0c] border border-white/[0.03] rounded-lg py-2 flex flex-col">
                          <span className="text-xl font-extrabold font-mono text-white">
                            {getDurationBreakdown(selectedUser.completeVoiceTime).seconds}
                          </span>
                          <span className="text-[9px] text-gray-500 font-medium uppercase tracking-wider mt-0.5">Seconds</span>
                        </div>
                      </div>

                      {/* Human Sentence format */}
                      <div className="text-[11px] bg-black/40 border border-white/[0.03] rounded-lg p-2.5 text-gray-400 font-mono text-center leading-relaxed">
                        Spent <strong className="text-pink-400">{getDurationBreakdown(selectedUser.completeVoiceTime).hours} hours</strong>,{' '}
                        <strong className="text-pink-400">{getDurationBreakdown(selectedUser.completeVoiceTime).minutes} minutes</strong>, and{' '}
                        <strong className="text-pink-400">{getDurationBreakdown(selectedUser.completeVoiceTime).seconds} seconds</strong> in this part.
                      </div>

                      {/* Mini progress indicator */}
                      <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-pink-500 h-full rounded-full transition-all duration-500"
                          style={{ 
                            width: `${selectedUser.totalTime > 0 ? Math.min(100, ((selectedUser.completeVoiceTime || 0) / selectedUser.totalTime) * 100) : 0}%` 
                          }}
                        />
                      </div>
                    </div>

                    {/* SECTION 5: CHARTED VOICE CHAT */}
                    <div className="bg-[#151515] hover:bg-[#181818] border border-white/5 hover:border-white/10 rounded-xl p-5 flex flex-col gap-4 transition-all duration-300 shadow-md md:col-span-2">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                            <Mic size={16} />
                          </div>
                          <div>
                            <h5 className="font-semibold text-white text-sm">Charted Voice Chat</h5>
                            <p className="text-[10px] text-gray-500 font-mono">Hybrid Guided Soundscapes</p>
                          </div>
                        </div>
                        <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400">
                          {selectedUser.totalTime > 0 ? Math.round(((selectedUser.chartedVoiceTime || 0) / selectedUser.totalTime) * 100) : 0}% of app
                        </span>
                      </div>

                      {/* Precise Grid breakdown */}
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-[#0c0c0c] border border-white/[0.03] rounded-lg py-2 flex flex-col">
                          <span className="text-xl font-extrabold font-mono text-white">
                            {getDurationBreakdown(selectedUser.chartedVoiceTime).hours}
                          </span>
                          <span className="text-[9px] text-gray-500 font-medium uppercase tracking-wider mt-0.5">Hours</span>
                        </div>
                        <div className="bg-[#0c0c0c] border border-white/[0.03] rounded-lg py-2 flex flex-col">
                          <span className="text-xl font-extrabold font-mono text-white">
                            {getDurationBreakdown(selectedUser.chartedVoiceTime).minutes}
                          </span>
                          <span className="text-[9px] text-gray-500 font-medium uppercase tracking-wider mt-0.5">Minutes</span>
                        </div>
                        <div className="bg-[#0c0c0c] border border-white/[0.03] rounded-lg py-2 flex flex-col">
                          <span className="text-xl font-extrabold font-mono text-white">
                            {getDurationBreakdown(selectedUser.chartedVoiceTime).seconds}
                          </span>
                          <span className="text-[9px] text-gray-500 font-medium uppercase tracking-wider mt-0.5">Seconds</span>
                        </div>
                      </div>

                      {/* Human Sentence format */}
                      <div className="text-[11px] bg-black/40 border border-white/[0.03] rounded-lg p-2.5 text-gray-400 font-mono text-center leading-relaxed">
                        Spent <strong className="text-amber-400">{getDurationBreakdown(selectedUser.chartedVoiceTime).hours} hours</strong>,{' '}
                        <strong className="text-amber-400">{getDurationBreakdown(selectedUser.chartedVoiceTime).minutes} minutes</strong>, and{' '}
                        <strong className="text-amber-400">{getDurationBreakdown(selectedUser.chartedVoiceTime).seconds} seconds</strong> in this part.
                      </div>

                      {/* Mini progress indicator */}
                      <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-amber-500 h-full rounded-full transition-all duration-500"
                          style={{ 
                            width: `${selectedUser.totalTime > 0 ? Math.min(100, ((selectedUser.chartedVoiceTime || 0) / selectedUser.totalTime) * 100) : 0}%` 
                          }}
                        />
                      </div>
                    </div>

                  </div>
                </div>

                {/* Additional Metadata / System Diagnostics */}
                <div className="flex flex-col gap-3 mt-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-white">Session Analytics & Device Context</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col gap-2 text-xs">
                      <div className="flex items-center gap-2 text-gray-400">
                        <MessageSquare size={14} className="text-indigo-400" />
                        <span className="font-semibold text-white">Interactive Analytics</span>
                      </div>
                      <span className="text-base font-extrabold text-white mt-1">
                        {selectedUser.messageCount || 0} AI queries processed
                      </span>
                      <span className="text-[10px] text-gray-500 leading-normal">
                        Accumulated total user conversation entries streamed and logged with Gemini.
                      </span>
                    </div>

                    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col gap-2 text-xs">
                      <div className="flex items-center gap-2 text-gray-400">
                        <Laptop size={14} className="text-emerald-400" />
                        <span className="font-semibold text-white">Hardware & Client Node</span>
                      </div>
                      <span className="text-sm font-bold text-white mt-1 leading-snug">
                        {parseUserAgent(selectedUser.browserInfo)}
                      </span>
                      <span className="text-[10px] text-gray-500 truncate mt-auto">
                        Raw: {selectedUser.browserInfo}
                      </span>
                    </div>

                  </div>

                  <div className="p-4 rounded-xl bg-white/[0.01] border border-white/5 flex flex-col gap-3 text-xs">
                    <span className="font-semibold text-gray-400 uppercase tracking-wider text-[10px]">Session Logs Timestamps</span>
                    
                    <div className="grid grid-cols-2 gap-4 font-mono text-[10px]">
                      <div className="flex flex-col gap-1">
                        <span className="text-gray-500 uppercase">First login tracked</span>
                        <span className="text-gray-300">
                          {selectedUser.lastLoginAt ? new Date(selectedUser.lastLoginAt).toLocaleString() : 'Never'}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-gray-500 uppercase">Last active beacon</span>
                        <span className="text-gray-300">
                          {selectedUser.lastActiveAt ? new Date(selectedUser.lastActiveAt).toLocaleString() : 'Never'}
                        </span>
                      </div>
                      {selectedUser.lastLogoutAt && (
                        <div className="flex flex-col gap-1 col-span-2">
                          <span className="text-gray-500 uppercase">Last tracked sign-out</span>
                          <span className="text-gray-300">
                            {new Date(selectedUser.lastLogoutAt).toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

              </div>

            </motion.div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-gray-500 gap-3">
              <Info size={32} className="text-gray-600 animate-pulse" />
              <div className="flex flex-col gap-1">
                <span className="text-sm font-bold text-gray-400">No active inspector target</span>
                <span className="text-xs text-gray-600">Select a user from the registered users queue to trace their logs.</span>
              </div>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Custom Confirmation Modal */}
      <AnimatePresence>
        {modalConfig && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              transition={{ type: 'spring', duration: 0.4 }}
              className="bg-zinc-950 border border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4 text-left overflow-hidden"
            >
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-xl shrink-0 ${
                  modalConfig.type === 'confirm' 
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    : modalConfig.type === 'error'
                      ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                      : modalConfig.type === 'success'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                }`}>
                  {modalConfig.type === 'confirm' && <AlertTriangle size={24} />}
                  {modalConfig.type === 'error' && <ShieldAlert size={24} />}
                  {modalConfig.type === 'success' && <CheckCircle size={24} />}
                  {modalConfig.type === 'info' && <Info size={24} />}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-white leading-snug">
                    {modalConfig.title}
                  </h3>
                  <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                    {modalConfig.message}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 mt-2">
                {modalConfig.type === 'confirm' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setModalConfig(null)}
                      className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 rounded-xl text-xs font-bold transition-colors"
                    >
                      {modalConfig.cancelText || 'Cancel'}
                    </button>
                    <button
                      type="button"
                      onClick={modalConfig.onConfirm}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        modalConfig.title.toLowerCase().includes('erase') || modalConfig.title.toLowerCase().includes('restrict')
                          ? 'bg-red-500 hover:bg-red-600 text-white shadow-[0_0_12px_rgba(239,68,68,0.2)]'
                          : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                      }`}
                    >
                      {modalConfig.confirmText || 'Confirm'}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setModalConfig(null)}
                    className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 rounded-xl text-xs font-bold transition-colors w-full sm:w-auto"
                  >
                    Got it
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom Toast Alert */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, x: 100, y: 0 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, x: 100 }}
            className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-zinc-950/90 backdrop-blur-md border border-zinc-800 p-4 rounded-xl shadow-2xl max-w-sm pointer-events-auto animate-in"
          >
            <div className={`p-1.5 rounded-lg ${
              toast.type === 'success' 
                ? 'bg-emerald-500/10 text-emerald-400' 
                : toast.type === 'error'
                  ? 'bg-red-500/10 text-red-400'
                  : 'bg-blue-500/10 text-blue-400'
            }`}>
              {toast.type === 'success' && <CheckCircle size={16} />}
              {toast.type === 'error' && <ShieldAlert size={16} />}
              {toast.type === 'info' && <Info size={16} />}
            </div>
            <p className="text-xs font-medium text-gray-200 pr-4">
              {toast.message}
            </p>
            <button
              onClick={() => setToast(null)}
              className="text-gray-500 hover:text-gray-300 ml-auto"
            >
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
