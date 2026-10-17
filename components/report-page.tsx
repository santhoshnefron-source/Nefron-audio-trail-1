'use client';

import * as React from 'react';
import { 
  AlertCircle, CheckCircle2, Loader2, Mail, Trash2, 
  MessageSquare, Calendar, Laptop, RefreshCw, Send, ArrowLeft,
  Copy, Check, X, Search, ChevronDown, ChevronUp, SlidersHorizontal
} from 'lucide-react';
import { collection, doc, setDoc, onSnapshot, query, orderBy, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { createPortal } from 'react-dom';

export interface UserReport {
  id: string;
  email: string;
  issue: string;
  createdAt: string;
  browserInfo?: string;
}

interface ReportPageProps {
  user: any; // Firebase User or null
  onBack?: () => void;
}

export function ReportPage({ user, onBack }: ReportPageProps) {
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [reports, setReports] = React.useState<UserReport[]>([]);
  const [reportsLoading, setReportsLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [success, setSuccess] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedReport, setSelectedReport] = React.useState<UserReport | null>(null);
  const [filterEmail, setFilterEmail] = React.useState<string | null>(null);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [expandedReportId, setExpandedReportId] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Form states
  const [email, setEmail] = React.useState('');
  const [issue, setIssue] = React.useState('');

  // Auto-set email from logged in user
  React.useEffect(() => {
    if (user) {
      setEmail(user.email || '');
      if (user.email === 'p26893150@gmail.com') {
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
      }
    } else {
      setIsAdmin(false);
    }
  }, [user]);

  // Admin: Sync reports in real-time
  React.useEffect(() => {
    if (!isAdmin) {
      setReportsLoading(false);
      return;
    }

    setReportsLoading(true);
    const reportsQuery = query(collection(db, 'reports'), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(reportsQuery, (snapshot) => {
      const fetched: UserReport[] = [];
      snapshot.forEach((docSnap) => {
        fetched.push({
          id: docSnap.id,
          ...docSnap.data()
        } as UserReport);
      });
      setReports(fetched);
      setReportsLoading(false);
    }, (err) => {
      console.error('Error fetching reports:', err);
      setError('Failed to sync reports. Check permissions or network.');
      setReportsLoading(false);
    });

    return () => unsubscribe();
  }, [isAdmin]);

  // Handle user report submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issue.trim()) {
      setError('Please describe your issue or feedback.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Please provide a valid email address.');
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const reportId = doc(collection(db, 'reports')).id;
      const browserInfo = navigator.userAgent;
      const createdAt = new Date().toISOString();

      // 1. Save to Firestore Reports collection
      await setDoc(doc(db, 'reports', reportId), {
        email: email.trim(),
        issue: issue.trim(),
        createdAt,
        browserInfo
      });

      // 2. Automatically prepare and send email to admin via native mailto dispatch
      // (Pre-fills admin's email, subject, and the clear issue text body)
      const subject = encodeURIComponent(`Nefron Audio - New Issue/Feedback from ${email}`);
      const bodyText = `New Issue/Feedback Submitted on Nefron Audio:
--------------------------------------------------
Reporter: ${email}
Submitted At: ${new Date(createdAt).toLocaleString()}
Device Info: ${browserInfo}

Issue / Feedback Details:
${issue}
--------------------------------------------------`;
      const mailtoUrl = `mailto:p26893150@gmail.com?subject=${subject}&body=${encodeURIComponent(bodyText)}`;
      
      // Navigate to the mailto link to open the mail client
      window.location.href = mailtoUrl;

      setSuccess(true);
      setIssue('');
    } catch (err: any) {
      console.error('Submission error:', err);
      const isOwner = user?.email === 'p26893150@gmail.com';
      setError(isOwner ? 'Submission failed: ' + (err.message || 'Firestore write rejected.') : 'We ran into a small issue. Please try submitting again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Admin: Delete a report after custom confirmation
  const handleDeleteReportConfirm = async (id: string) => {
    try {
      setError(null);
      await deleteDoc(doc(db, 'reports', id));
      setDeletingId(null);
      if (selectedReport?.id === id) {
        setSelectedReport(null);
      }
    } catch (err: any) {
      console.error('Error deleting report:', err);
      const isOwner = user?.email === 'p26893150@gmail.com';
      setError(isOwner ? 'Failed to delete report: ' + (err.message || 'Firestore write rejected.') : 'Could not remove at this time. Please try again.');
    }
  };

  // Parse User Agent safely
  const formatUserAgent = (ua?: string) => {
    if (!ua) return 'Unknown Device';
    let os = 'Unknown OS';
    if (ua.includes('Windows')) os = 'Windows OS';
    else if (ua.includes('Macintosh') || ua.includes('Mac OS')) os = 'macOS';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
    else if (ua.includes('Linux')) os = 'Linux';
    
    let browser = 'Unknown Browser';
    if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Chrome')) browser = 'Chrome';
    else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
    else if (ua.includes('Edge')) browser = 'Edge';
    
    return `${browser} on ${os}`;
  };

  // Get total unique email reporters
  const uniqueReportersCount = new Set(reports.map(r => r.email.toLowerCase())).size;

  // Filter reports if filterEmail is selected or searchQuery is entered
  const filteredReports = reports.filter(r => {
    const matchesEmail = filterEmail ? r.email.toLowerCase() === filterEmail.toLowerCase() : true;
    const matchesSearch = searchQuery 
      ? r.email.toLowerCase().includes(searchQuery.toLowerCase()) || r.issue.toLowerCase().includes(searchQuery.toLowerCase())
      : true;
    return matchesEmail && matchesSearch;
  });

  return (
    <div className="w-full h-full bg-black-deep text-foreground relative flex flex-col pt-20 px-4 pb-12 overflow-y-auto custom-scrollbar">
      {/* Decorative Background Elements */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-electric-blue/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-[var(--logo-gradient-start)]/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-4xl w-full mx-auto relative z-10 flex flex-col flex-1">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-foreground/5">
          <div className="flex items-center gap-3">
            {onBack && (
              <button 
                onClick={onBack}
                className="p-2 rounded-full hover:bg-white/5 text-muted hover:text-foreground transition-colors"
                id="report_back_btn"
              >
                <ArrowLeft size={20} />
              </button>
            )}
            <div>
              <h1 className="text-2xl sm:text-3xl font-headline font-bold bg-gradient-to-r from-[var(--logo-gradient-start)] to-electric-blue bg-clip-text text-transparent">
                {isAdmin ? 'System Reports Dashboard' : 'Report Issue or Feedback'}
              </h1>
              <p className="text-xs text-muted mt-1">
                {isAdmin ? 'Manage real-time system feedback and user reported issues' : 'Submit feedback or tell us about issues you face in the app'}
              </p>
            </div>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2 bg-electric-blue/10 border border-electric-blue/20 px-3 py-1.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-electric-blue animate-pulse" />
              <span className="text-[10px] uppercase tracking-wider font-bold text-electric-blue">Admin Access</span>
            </div>
          )}
        </div>

        {isAdmin ? (
          /* ================= ADMIN VIEW ================= */
          <div className="space-y-6">
            {/* KPI Widgets */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gray-dark/50 border border-foreground/10 rounded-2xl p-5 flex items-center justify-between shadow-lg"
              >
                <div>
                  <span className="text-xs text-muted uppercase tracking-wider font-semibold">Total Reports</span>
                  <h3 className="text-3xl font-bold mt-1 text-foreground">{reports.length}</h3>
                </div>
                <div className="w-12 h-12 rounded-xl bg-electric-blue/10 border border-electric-blue/20 flex items-center justify-center">
                  <MessageSquare className="text-electric-blue" size={24} />
                </div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-gray-dark/50 border border-foreground/10 rounded-2xl p-5 flex items-center justify-between shadow-lg"
              >
                <div>
                  <span className="text-xs text-muted uppercase tracking-wider font-semibold">Unique Reporters</span>
                  <h3 className="text-3xl font-bold mt-1 text-foreground">{uniqueReportersCount}</h3>
                </div>
                <div className="w-12 h-12 rounded-xl bg-[var(--logo-gradient-start)]/10 border border-[var(--logo-gradient-start)]/20 flex items-center justify-center">
                  <Mail className="text-[var(--logo-gradient-start)]" size={24} />
                </div>
              </motion.div>
            </div>

            {/* Error view */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-3 text-red-400 text-sm">
                <AlertCircle size={18} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Search and Filters row */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-gray-dark/20 p-4 border border-foreground/5 rounded-2xl">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Search feedback by email or content keywords..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-black-deep/50 border border-foreground/10 focus:border-electric-blue/50 rounded-xl py-2.5 pl-10 pr-4 text-xs text-foreground outline-none transition-all"
                />
                <Search className="absolute left-3.5 top-3.5 text-muted/65" size={14} />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-3 p-0.5 rounded-full hover:bg-white/10 text-muted hover:text-foreground transition-colors"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {(filterEmail || searchQuery) && (
                <button
                  onClick={() => {
                    setFilterEmail(null);
                    setSearchQuery('');
                  }}
                  className="px-4 py-2.5 bg-white/5 border border-foreground/10 hover:bg-white/10 text-muted hover:text-foreground text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shrink-0"
                >
                  <SlidersHorizontal size={13} />
                  <span>Reset Filters</span>
                </button>
              )}
            </div>

            {/* Reports List */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-foreground/5">
                <h2 className="text-lg font-bold text-foreground/90 flex items-center gap-2">
                  <span>Active Feedback Logs</span>
                  <span className="text-xs font-normal text-muted">
                    {filterEmail || searchQuery ? `(${filteredReports.length} of ${reports.length})` : `(${reports.length})`}
                  </span>
                </h2>

                {filterEmail && (
                  <button 
                    onClick={() => setFilterEmail(null)}
                    className="self-start text-xs bg-electric-blue/10 border border-electric-blue/20 text-electric-blue px-3 py-1 rounded-full flex items-center gap-1.5 hover:bg-electric-blue/20 transition-all font-bold"
                  >
                    <span>Filtered: {filterEmail}</span>
                    <X size={12} />
                  </button>
                )}
              </div>

              {reportsLoading ? (
                <div className="py-20 flex flex-col items-center justify-center text-muted gap-3">
                  <Loader2 className="animate-spin text-electric-blue" size={32} />
                  <p className="text-xs">Synchronizing issue queue...</p>
                </div>
              ) : filteredReports.length === 0 ? (
                <div className="py-16 text-center border border-dashed border-foreground/10 rounded-2xl bg-gray-dark/20">
                  <CheckCircle2 className="mx-auto text-muted mb-3" size={40} />
                  <p className="text-sm font-bold text-muted">No matching issues</p>
                  <p className="text-xs text-muted/65 mt-1">Try clearing the email filter or changing the search query.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredReports.map((report, idx) => (
                    <motion.div
                      key={report.id}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      onClick={() => setSelectedReport(report)}
                      className="bg-gray-dark/40 border border-foreground/10 hover:border-electric-blue/30 rounded-2xl p-5 hover:bg-gray-dark/50 transition-all shadow-md group relative overflow-hidden cursor-pointer active:scale-[0.99] duration-200"
                    >
                      {/* Left accent border */}
                      <div className="absolute top-0 bottom-0 left-0 w-1 bg-electric-blue/40" />

                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <div className="space-y-2 flex-1">
                          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                            <span 
                              className="text-sm font-bold text-foreground hover:underline hover:text-electric-blue cursor-pointer transition-colors relative z-10" 
                              onClick={(e) => {
                                e.stopPropagation(); // Avoid triggering full modal view on filter click
                                setFilterEmail(report.email);
                              }}
                              title="Filter logs by this email"
                            >
                              {report.email}
                            </span>
                            <span className="text-[10px] text-muted-foreground bg-white/5 border border-foreground/5 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Calendar size={10} />
                              {new Date(report.createdAt).toLocaleString()}
                            </span>
                          </div>

                          <p className="text-sm text-foreground/90 leading-relaxed font-sans line-clamp-3 group-hover:text-foreground transition-colors">
                            {report.issue}
                          </p>
                          {report.issue.length > 200 && (
                            <span className="text-xs text-electric-blue font-semibold hover:underline mt-1 inline-block">
                              Read more
                            </span>
                          )}

                          {report.browserInfo && (
                            <div className="pt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono">
                              <Laptop size={11} />
                              <span>{formatUserAgent(report.browserInfo)}</span>
                            </div>
                          )}
                        </div>

                        <div 
                          className="flex items-center gap-2 shrink-0 md:self-start self-end pt-2 md:pt-0 relative z-10"
                          onClick={(e) => e.stopPropagation()} // Stop bubbling to prevent opening detail modal
                        >
                          <a
                            href={`mailto:${report.email}?subject=Re: Nefron Audio Issue Report&body=Hi,\n\nThanks for reaching out! We received your feedback:\n"${report.issue}"\n\n`}
                            className="p-2 rounded-lg bg-electric-blue/10 hover:bg-electric-blue/20 text-electric-blue text-xs font-bold transition-all flex items-center gap-1.5"
                            title="Reply via Email"
                          >
                            <Mail size={14} />
                            <span>Reply</span>
                          </a>
                          {deletingId === report.id ? (
                            <div className="flex items-center gap-1 bg-red-500/10 border border-red-500/25 rounded-lg p-0.5">
                              <button
                                onClick={() => handleDeleteReportConfirm(report.id)}
                                className="px-2 py-1 rounded bg-red-500 hover:bg-red-600 text-white text-[11px] font-bold flex items-center gap-1 transition-all animate-pulse"
                                title="Confirm Deletion"
                              >
                                <CheckCircle2 size={12} />
                                <span>Delete?</span>
                              </button>
                              <button
                                onClick={() => setDeletingId(null)}
                                className="p-1 rounded hover:bg-white/10 text-muted hover:text-foreground transition-all"
                                title="Cancel"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeletingId(report.id)}
                              className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 transition-all"
                              title="Resolve and Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ================= USER FORM VIEW ================= */
          <div className="max-w-2xl w-full mx-auto">
            <AnimatePresence mode="wait">
              {success ? (
                <motion.div
                  key="success-card"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-gray-dark/40 border border-electric-green/30 rounded-3xl p-8 text-center shadow-[0_0_50px_rgba(34,197,94,0.05)]"
                >
                  <div className="w-16 h-16 bg-green-500/10 border border-green-500/30 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle2 className="text-green-500" size={32} />
                  </div>
                  <h3 className="text-2xl font-bold text-foreground mb-2">Thanks for your feedback</h3>
                  <p className="text-sm text-muted mb-6 max-w-md mx-auto leading-relaxed">
                    We appreciate you taking the time to share this with us. Your report has been saved securely, and we will automatically attempt to forward it.
                  </p>
                  
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <button
                      onClick={() => setSuccess(false)}
                      className="px-6 py-2.5 rounded-full border border-foreground/10 hover:bg-white/5 text-xs font-bold transition-all"
                    >
                      Submit Another Report
                    </button>
                    {onBack && (
                      <button
                        onClick={onBack}
                        className="px-6 py-2.5 rounded-full bg-electric-blue hover:bg-electric-blue-dark text-white text-xs font-bold transition-all"
                      >
                        Return to Dashboard
                      </button>
                    )}
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="form-card"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-gray-dark/30 border border-foreground/10 rounded-3xl p-6 sm:p-8 shadow-xl"
                >
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Error Box */}
                    {error && (
                      <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-3 text-red-400 text-sm">
                        <AlertCircle size={18} className="shrink-0" />
                        <span>{error}</span>
                      </div>
                    )}

                    {/* Email Input */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                        <span>Your Contact Email</span>
                        {user && <span className="text-[10px] text-electric-blue font-normal lowercase">Authenticated</span>}
                      </label>
                      <div className="relative">
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="your.email@example.com"
                          className={cn(
                            "w-full bg-black-deep/50 border border-foreground/10 focus:border-electric-blue/50 rounded-xl py-3 pl-11 pr-4 text-sm text-foreground outline-none transition-all",
                            user ? "text-muted-foreground bg-black-deep/20" : ""
                          )}
                          disabled={!!user}
                        />
                        <Mail className="absolute left-4 top-3.5 text-muted-foreground/60" size={16} />
                      </div>
                    </div>

                    {/* Issue Description Area */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Describe the issue or feedback
                      </label>
                      <textarea
                        required
                        value={issue}
                        onChange={(e) => setIssue(e.target.value)}
                        placeholder="Please detail what issue you faced or share your ideas..."
                        rows={6}
                        maxLength={5000}
                        className="w-full bg-black-deep/50 border border-foreground/10 focus:border-electric-blue/50 rounded-xl p-4 text-sm text-foreground outline-none transition-all resize-none custom-scrollbar"
                      />
                      <div className="flex justify-between text-[10px] text-muted-foreground/60 px-1">
                        <span>Min. 10 characters</span>
                        <span>{issue.length}/5000</span>
                      </div>
                    </div>

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full py-3.5 bg-electric-blue hover:bg-electric-blue/90 disabled:bg-electric-blue/55 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-electric-blue/10 flex items-center justify-center gap-2"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="animate-spin" size={16} />
                          <span>Filing report...</span>
                        </>
                      ) : (
                        <>
                          <Send size={16} />
                          <span>Submit & Email to Admin</span>
                        </>
                      )}
                    </button>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Detail Modal via React Portal to prevent any parent container clipping / transform issues */}
      {mounted && typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {selectedReport && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
              onClick={() => setSelectedReport(null)}
            >
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-gray-dark border border-foreground/10 rounded-3xl max-w-2xl w-full p-6 sm:p-8 relative shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Decorative background glow */}
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-electric-blue/10 rounded-full blur-[50px] pointer-events-none" />

                {/* Close Button */}
                <button 
                  onClick={() => setSelectedReport(null)}
                  className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 text-muted hover:text-foreground transition-colors"
                  id="close_report_modal"
                >
                  <X size={18} />
                </button>

                {/* Header info */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-electric-blue/10 border border-electric-blue/20 rounded-xl flex items-center justify-center">
                      <Mail className="text-electric-blue" size={20} />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted">Issue Sender</h4>
                      <p className="text-base sm:text-lg font-bold text-foreground select-all">{selectedReport.email}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground border-b border-foreground/5 pb-4">
                    <span className="flex items-center gap-1">
                      <Calendar size={13} />
                      {new Date(selectedReport.createdAt).toLocaleString()}
                    </span>
                    {selectedReport.browserInfo && (
                      <span className="flex items-center gap-1 font-mono">
                        <Laptop size={13} />
                        {formatUserAgent(selectedReport.browserInfo)}
                      </span>
                    )}
                  </div>

                  {/* The Report Body - HIGH CONTRAST, HUGE READABILITY */}
                  <div className="space-y-2 pt-2">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Report Content</h5>
                    <div className="bg-black-deep/60 border border-foreground/5 rounded-2xl p-5 max-h-[300px] overflow-y-auto custom-scrollbar">
                      <p className="text-sm sm:text-base text-foreground font-sans leading-relaxed whitespace-pre-wrap select-text">
                        {selectedReport.issue}
                      </p>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-6 flex flex-wrap items-center justify-between gap-4 border-t border-foreground/5">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(selectedReport.issue);
                            setCopiedId('issue');
                            setTimeout(() => setCopiedId(null), 2000);
                          } catch (err) {
                            console.error('Failed to copy text', err);
                          }
                        }}
                        className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold transition-colors flex items-center gap-2 text-muted hover:text-foreground"
                      >
                        {copiedId === 'issue' ? (
                          <>
                            <Check size={14} className="text-green-500" />
                            <span>Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy size={14} />
                            <span>Copy Text</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(selectedReport.email);
                            setCopiedId('email');
                            setTimeout(() => setCopiedId(null), 2000);
                          } catch (err) {
                            console.error('Failed to copy email', err);
                          }
                        }}
                        className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold transition-colors flex items-center gap-2 text-muted hover:text-foreground"
                      >
                        {copiedId === 'email' ? (
                          <>
                            <Check size={14} className="text-green-500" />
                            <span>Copied Email!</span>
                          </>
                        ) : (
                          <>
                            <Copy size={14} />
                            <span>Copy Email</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href={`mailto:${selectedReport.email}?subject=Re: Nefron Audio Issue Report&body=Hi,\n\nThanks for reaching out! We received your feedback:\n"${selectedReport.issue}"\n\n`}
                        className="px-4 py-2 rounded-xl bg-electric-blue hover:bg-electric-blue/90 text-white text-xs font-bold transition-colors flex items-center gap-2"
                      >
                        <Mail size={14} />
                        <span>Reply</span>
                      </a>
                      
                      {deletingId === selectedReport.id ? (
                        <div className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/25 rounded-xl p-1 shrink-0">
                          <button
                            onClick={() => handleDeleteReportConfirm(selectedReport.id)}
                            className="px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-all animate-pulse"
                            title="Confirm Deletion"
                          >
                            Delete?
                          </button>
                          <button
                            onClick={() => setDeletingId(null)}
                            className="p-1.5 rounded-lg hover:bg-white/10 text-muted hover:text-foreground transition-all"
                            title="Cancel"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeletingId(selectedReport.id)}
                          className="p-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 transition-colors"
                          title="Delete Report"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
