'use client';

import * as React from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  geminiManager, 
  KeyPingResult, 
  KeepAliveProgress, 
  KeepAliveSummary 
} from '../lib/gemini-manager';
import { cn } from '../lib/utils';
import { 
  Key, 
  Activity, 
  ToggleLeft, 
  ToggleRight, 
  Sparkles, 
  RefreshCw, 
  Search, 
  Filter, 
  Shield, 
  AlertTriangle, 
  ChevronDown, 
  ChevronUp, 
  User, 
  AppWindow, 
  Clock, 
  Zap, 
  ShieldCheck, 
  CheckCircle2, 
  Sliders, 
  Square, 
  Terminal, 
  X 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface KeyDetail {
  index: number;
  keyId: string;
  masked: string;
  status: 'active' | 'inactive';
  isExhausted: boolean;
  useCount: number;
  percentage: number;
  lastUsed: string | null;
}

interface UsageLog {
  id: string;
  keyHash: string;
  maskedKey: string;
  email: string;
  userId: string;
  type: string;
  timestamp: string;
}

function formatTimeAgo(dateString: string | null): string {
  if (!dateString) return 'Never used';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  
  if (diffMs < 0) return 'Just now';
  
  const diffMins = Math.floor(diffMs / (1000 * 60));
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min${diffMins === 1 ? '' : 's'} ago`;
  
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs} hr${diffHrs === 1 ? '' : 's'} ago`;
  
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 30) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  
  const diffMonths = Math.floor(diffDays / 30);
  return `${diffMonths} month${diffMonths === 1 ? '' : 's'} ago`;
}

export function ApiKeysManagement() {
  const [keys, setKeys] = React.useState<KeyDetail[]>([]);
  const [logs, setLogs] = React.useState<UsageLog[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<'all' | 'active' | 'inactive' | 'exhausted' | 'stale' | 'never'>('all');
  const [sortBy, setSortBy] = React.useState<'index' | 'usage' | 'percentage' | 'lastUsed' | 'oldestUsed'>('index');
  const [expandedKeyId, setExpandedKeyId] = React.useState<string | null>(null);

  // Keep-Alive cluster routine states
  const [isKeepAliveModalOpen, setIsKeepAliveModalOpen] = React.useState(false);
  const [isKeepAliveRunning, setIsKeepAliveRunning] = React.useState(false);
  const [keepAliveProgress, setKeepAliveProgress] = React.useState<KeepAliveProgress | null>(null);
  const [lastKeepAliveInfo, setLastKeepAliveInfo] = React.useState<KeepAliveSummary | null>(null);
  const [pingQuery, setPingQuery] = React.useState('ping');
  const [showSettings, setShowSettings] = React.useState(false);
  const [concurrency, setConcurrency] = React.useState(3);
  const [singleKeyPinging, setSingleKeyPinging] = React.useState<number | null>(null);
  const [singleKeyResults, setSingleKeyResults] = React.useState<Record<number, KeyPingResult>>({});
  const abortControllerRef = React.useRef<AbortController | null>(null);
  const terminalLogsEndRef = React.useRef<HTMLDivElement | null>(null);

  // Auto-scroll terminal log as results stream in
  React.useEffect(() => {
    if (isKeepAliveModalOpen && terminalLogsEndRef.current) {
      terminalLogsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [keepAliveProgress?.results.length, isKeepAliveModalOpen]);

  // Load all statuses, logs and keep-alive info from Firestore
  const loadData = React.useCallback(async (showSyncLoader = false) => {
    if (showSyncLoader) setIsSyncing(true);
    else setIsLoading(true);

    try {
      // 1. Fetch live active/inactive statuses from firestore to update geminiManager memory
      await geminiManager.fetchStatuses();

      // 2. Fetch last keep-alive record
      const localKeepAlive = geminiManager.getLastKeepAliveInfo();
      if (localKeepAlive) {
        setLastKeepAliveInfo(localKeepAlive);
      } else {
        const firestoreKeepAlive = await geminiManager.getKeepAliveSummaryFromFirestore();
        if (firestoreKeepAlive) setLastKeepAliveInfo(firestoreKeepAlive);
      }

      // 3. Fetch usage logs from firestore
      const logsSnap = await getDocs(query(collection(db, 'api_key_logs'), orderBy('timestamp', 'desc')));
      const fetchedLogs: UsageLog[] = [];
      logsSnap.forEach((doc) => {
        const data = doc.data();
        fetchedLogs.push({
          id: doc.id,
          keyHash: data.keyHash || '',
          maskedKey: data.maskedKey || '',
          email: data.email || 'anonymous',
          userId: data.userId || 'anonymous',
          type: data.type || 'unknown',
          timestamp: data.timestamp || ''
        });
      });
      setLogs(fetchedLogs);

      // 4. Compute usage stats
      const keyStatsMap: Record<string, { count: number; lastUsed: string | null }> = {};
      const totalUsageCount = fetchedLogs.length;

      fetchedLogs.forEach((log) => {
        if (!keyStatsMap[log.keyHash]) {
          keyStatsMap[log.keyHash] = { count: 0, lastUsed: null };
        }
        keyStatsMap[log.keyHash].count += 1;
        if (!keyStatsMap[log.keyHash].lastUsed || log.timestamp > (keyStatsMap[log.keyHash].lastUsed || '')) {
          keyStatsMap[log.keyHash].lastUsed = log.timestamp;
        }
      });

      // 5. Map raw keys with statuses and usage statistics
      const rawDetails = geminiManager.getAllKeysDetails();
      const updatedKeys: KeyDetail[] = rawDetails.map((k) => {
        const stats = keyStatsMap[k.keyId] || { count: 0, lastUsed: null };
        const percentage = totalUsageCount > 0 ? (stats.count / totalUsageCount) * 100 : 0;
        return {
          ...k,
          useCount: stats.count,
          percentage: Number(percentage.toFixed(2)),
          lastUsed: stats.lastUsed
        };
      });

      setKeys(updatedKeys);
    } catch (e) {
      console.error("Error loading API Key Management data:", e);
      handleFirestoreError(e, OperationType.LIST, 'api_key_logs');
    } finally {
      setIsLoading(false);
      setIsSyncing(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Handler for individual status toggle
  const handleToggleStatus = async (keyId: string, currentStatus: 'active' | 'inactive') => {
    const nextStatus = currentStatus === 'active' ? 'inactive' : 'active';
    
    // Optimistic UI state update
    setKeys(prev => prev.map(k => k.keyId === keyId ? { ...k, status: nextStatus } : k));

    try {
      await geminiManager.setKeyStatus(keyId, nextStatus);
    } catch (e) {
      console.error(`Failed to toggle status for key ${keyId}:`, e);
      // Revert state on error
      setKeys(prev => prev.map(k => k.keyId === keyId ? { ...k, status: currentStatus } : k));
    }
  };

  // Bulk actions: Activate/Deactivate all keys
  const handleBulkStatusChange = async (status: 'active' | 'inactive') => {
    setKeys(prev => prev.map(k => ({ ...k, status })));
    setIsSyncing(true);
    try {
      await geminiManager.setAllKeysStatus(status);
    } catch (e) {
      console.error(`Bulk status update failed to ${status}:`, e);
      await loadData(); // revert on fail
    } finally {
      setIsSyncing(false);
    }
  };

  // Start 6-Month Inactivity Keep-Alive Routine
  const handleStartKeepAlive = async (onlyStale: boolean = false) => {
    if (isKeepAliveRunning) return;

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsKeepAliveRunning(true);
    setIsKeepAliveModalOpen(true);

    const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const staleKeys = keys.filter(k => !k.lastUsed || (now - new Date(k.lastUsed).getTime() > ninetyDaysMs));
    const targetTotal = onlyStale ? staleKeys.length : keys.length;

    setKeepAliveProgress({
      total: targetTotal,
      current: 0,
      successCount: 0,
      failCount: 0,
      currentKeyMasked: '',
      currentKeyIndex: -1,
      results: [],
      isFinished: false,
      isCancelled: false,
      statusMessage: 'Initiating 6-month keep-alive query across cluster...'
    });

    try {
      await geminiManager.runKeepAliveRoutine({
        prompt: pingQuery.trim() || 'ping',
        concurrency,
        delayMs: 120,
        onlyStaleKeys: onlyStale,
        signal: controller.signal,
        onProgress: (p) => {
          setKeepAliveProgress({ ...p });
        }
      });

      const updatedInfo = geminiManager.getLastKeepAliveInfo();
      if (updatedInfo) {
        setLastKeepAliveInfo(updatedInfo);
      }
    } catch (err: any) {
      console.error("Keep-Alive routine error:", err);
    } finally {
      setIsKeepAliveRunning(false);
      abortControllerRef.current = null;
      // Refresh background table
      loadData(true);
    }
  };

  // Stop currently running routine
  const handleCancelKeepAlive = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  // Ping a single individual key directly from its table row
  const handlePingIndividualKey = async (index: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (singleKeyPinging !== null || isKeepAliveRunning) return;

    setSingleKeyPinging(index);
    try {
      const result = await geminiManager.pingKeyByIndex(index, pingQuery.trim() || 'ping');
      setSingleKeyResults(prev => ({ ...prev, [index]: result }));

      // Optimistically update key in table
      setKeys(prev => prev.map((k, i) => i === index ? {
        ...k,
        useCount: k.useCount + 1,
        lastUsed: new Date().toISOString(),
        isExhausted: result.status === 'quota_exhausted'
      } : k));
    } catch (err: any) {
      console.error(`Failed to ping key #${index + 1}:`, err);
    } finally {
      setSingleKeyPinging(null);
    }
  };

  // Filter & Sort Logic
  const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const staleKeysCount = keys.filter(k => !k.lastUsed || (now - new Date(k.lastUsed).getTime() > ninetyDaysMs)).length;

  const filteredKeys = React.useMemo(() => {
    const filterNinetyDaysMs = 90 * 24 * 60 * 60 * 1000;
    const filterNow = Date.now();

    const result = keys.filter(k => {
      const matchesSearch = k.masked.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            k.keyId.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            `key #${k.index + 1}`.includes(searchQuery.toLowerCase());
      
      const isStale = !k.lastUsed || (filterNow - new Date(k.lastUsed).getTime() > filterNinetyDaysMs);
      const isNever = !k.lastUsed;

      const matchesFilter = statusFilter === 'all' || 
                            (statusFilter === 'active' && k.status === 'active') ||
                            (statusFilter === 'inactive' && k.status === 'inactive') ||
                            (statusFilter === 'exhausted' && k.isExhausted) ||
                            (statusFilter === 'stale' && isStale) ||
                            (statusFilter === 'never' && isNever);
      
      return matchesSearch && matchesFilter;
    });

    return result.sort((a, b) => {
      if (sortBy === 'index') return a.index - b.index;
      if (sortBy === 'usage') return b.useCount - a.useCount;
      if (sortBy === 'percentage') return b.percentage - a.percentage;
      if (sortBy === 'lastUsed') {
        const timeA = a.lastUsed ? new Date(a.lastUsed).getTime() : 0;
        const timeB = b.lastUsed ? new Date(b.lastUsed).getTime() : 0;
        return timeB - timeA;
      }
      if (sortBy === 'oldestUsed') {
        const timeA = a.lastUsed ? new Date(a.lastUsed).getTime() : 0;
        const timeB = b.lastUsed ? new Date(b.lastUsed).getTime() : 0;
        return timeA - timeB;
      }
      return 0;
    });
  }, [keys, searchQuery, statusFilter, sortBy]);

  // Aggregate Key Statistics for DashCards
  const totalKeys = keys.length;
  const activeKeysCount = keys.filter(k => k.status === 'active').length;
  const inactiveKeysCount = keys.filter(k => k.status === 'inactive').length;
  const exhaustedKeysCount = keys.filter(k => k.isExhausted).length;
  const totalRequests = logs.length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-foreground" id="api-keys-dashboard">
      {/* Page Title & Sync */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent flex items-center gap-3">
            <Key size={32} className="text-cyan-400 animate-pulse" />
            Strategic API Cluster Console
          </h1>
          <p className="text-muted text-sm mt-1">
            Real-time health telemetry, usage profiles, and 6-month inactivity keep-alive for all {totalKeys} cluster keys.
          </p>
        </div>
        <div className="flex items-center gap-3 self-start md:self-auto">
          <button
            onClick={() => loadData(true)}
            disabled={isSyncing || isLoading}
            className="flex items-center gap-2 px-4 py-2.5 bg-foreground/5 hover:bg-foreground/10 border border-foreground/10 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} />
            <span>Sync Live</span>
          </button>
        </div>
      </div>

      {/* Loading Overlay */}
      {isLoading ? (
        <div className="h-96 flex flex-col items-center justify-center gap-4 text-muted">
          <RefreshCw className="animate-spin text-cyan-400" size={40} />
          <p className="text-sm font-semibold tracking-wider uppercase animate-pulse">Gathering cluster telemetry...</p>
        </div>
      ) : (
        <>
          {/* Telemetry Bento Board */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            <div className="p-4 bg-gray-dark border border-foreground/5 rounded-2xl flex flex-col justify-between shadow-xl">
              <span className="text-[10px] text-muted font-bold uppercase tracking-widest">Total Keys</span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold">{totalKeys}</span>
                <span className="text-xs text-muted">Cluster</span>
              </div>
            </div>
            
            <div className="p-4 bg-gray-dark border border-green-500/10 rounded-2xl flex flex-col justify-between shadow-xl">
              <span className="text-[10px] text-green-500 font-bold uppercase tracking-widest flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-ping" />
                Active
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-green-400">{activeKeysCount}</span>
                <span className="text-xs text-muted">Online</span>
              </div>
            </div>

            <div className="p-4 bg-gray-dark border border-red-500/10 rounded-2xl flex flex-col justify-between shadow-xl">
              <span className="text-[10px] text-red-500 font-bold uppercase tracking-widest">Inactive</span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-red-400">{inactiveKeysCount}</span>
                <span className="text-xs text-muted">Gated</span>
              </div>
            </div>

            <div className="p-4 bg-gray-dark border border-amber-500/10 rounded-2xl flex flex-col justify-between shadow-xl">
              <span className="text-[10px] text-amber-500 font-bold uppercase tracking-widest flex items-center gap-1.5">
                <AlertTriangle size={12} />
                Exhausted
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-amber-400">{exhaustedKeysCount}</span>
                <span className="text-xs text-muted">Rate Limited</span>
              </div>
            </div>

            <div className="p-4 bg-gray-dark border border-foreground/5 rounded-2xl flex flex-col justify-between shadow-xl col-span-2 lg:col-span-1">
              <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest flex items-center gap-1.5">
                <Activity size={12} className="animate-pulse" />
                Total Requests
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-cyan-400">{totalRequests}</span>
                <span className="text-xs text-muted">Logged</span>
              </div>
            </div>
          </div>

          {/* 6-Month Inactivity Keep-Alive Shield Guardian Card */}
          <div className="p-5 bg-gray-dark border border-cyan-500/20 rounded-2xl shadow-xl mb-8 relative overflow-hidden">
            <div className="absolute -right-12 -top-12 w-48 h-48 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
              <div className="space-y-2 max-w-3xl">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    <ShieldCheck size={14} className="text-cyan-400" />
                    6-Month Inactivity Guardian
                  </span>
                  
                  {staleKeysCount === 0 ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-green-500/10 text-green-400 border border-green-500/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-ping" />
                      All {totalKeys} Keys Fresh & Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                      {staleKeysCount} Keys Need Keep-Alive Refresh
                    </span>
                  )}

                  {lastKeepAliveInfo && (
                    <span className="text-xs text-muted font-mono">
                      Last run: {formatTimeAgo(lastKeepAliveInfo.lastRunAt)} ({lastKeepAliveInfo.successCount}/{lastKeepAliveInfo.totalKeys} OK)
                    </span>
                  )}
                </div>

                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <span>Keep API Keys Active Forever (Inactivity Prevention)</span>
                </h2>

                <p className="text-sm text-muted leading-relaxed">
                  Google automatically deactivates Gemini API keys that remain idle for 6 months. To keep your full cluster of {totalKeys} keys active forever, clicking below sends a micro-query (<code className="text-cyan-400 bg-black-deep px-1.5 py-0.5 rounded text-xs font-mono">&quot;{pingQuery || 'ping'}&quot;</code>) to every API key, resetting Google&apos;s 6-month inactivity timer and confirming operational health.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-auto shrink-0">
                <button
                  onClick={() => handleStartKeepAlive(false)}
                  disabled={isKeepAliveRunning || totalKeys === 0}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-extrabold rounded-xl shadow-lg hover:shadow-cyan-500/20 transition-all text-sm disabled:opacity-50 cursor-pointer"
                  title="Send micro-query to all keys across the cluster to keep them active forever"
                >
                  <Zap size={16} className="fill-black" />
                  <span>Ping All {totalKeys} Keys</span>
                </button>

                {staleKeysCount > 0 && (
                  <button
                    onClick={() => handleStartKeepAlive(true)}
                    disabled={isKeepAliveRunning}
                    className="flex items-center gap-1.5 px-3.5 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 font-semibold rounded-xl text-xs transition-all cursor-pointer"
                    title="Only ping keys that haven't been used in > 90 days or never used"
                  >
                    <Clock size={14} className="text-amber-400" />
                    <span>Ping Stale Keys ({staleKeysCount})</span>
                  </button>
                )}

                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className={cn(
                    "p-2.5 rounded-xl border text-sm transition-all cursor-pointer",
                    showSettings 
                      ? "bg-cyan-500/15 border-cyan-500/30 text-cyan-400" 
                      : "bg-black-deep border-foreground/10 text-muted hover:text-foreground"
                  )}
                  title="Query & speed configuration"
                >
                  <Sliders size={16} />
                </button>
              </div>
            </div>

            {/* Collapsible Advanced Settings */}
            <AnimatePresence>
              {showSettings && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="mt-4 pt-4 border-t border-foreground/5 grid grid-cols-1 sm:grid-cols-3 gap-4"
                >
                  <div>
                    <label className="block text-xs font-semibold text-muted mb-1">Micro-Query Text</label>
                    <input
                      type="text"
                      value={pingQuery}
                      onChange={(e) => setPingQuery(e.target.value)}
                      placeholder="ping"
                      className="w-full bg-black-deep border border-foreground/10 rounded-lg px-3 py-1.5 text-xs text-foreground font-mono focus:outline-none focus:border-cyan-500"
                    />
                    <span className="text-[10px] text-muted mt-1 block">Minimal query sent to each key (~1 token)</span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted mb-1">Concurrency (Workers)</label>
                    <select
                      value={concurrency}
                      onChange={(e) => setConcurrency(Number(e.target.value))}
                      className="w-full bg-black-deep border border-foreground/10 rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-cyan-500 cursor-pointer"
                    >
                      <option value={1}>1 key at a time (Sequential)</option>
                      <option value={2}>2 keys concurrently</option>
                      <option value={3}>3 keys concurrently (Recommended, ~20s)</option>
                      <option value={4}>4 keys concurrently (Fast)</option>
                      <option value={5}>5 keys concurrently (High Speed)</option>
                    </select>
                    <span className="text-[10px] text-muted mt-1 block">Parallel workers to avoid rate spikes</span>
                  </div>

                  <div className="flex flex-col justify-end">
                    <div className="p-2.5 bg-black-deep/60 border border-foreground/5 rounded-lg text-[11px] text-muted">
                      <span className="font-semibold text-foreground/90">Estimated Runtime:</span> ~{Math.ceil(totalKeys / concurrency * 0.6)}s for all {totalKeys} keys. Zero measurable quota consumed.
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Controls & Search panel */}
          <div className="p-4 bg-gray-dark border border-foreground/5 rounded-2xl shadow-xl mb-8 flex flex-col gap-4">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              {/* Search Bar */}
              <div className="relative w-full md:max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" size={18} />
                <input
                  type="text"
                  placeholder="Search key signature, index or hash..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-black-deep border border-foreground/10 hover:border-foreground/25 focus:border-cyan-500 rounded-xl py-2.5 pl-11 pr-4 text-sm focus:outline-none transition-all placeholder:text-muted"
                />
              </div>

              {/* Filtering & Sorting */}
              <div className="flex flex-wrap gap-3 items-center w-full md:w-auto">
                {/* Status Filter */}
                <div className="flex items-center gap-2 bg-black-deep border border-foreground/10 px-3 py-1.5 rounded-xl">
                  <Filter size={14} className="text-muted" />
                  <select
                    value={statusFilter}
                    onChange={(e: any) => setStatusFilter(e.target.value)}
                    className="bg-transparent text-sm focus:outline-none cursor-pointer pr-1"
                  >
                    <option value="all">All States</option>
                    <option value="active">Active Only</option>
                    <option value="inactive">Inactive Only</option>
                    <option value="exhausted">Exhausted Only</option>
                    <option value="stale">Stale (&gt;90 Days)</option>
                    <option value="never">Never Used</option>
                  </select>
                </div>

                {/* Sorting */}
                <div className="flex items-center gap-2 bg-black-deep border border-foreground/10 px-3 py-1.5 rounded-xl">
                  <span className="text-xs text-muted font-bold uppercase tracking-wider">Sort:</span>
                  <select
                    value={sortBy}
                    onChange={(e: any) => setSortBy(e.target.value)}
                    className="bg-transparent text-sm focus:outline-none cursor-pointer pr-1"
                  >
                    <option value="index">Key Index</option>
                    <option value="usage">Usage Count</option>
                    <option value="percentage">Percentage</option>
                    <option value="lastUsed">Most Recently Used</option>
                    <option value="oldestUsed">Oldest / Never Used</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Bulk Gating Actions */}
            <div className="border-t border-foreground/5 pt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <span className="text-xs text-muted flex items-center gap-1.5">
                <Shield size={14} className="text-cyan-400" />
                Global cluster overrides bypass individual toggles. Apply with caution.
              </span>
              <div className="flex gap-3">
                <button
                  onClick={() => handleBulkStatusChange('inactive')}
                  className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  Deactivate All Keys
                </button>
                <button
                  onClick={() => handleBulkStatusChange('active')}
                  className="px-4 py-2 bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  Activate All Keys
                </button>
              </div>
            </div>
          </div>

          {/* API Keys Table/List */}
          <div className="space-y-3">
            <div className="hidden md:grid grid-cols-12 px-6 py-3 text-xs text-muted uppercase font-extrabold tracking-wider border-b border-foreground/5">
              <div className="col-span-2">Cluster Unit</div>
              <div className="col-span-2">Masked Signature</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2">Usage Metric</div>
              <div className="col-span-2">Last Usage Time</div>
              <div className="col-span-2 text-right">Actions</div>
            </div>

            {filteredKeys.length === 0 ? (
              <div className="p-12 text-center text-muted bg-gray-dark border border-foreground/5 rounded-2xl">
                <AlertTriangle size={32} className="mx-auto text-amber-500 mb-3 animate-pulse" />
                <p className="text-sm">No connected API Keys match your selected search criteria.</p>
              </div>
            ) : (
              filteredKeys.map((k) => {
                const isExpanded = expandedKeyId === k.keyId;
                const specificLogs = logs.filter(log => log.keyHash === k.keyId);
                const pingResult = singleKeyResults[k.index];

                return (
                  <div
                    key={k.keyId}
                    className="bg-gray-dark border border-foreground/5 rounded-2xl hover:border-foreground/15 transition-all overflow-hidden shadow-md"
                  >
                    {/* Header Row */}
                    <div
                      onClick={() => setExpandedKeyId(isExpanded ? null : k.keyId)}
                      className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center px-6 py-4.5 cursor-pointer select-none"
                    >
                      {/* Name/Index */}
                      <div className="col-span-2 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center font-mono text-xs font-bold">
                          #{k.index + 1}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-sm">Cluster Key</span>
                          <span className="text-[10px] font-mono text-muted">{k.keyId}</span>
                        </div>
                      </div>

                      {/* Masked Signature */}
                      <div className="col-span-2 font-mono text-sm tracking-wider text-muted flex flex-col justify-center">
                        <div className="flex items-center gap-1.5">
                          <Key size={14} className="text-cyan-400/40" />
                          <span>{k.masked}</span>
                        </div>
                        {pingResult && (
                          <div className="mt-1">
                            {pingResult.status === 'success' ? (
                              <span className="text-[10px] text-green-400 font-sans font-bold flex items-center gap-1">
                                ✔ {pingResult.message} ({pingResult.latencyMs}ms)
                              </span>
                            ) : pingResult.status === 'quota_exhausted' ? (
                              <span className="text-[10px] text-amber-400 font-sans font-bold flex items-center gap-1">
                                ⚠ Quota ({pingResult.latencyMs}ms)
                              </span>
                            ) : (
                              <span className="text-[10px] text-red-400 font-sans font-bold flex items-center gap-1">
                                ✖ Error ({pingResult.latencyMs}ms)
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Status dot and label */}
                      <div className="col-span-2">
                        {k.isExhausted ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            Exhausted (429)
                          </span>
                        ) : k.status === 'active' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-green-500/15 text-green-400 border border-green-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-ping" />
                            Active (Online)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-500/15 text-red-400 border border-red-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                            Inactive (Gated)
                          </span>
                        )}
                      </div>

                      {/* Usage Count & Percentage */}
                      <div className="col-span-2 flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-sm font-bold">
                          <span>{k.useCount} uses</span>
                          <span className="text-xs text-muted">({k.percentage}%)</span>
                        </div>
                        <div className="w-full bg-black-deep h-1 rounded-full overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-cyan-400 to-blue-500 h-full"
                            style={{ width: `${Math.min(100, k.percentage)}%` }}
                          />
                        </div>
                      </div>

                      {/* Last used timestamp */}
                      <div className="col-span-2 text-xs text-muted flex flex-col">
                        <span className="font-semibold text-foreground/80">Last Usage Time</span>
                        <div className="flex flex-col">
                          <span>{k.lastUsed ? new Date(k.lastUsed).toLocaleString() : 'Never logged'}</span>
                          <span className="text-[10px] text-cyan-400 font-bold mt-0.5">{formatTimeAgo(k.lastUsed)}</span>
                        </div>
                      </div>

                      {/* Expansion, Ping & Switch Actions */}
                      <div className="col-span-2 flex items-center justify-end gap-2.5" onClick={(e) => e.stopPropagation()}>
                        {/* Single key ping button */}
                        <button
                          onClick={(e) => handlePingIndividualKey(k.index, e)}
                          disabled={singleKeyPinging === k.index || isKeepAliveRunning}
                          className="px-2.5 py-1 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all disabled:opacity-50 cursor-pointer"
                          title="Ping this key with micro-query to reset 6-month inactivity timer"
                        >
                          <Zap size={12} className={singleKeyPinging === k.index ? 'animate-spin' : ''} />
                          <span>{singleKeyPinging === k.index ? '...' : 'Ping'}</span>
                        </button>

                        {/* Interactive toggle switch */}
                        <button
                          onClick={() => handleToggleStatus(k.keyId, k.status)}
                          className="text-muted hover:text-foreground transition-all focus:outline-none cursor-pointer"
                          title={k.status === 'active' ? 'Deactivate Key' : 'Activate Key'}
                        >
                          {k.status === 'active' ? (
                            <ToggleRight size={28} className="text-green-400 cursor-pointer" />
                          ) : (
                            <ToggleLeft size={28} className="text-muted cursor-pointer" />
                          )}
                        </button>
                        
                        {/* Expand indicator */}
                        <button
                          onClick={() => setExpandedKeyId(isExpanded ? null : k.keyId)}
                          className="p-1 hover:bg-black-deep/40 rounded-lg text-muted hover:text-foreground transition-all cursor-pointer"
                        >
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </div>
                    </div>

                    {/* Detailed Breakdown Drawer */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="border-t border-foreground/5 bg-black-deep/40 px-6 py-4"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
                              <Sparkles size={12} className="text-cyan-400" />
                              Historical Request Logs ({specificLogs.length})
                            </span>
                            <span className="text-[10px] text-muted">Showing all recorded transactions</span>
                          </div>

                          {specificLogs.length === 0 ? (
                            <div className="p-4 text-center text-xs text-muted font-mono bg-gray-dark/50 rounded-xl border border-foreground/5">
                              No authenticated AI operations have been routed to this unit yet.
                            </div>
                          ) : (
                            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                              <div className="grid grid-cols-12 text-[10px] font-bold text-muted uppercase tracking-wider px-3 pb-1 border-b border-foreground/5">
                                <div className="col-span-5 flex items-center gap-1.5">
                                  <User size={10} />
                                  Email Identification
                                </div>
                                <div className="col-span-4 flex items-center gap-1.5">
                                  <AppWindow size={10} />
                                  Platform Interface Form
                                </div>
                                <div className="col-span-3 flex items-center gap-1.5">
                                  <Clock size={10} />
                                  Timestamp
                                </div>
                              </div>
                              {specificLogs.map((log) => (
                                <div
                                  key={log.id}
                                  className="grid grid-cols-12 text-xs py-2 px-3 bg-gray-dark/50 border border-foreground/5 rounded-lg font-mono items-center hover:border-cyan-500/10 transition-all"
                                >
                                  <div className="col-span-5 text-foreground/90 truncate pr-3">{log.email}</div>
                                  <div className="col-span-4">
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-cyan-500/10 text-cyan-400 font-sans border border-cyan-500/20 capitalize">
                                      {log.type.replace('_', ' ')}
                                    </span>
                                  </div>
                                  <div className="col-span-3 text-[10px] text-muted">{new Date(log.timestamp).toLocaleString()}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* Keep-Alive Live Progress Modal */}
      <AnimatePresence>
        {isKeepAliveModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#12161f] border border-cyan-500/30 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-foreground/5 flex items-center justify-between bg-black-deep/40">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center",
                    isKeepAliveRunning ? "bg-cyan-500/10 text-cyan-400" : "bg-green-500/10 text-green-400"
                  )}>
                    {isKeepAliveRunning ? (
                      <Zap className="animate-pulse" size={20} />
                    ) : (
                      <ShieldCheck size={20} />
                    )}
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-foreground flex items-center gap-2">
                      <span>Cluster Keep-Alive: 6-Month Inactivity Refresh</span>
                    </h3>
                    <p className="text-xs text-muted">
                      {isKeepAliveRunning 
                        ? `Sending micro-query "${pingQuery || 'ping'}" to keep keys active forever...`
                        : 'Keep-Alive routine execution completed'}
                    </p>
                  </div>
                </div>

                {!isKeepAliveRunning && (
                  <button
                    onClick={() => setIsKeepAliveModalOpen(false)}
                    className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-black-deep transition-all cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>

              {/* Modal Body */}
              <div className="p-5 space-y-5 overflow-y-auto">
                {/* Progress Bar and Percent */}
                <div>
                  <div className="flex items-baseline justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-black text-foreground">
                        {Math.round(
                          keepAliveProgress && keepAliveProgress.total > 0
                            ? (keepAliveProgress.results.length / keepAliveProgress.total) * 100
                            : 0
                        )}%
                      </span>
                      <span className="text-xs text-muted font-medium">
                        ({keepAliveProgress?.results.length || 0} of {keepAliveProgress?.total || 0} Keys Processed)
                      </span>
                    </div>
                    <span className="text-xs font-mono text-cyan-400 font-semibold">
                      {isKeepAliveRunning ? 'Pinging Cluster...' : keepAliveProgress?.isCancelled ? 'Cancelled' : 'Complete'}
                    </span>
                  </div>

                  <div className="h-2.5 bg-black-deep rounded-full overflow-hidden border border-foreground/10">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-emerald-400 transition-all duration-300"
                      style={{
                        width: `${Math.min(
                          100,
                          keepAliveProgress && keepAliveProgress.total > 0
                            ? (keepAliveProgress.results.length / keepAliveProgress.total) * 100
                            : 0
                        )}%`
                      }}
                    />
                  </div>
                </div>

                {/* Mini Stat Badges */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-black-deep/60 border border-foreground/5 rounded-xl">
                    <span className="text-[10px] text-muted font-bold uppercase tracking-wider block">Verified Active</span>
                    <span className="text-xl font-black text-green-400 flex items-center gap-1.5 mt-0.5">
                      <CheckCircle2 size={16} />
                      {keepAliveProgress?.successCount || 0}
                    </span>
                  </div>

                  <div className="p-3 bg-black-deep/60 border border-foreground/5 rounded-xl">
                    <span className="text-[10px] text-muted font-bold uppercase tracking-wider block">Quota / Alerts</span>
                    <span className="text-xl font-black text-amber-400 flex items-center gap-1.5 mt-0.5">
                      <AlertTriangle size={16} />
                      {keepAliveProgress?.failCount || 0}
                    </span>
                  </div>

                  <div className="p-3 bg-black-deep/60 border border-foreground/5 rounded-xl">
                    <span className="text-[10px] text-muted font-bold uppercase tracking-wider block">Routine State</span>
                    <span className="text-xs font-bold text-cyan-400 mt-1.5 block truncate">
                      {isKeepAliveRunning ? `${concurrency} Workers Active` : 'Finished'}
                    </span>
                  </div>
                </div>

                {/* Currently In-Flight Key Box */}
                {isKeepAliveRunning && keepAliveProgress?.currentKeyMasked && (
                  <div className="p-3 bg-cyan-950/20 border border-cyan-500/20 rounded-xl flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center gap-2 truncate">
                      <RefreshCw size={14} className="text-cyan-400 animate-spin shrink-0" />
                      <span className="text-muted">Querying:</span>
                      <span className="font-bold text-foreground">
                        Key #{keepAliveProgress.currentKeyIndex + 1} ({keepAliveProgress.currentKeyMasked})
                      </span>
                      <span className="text-cyan-400/80">prompt: &quot;{pingQuery || 'ping'}&quot;</span>
                    </div>
                  </div>
                )}

                {/* Live Terminal Log Feed */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-muted uppercase tracking-wider flex items-center gap-1.5">
                      <Terminal size={14} className="text-cyan-400" />
                      Live Response Stream
                    </span>
                    <span className="text-[10px] text-muted font-mono">
                      {keepAliveProgress?.results.length || 0} responses recorded
                    </span>
                  </div>

                  <div className="bg-black-deep/90 border border-foreground/10 rounded-xl p-3 h-48 overflow-y-auto space-y-1.5 font-mono text-xs">
                    {keepAliveProgress?.results.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-muted text-xs">
                        Awaiting first response from cluster...
                      </div>
                    ) : (
                      keepAliveProgress?.results.map((res, i) => (
                        <div key={i} className="flex items-baseline justify-between text-[11px] hover:bg-foreground/5 px-1 py-0.5 rounded transition-colors">
                          <div className="flex items-center gap-2 truncate pr-2">
                            {res.status === 'success' ? (
                              <span className="text-green-400">✔</span>
                            ) : res.status === 'quota_exhausted' ? (
                              <span className="text-amber-400">⚠</span>
                            ) : (
                              <span className="text-red-400">✖</span>
                            )}
                            <span className="text-muted font-semibold">#{res.index + 1}</span>
                            <span className="text-foreground/90">{res.masked}</span>
                            <span className={cn(
                              "truncate",
                              res.status === 'success' ? "text-green-300" : res.status === 'quota_exhausted' ? "text-amber-300" : "text-red-300"
                            )}>
                              {res.status === 'success' ? `"${res.message}"` : res.message}
                            </span>
                          </div>
                          <span className="text-muted text-[10px] shrink-0">{res.latencyMs}ms</span>
                        </div>
                      ))
                    )}
                    <div ref={terminalLogsEndRef} />
                  </div>
                </div>

                {/* Success Summary Alert */}
                {!isKeepAliveRunning && keepAliveProgress?.isFinished && (
                  <div className="p-3.5 bg-green-950/20 border border-green-500/20 rounded-xl flex items-start gap-3">
                    <CheckCircle2 size={18} className="text-green-400 shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <p className="font-bold text-green-300">
                        Keep-Alive Routine Finished: {keepAliveProgress.successCount} of {keepAliveProgress.total} Keys Verified Active!
                      </p>
                      <p className="text-muted mt-0.5">
                        Google Cloud activity timestamp has been refreshed for all responding keys across the cluster. Inactivity timeout reset for the next 6 months.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-foreground/5 bg-black-deep/40 flex items-center justify-between">
                <span className="text-xs text-muted">
                  {isKeepAliveRunning ? 'Routine running across cluster...' : 'Routine complete'}
                </span>

                <div className="flex items-center gap-2">
                  {isKeepAliveRunning ? (
                    <button
                      onClick={handleCancelKeepAlive}
                      className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Square size={14} />
                      <span>Cancel Routine</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => setIsKeepAliveModalOpen(false)}
                      className="px-5 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-extrabold rounded-xl text-xs transition-all cursor-pointer shadow-lg"
                    >
                      <span>Done & Refresh Telemetry</span>
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
