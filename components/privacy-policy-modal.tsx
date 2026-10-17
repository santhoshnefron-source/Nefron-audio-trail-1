'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Shield, FileText, Info, AlertOctagon, HelpCircle, User, Phone, Mail, Building, Globe, MapPin, Calendar, CheckCircle, Scale } from 'lucide-react';

interface PrivacyPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'investor' | 'general';

export function PrivacyPolicyModal({ isOpen, onClose }: PrivacyPolicyModalProps) {
  const [activeTab, setActiveTab] = React.useState<TabType>('investor');

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto"
    >
      <motion.div
        initial={{ scale: 0.95, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 30 }}
        className="relative max-w-3xl w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="flex flex-col p-6 border-b border-slate-100 dark:border-slate-900 bg-slate-50/50 dark:bg-slate-950/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-electric-blue/10 text-electric-blue">
                <Shield size={24} />
              </div>
              <div>
                <h3 className="text-xl font-headline tracking-wider font-bold text-slate-900 dark:text-white">Legal Documentation</h3>
                <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400 uppercase mt-0.5 tracking-widest">Nefron Audio Proprietary Platform</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-all cursor-pointer focus:outline-none"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>

          {/* Navigation Tabs - Ensuring intuitive, beautiful tab layout */}
          <div className="flex items-center gap-2 mt-5 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl w-full sm:w-fit">
            <button
              onClick={() => setActiveTab('investor')}
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all duration-300 cursor-pointer flex-1 sm:flex-none ${
                activeTab === 'investor'
                  ? 'bg-white dark:bg-slate-800 text-electric-blue shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <FileText size={14} />
              Investor Demo Policy
            </button>
            <button
              onClick={() => setActiveTab('general')}
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all duration-300 cursor-pointer flex-1 sm:flex-none ${
                activeTab === 'general'
                  ? 'bg-white dark:bg-slate-800 text-electric-blue shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <Shield size={14} />
              General App & hardware Policy
            </button>
          </div>
        </div>

        {/* Scrollable Content Container - Styled to be 100% SELECTABLE and HIGH-CONTRAST */}
        <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar flex-1 space-y-6 text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-sans select-text">
          
          <AnimatePresence mode="wait">
            {activeTab === 'investor' ? (
              <motion.div
                key="investor-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {/* Document Header */}
                <div className="text-center pb-5 border-b border-slate-100 dark:border-slate-900">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-electric-blue bg-electric-blue/10 px-3 py-1 rounded-full">
                    Official Release
                  </span>
                  <h4 className="text-xl font-bold text-slate-900 dark:text-white mt-3 mb-1 uppercase tracking-tight">
                    NEFRON AUDIO PRIVACY POLICY
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mb-4">
                    Nefron Audio Investor Demo Application
                  </p>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-2xl mx-auto mt-4 text-left text-[11px] font-mono border border-slate-100 dark:border-slate-900 p-3 rounded-2xl bg-slate-50/50 dark:bg-slate-950/30">
                    <div>
                      <span className="text-slate-400 dark:text-slate-500 block uppercase text-[9px] font-bold">Application</span>
                      <span className="text-slate-800 dark:text-slate-200 font-semibold">Investor Demo</span>
                    </div>
                    <div>
                      <span className="text-slate-400 dark:text-slate-500 block uppercase text-[9px] font-bold">Effective Date</span>
                      <span className="text-slate-800 dark:text-slate-200 font-semibold">June 2026</span>
                    </div>
                    <div>
                      <span className="text-slate-400 dark:text-slate-500 block uppercase text-[9px] font-bold">Data Controller</span>
                      <span className="text-slate-800 dark:text-slate-200 font-semibold">Santhosh, Founder</span>
                    </div>
                    <div>
                      <span className="text-slate-400 dark:text-slate-500 block uppercase text-[9px] font-bold">Version</span>
                      <span className="text-slate-800 dark:text-slate-200 font-semibold">1.0</span>
                    </div>
                  </div>
                </div>

                {/* Important Notice Alert Callout */}
                <div className="border-l-4 border-amber-500 bg-amber-50/70 dark:bg-amber-950/20 p-4 rounded-r-2xl space-y-2">
                  <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                    <AlertOctagon size={18} />
                    <strong className="text-xs uppercase tracking-wider font-mono font-bold">IMPORTANT NOTICE & PRIOR ART DECLARATION</strong>
                  </div>
                  <p className="text-xs text-amber-900/90 dark:text-amber-200/90 leading-relaxed">
                    This Privacy Policy governs the collection, use, storage, and protection of information in connection with the Nefron Audio Investor Demo Application. This application and the technology concepts it demonstrates are the proprietary intellectual property of Nefron Audio and its founder Santhosh.
                  </p>
                  <p className="text-xs text-amber-900/90 dark:text-amber-200/90 leading-relaxed font-semibold">
                    The technology demonstrated in this application — including but not limited to the electro-mechanical spatial audio architecture, zone-based acoustic routing system, AI driver assignment methodology, and three-tier product framework (Nefron Standard, Nefron Premium, and Nefron Luxury) — constitutes confidential proprietary trade secrets protected under applicable intellectual property and trade secret laws.
                  </p>
                  <p className="text-xs text-amber-800 dark:text-amber-300 font-bold border-t border-amber-500/10 pt-2 font-mono">
                    Patent applications for the core technology are being prepared and are not yet filed. This notice serves as a public record of prior art and invention claim dated June 2026.
                  </p>
                </div>

                {/* 1. Introduction */}
                <section className="space-y-3">
                  <h5 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                    <span className="text-electric-blue font-mono">1.</span> Introduction
                  </h5>
                  <p>
                    Nefron Audio (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;) is an early-stage deep technology startup developing the world&apos;s first electro-mechanical spatial audio platform for cinema. This Privacy Policy describes how we handle information collected through the Nefron Audio Investor Demo Application (the &quot;Application&quot;) and any related interactions with investors, partners, and users.
                  </p>
                  <p>
                    By accessing or using this Application, you confirm that you have read, understood, and agree to be bound by this Privacy Policy. If you do not agree, you must discontinue use of the Application immediately.
                  </p>
                  <p className="text-xs font-semibold italic text-slate-500 dark:text-slate-400">
                    This Application is designed exclusively for investor demonstration and evaluation purposes. It is not a consumer product and is not intended for use by the general public.
                  </p>
                </section>

                <hr className="border-slate-100 dark:border-slate-900" />

                {/* 2. Information We Collect */}
                <section className="space-y-4">
                  <h5 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                    <span className="text-electric-blue font-mono">2.</span> Information We Collect
                  </h5>
                  
                  <div className="space-y-3 pl-3 border-l-2 border-slate-100 dark:border-slate-900">
                    <h6 className="font-semibold text-slate-900 dark:text-white text-sm">2.1 Information You Provide</h6>
                    <p>When you interact with the Application, you may provide the following information:</p>
                    <ul className="list-disc list-inside pl-2 space-y-1">
                      <li>Name and contact details when communicating with us regarding the Application</li>
                      <li>Organisation name and professional role if you identify yourself as an investor, partner, or advisor</li>
                      <li>Audio files or URLs you choose to submit for demonstration purposes within the Application</li>
                      <li>Feedback, queries, or suggestions submitted through the Application or via direct communication</li>
                    </ul>

                    <h6 className="font-semibold text-slate-900 dark:text-white text-sm mt-3">2.2 Information Collected Automatically</h6>
                    <p>The Application may automatically collect certain technical information including:</p>
                    <ul className="list-disc list-inside pl-2 space-y-1">
                      <li>Device type, operating system, and browser information</li>
                      <li>Interaction logs indicating which features were accessed during a demonstration session</li>
                      <li>Session duration and general usage patterns</li>
                      <li>Error logs and performance data for debugging purposes</li>
                    </ul>

                    <h6 className="font-semibold text-slate-900 dark:text-white text-sm mt-3">2.3 Audio and Media Content</h6>
                    <p>If you choose to submit audio content (such as a YouTube link, Spotify URL, or uploaded audio file) through the Live Demo feature of the Application, please note the following:</p>
                    <ul className="list-disc list-inside pl-2 space-y-1">
                      <li>Audio content is processed temporarily and solely for the purpose of generating the real-time speaker visualisation demonstration</li>
                      <li>We do not permanently store, copy, or archive any audio content you submit</li>
                      <li>We do not claim any ownership or rights over audio content submitted by users</li>
                      <li>Submitted audio is processed in memory and discarded at the end of the session</li>
                    </ul>
                    
                    <div className="bg-amber-500/10 dark:bg-amber-500/5 border border-amber-500/20 text-amber-800 dark:text-amber-400 p-3 rounded-xl text-xs flex gap-2 items-start">
                      <AlertOctagon size={16} className="shrink-0 mt-0.5" />
                      <p>
                        <strong>Warning:</strong> Do not submit audio content that you do not have the right to use. Submitted content must comply with the terms of service of the originating platform (YouTube, Spotify, or other sources).
                      </p>
                    </div>
                  </div>
                </section>

                <hr className="border-slate-100 dark:border-slate-900" />

                {/* 3. How We Use Your Information */}
                <section className="space-y-3">
                  <h5 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                    <span className="text-electric-blue font-mono">3.</span> How We Use Your Information
                  </h5>
                  <p>We use the information we collect for the following purposes:</p>
                  <ol className="list-decimal list-inside pl-2 space-y-1.5">
                    <li>To operate and display the investor demonstration features of the Application</li>
                    <li>To process audio input temporarily for the real-time spatial audio visualisation feature</li>
                    <li>To respond to investor enquiries, schedule meetings, and provide follow-up information</li>
                    <li>To improve the accuracy, reliability, and performance of the Application</li>
                    <li>To comply with applicable laws and regulations</li>
                    <li>To protect our proprietary technology, trade secrets, and intellectual property</li>
                    <li>To maintain the security and integrity of the Application</li>
                  </ol>
                  
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/30 rounded-2xl text-emerald-800 dark:text-emerald-300 text-xs">
                    <strong>Our Ironclad Promise:</strong> We do not use your information for advertising purposes. We do not sell your information to any third party. We do not use your information to train external AI models operated by third parties without your explicit consent.
                  </div>
                </section>

                <hr className="border-slate-100 dark:border-slate-900" />

                {/* 4. Proprietary Technology and Intellectual Property */}
                <section className="space-y-4">
                  <h5 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                    <span className="text-electric-blue font-mono">4.</span> Proprietary Technology & Intellectual Property
                  </h5>
                  
                  <div className="bg-slate-50 dark:bg-slate-950 p-5 rounded-2xl border border-slate-100 dark:border-slate-900 space-y-4">
                    <div className="flex items-center gap-2 text-electric-blue border-b border-slate-100 dark:border-slate-900 pb-2">
                      <Scale size={18} />
                      <strong className="text-xs uppercase tracking-wider font-mono">Intellectual Property Declaration</strong>
                    </div>

                    <div className="space-y-3 text-xs md:text-sm">
                      <h6 className="font-bold text-slate-900 dark:text-white">4.1 Technology Ownership</h6>
                      <p>All technology concepts, architectural designs, engineering specifications, formulas, and methodologies demonstrated or described within the Application are the exclusive proprietary intellectual property of Nefron Audio and its founder Santhosh.</p>
                      <p>The following constitute protected trade secrets and proprietary confidential information of Nefron Audio:</p>
                      
                      <ul className="list-disc list-inside pl-2 space-y-1.5 text-slate-600 dark:text-slate-400 text-xs leading-relaxed">
                        <li>The electro-mechanical rotating driver module design concept including the 3×3 coaxial driver grid arrangement</li>
                        <li>The dual-axis motorised gimbal system for individual acoustic driver rotation and beam steering</li>
                        <li>The staggered diamond array deployment formula: <code className="bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded font-mono text-electric-blue">N = floor((L + G) / (W_m + G))</code> and the <code className="bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded font-mono text-electric-blue">3N − 1</code> module count derivation</li>
                        <li>The zone-based acoustic allocation architecture including the ceiling module zone calculation methodology</li>
                        <li>The direction error formula <code className="bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded font-mono text-electric-blue">θ = arctan(d / h)</code> applied to acoustic zone boundary optimisation</li>
                        <li>The three-tier product framework (Nefron Standard, Nefron Premium, Nefron Luxury) defined by ceiling module density variation with fixed wall module architecture</li>
                        <li>The predictive offline pre-computation methodology for AI-driven motor position timelines</li>
                        <li>The dynamic phase coherence compensation engine concept for continuously rotating multi-driver arrays</li>
                        <li>The instrument-to-driver assignment routing logic and spatial music reproduction methodology</li>
                        <li>All associated engineering calculations, cost structures, weight analyses, and power consumption models</li>
                      </ul>

                      <h6 className="font-bold text-slate-900 dark:text-white mt-4">4.2 Patent Status Notice</h6>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">
                        ⚠ The core technology of Nefron Audio is not yet protected by a granted patent. Patent applications are currently being prepared and have not yet been filed as of the date of this Policy.
                      </p>
                      <p>Notwithstanding the absence of a granted patent, the following protections apply:</p>
                      <ul className="list-disc list-inside pl-2 space-y-1 text-slate-600 dark:text-slate-400 text-xs">
                        <li>All concepts, designs, and methodologies described herein are protected as trade secrets under applicable trade secret law, including the Indian Trade Secrets framework and equivalent international provisions</li>
                        <li>Copyright protection applies to all software code, documentation, diagrams, formulas, and written descriptions produced by Nefron Audio</li>
                        <li>This Privacy Policy and all associated documentation constitute a timestamped public declaration of prior art and invention claim effective June 2026</li>
                        <li>Unauthorised reproduction, reverse engineering, copying, disclosure, or commercial use of any Nefron Audio proprietary concept is strictly prohibited and may constitute misappropriation of trade secrets</li>
                      </ul>

                      <h6 className="font-bold text-slate-900 dark:text-white mt-4">4.3 Confidentiality Obligation</h6>
                      <p>By accessing this Application, you acknowledge that:</p>
                      <ul className="list-disc list-inside pl-2 space-y-1 text-slate-600 dark:text-slate-400 text-xs">
                        <li>The technology demonstrations and engineering specifications you encounter constitute confidential proprietary information</li>
                        <li>You will not disclose, reproduce, or communicate any proprietary technical details to any third party without prior written consent from Nefron Audio</li>
                        <li>Any investor materials shared with you are provided under an implied duty of confidentiality for due diligence purposes only</li>
                        <li>Breach of this confidentiality obligation may result in legal action for misappropriation of trade secrets, breach of confidence, and associated damages</li>
                      </ul>
                    </div>
                  </div>
                </section>

                <hr className="border-slate-100 dark:border-slate-900" />

                {/* 5. AI Features and Data Processing */}
                <section className="space-y-3">
                  <h5 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                    <span className="text-electric-blue font-mono">5.</span> AI Features and Data Processing
                  </h5>
                  <p>
                    The Application uses artificial intelligence features powered by the Anthropic Claude API to analyse audio content and generate spatial audio routing simulations. The following applies to this AI processing:
                  </p>
                  <ul className="list-disc list-inside pl-2 space-y-1.5">
                    <li>Audio analysis requests are sent to the Anthropic API for processing. This transmission is governed by Anthropic&apos;s privacy and data handling policies in addition to this Policy</li>
                    <li>We do not instruct Anthropic to retain, store, or use submitted content for model training purposes</li>
                    <li>AI-generated spatial routing simulations are computationally derived outputs and do not constitute engineering-validated measurements</li>
                    <li>All AI outputs within this Application are clearly labelled as preliminary estimates subject to prototype validation</li>
                  </ul>
                  <p className="text-xs italic text-slate-500 dark:text-slate-400">
                    The Application&apos;s AI features are designed to demonstrate the concept of instrument-to-speaker mapping and spatial audio routing. They do not represent final production behaviour of the Nefron Audio system.
                  </p>
                </section>

                <hr className="border-slate-100 dark:border-slate-900" />

                {/* 6. Data Sharing and Third Parties */}
                <section className="space-y-3">
                  <h5 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                    <span className="text-electric-blue font-mono">6.</span> Data Sharing & Third Parties
                  </h5>
                  <p>We do not sell, rent, or trade your personal information to any third party. We may share information only in the following limited circumstances:</p>
                  
                  <h6 className="font-semibold text-slate-900 dark:text-white text-xs uppercase tracking-wider font-mono mt-3">6.1 Service Providers Table</h6>
                  <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-900 mt-2 shadow-sm">
                    <table className="w-full border-collapse text-xs text-left">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-100 dark:border-slate-900 text-slate-800 dark:text-slate-200">
                          <th className="p-3 font-semibold font-mono">Service Provider</th>
                          <th className="p-3 font-semibold font-mono">Purpose</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-900 text-slate-700 dark:text-slate-300">
                        <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10">
                          <td className="p-3 font-semibold">Anthropic (Claude API)</td>
                          <td className="p-3">AI audio analysis and instrument routing simulation</td>
                        </tr>
                        <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10">
                          <td className="p-3 font-semibold">Google (AI Studio)</td>
                          <td className="p-3">Development environment for the 3D theatre simulation</td>
                        </tr>
                        <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10">
                          <td className="p-3 font-semibold">Browser Web Audio API</td>
                          <td className="p-3">Real-time audio frequency analysis for uploaded files</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <h6 className="font-semibold text-slate-900 dark:text-white text-sm mt-4">6.2 Legal Requirements</h6>
                  <p>We may disclose information if required to do so by law, court order, or governmental authority, or if we believe in good faith that disclosure is necessary to protect our legal rights, prevent fraud, or protect the safety of any person.</p>

                  <h6 className="font-semibold text-slate-900 dark:text-white text-sm mt-3">6.3 Business Transfer</h6>
                  <p>In the event that Nefron Audio is acquired, merged, or undergoes a change of control, your information may be transferred to the successor entity. We will notify you of such transfer and the successor entity will be bound by this Privacy Policy.</p>
                </section>

                <hr className="border-slate-100 dark:border-slate-900" />

                {/* 7. Data Security */}
                <section className="space-y-3">
                  <h5 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                    <span className="text-electric-blue font-mono">7.</span> Data Security
                  </h5>
                  <p>We take the security of your information and our proprietary technology seriously. We implement the following measures:</p>
                  <ul className="list-disc list-inside pl-2 space-y-1">
                    <li>All API communications are conducted over encrypted HTTPS connections</li>
                    <li>Audio content submitted for demonstration is processed in memory only and is not written to persistent storage</li>
                    <li>Access to investor demonstration materials is controlled and limited to authorised individuals</li>
                    <li>We do not store investor personal information in unsecured formats</li>
                  </ul>
                  <p className="text-xs italic text-slate-500 dark:text-slate-400">
                    *However, no method of transmission over the internet or electronic storage is completely secure. While we apply commercially reasonable security measures, we cannot guarantee absolute security. You submit information at your own risk.*
                  </p>
                </section>

                <hr className="border-slate-100 dark:border-slate-900" />

                {/* 8. Your Rights */}
                <section className="space-y-3">
                  <h5 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                    <span className="text-electric-blue font-mono">8.</span> Your Rights
                  </h5>
                  <p>Subject to applicable law, you have the following rights regarding your personal information:</p>
                  <ul className="list-disc list-inside pl-2 space-y-1.5">
                    <li><strong>Right of Access</strong> — You may request confirmation of whether we hold personal information about you and a copy of that information</li>
                    <li><strong>Right to Correction</strong> — You may request correction of inaccurate or incomplete personal information we hold about you</li>
                    <li><strong>Right to Deletion</strong> — You may request deletion of your personal information, subject to our legal obligations and legitimate interests</li>
                    <li><strong>Right to Restrict Processing</strong> — You may request that we limit how we use your personal information in certain circumstances</li>
                    <li><strong>Right to Object</strong> — You may object to our processing of your personal information for certain purposes</li>
                  </ul>
                  <p>To exercise any of these rights, please contact us at <a href="mailto:nefronaudio@gmail.com" className="text-electric-blue hover:underline font-semibold font-mono">nefronaudio@gmail.com</a>. We will respond to your request within 30 days.</p>
                </section>

                <hr className="border-slate-100 dark:border-slate-900" />

                {/* 9. Cookies and Local Storage */}
                <section className="space-y-3">
                  <h5 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                    <span className="text-electric-blue font-mono">9.</span> Cookies and Local Storage
                  </h5>
                  <p>This Application may use browser local storage or session storage to temporarily retain session state information (such as the current demonstration stage or audio processing status). This data:</p>
                  <ul className="list-disc list-inside pl-2 space-y-1">
                    <li>Is stored locally on your device only</li>
                    <li>Is not transmitted to our servers</li>
                    <li>Is cleared when you close your browser session</li>
                    <li>Does not contain personally identifying information</li>
                  </ul>
                  <p>We do not use advertising cookies, tracking pixels, or cross-site tracking technologies in this Application.</p>
                </section>

                <hr className="border-slate-100 dark:border-slate-900" />

                {/* 10. Children's Privacy */}
                <section className="space-y-3">
                  <h5 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                    <span className="text-electric-blue font-mono">10.</span> Children&apos;s Privacy
                  </h5>
                  <p>This Application is intended exclusively for business and investor use by adults. We do not knowingly collect personal information from individuals under the age of 18. If you believe a minor has provided personal information through this Application, please contact us immediately and we will take prompt steps to delete such information.</p>
                </section>

                <hr className="border-slate-100 dark:border-slate-900" />

                {/* 11. International Data Transfers */}
                <section className="space-y-3">
                  <h5 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                    <span className="text-electric-blue font-mono">11.</span> International Data Transfers
                  </h5>
                  <p>Nefron Audio operates from India. If you access this Application from outside India, your information may be transmitted to and processed in India. By using this Application, you consent to the transfer of your information to India and acknowledge that the laws governing data protection in India may differ from those in your home jurisdiction.</p>
                  <p>When using the Anthropic Claude API, audio and text data may be processed on servers located outside India. Anthropic&apos;s data handling practices are governed by Anthropic&apos;s own privacy policy.</p>
                </section>

                <hr className="border-slate-100 dark:border-slate-900" />

                {/* 12. Prohibited Use — Competitors and Bad-Faith Access */}
                <section className="space-y-3">
                  <div className="border border-red-500/30 bg-red-50 dark:bg-red-950/15 p-4 rounded-2xl space-y-2">
                    <h5 className="font-bold text-red-700 dark:text-red-400 text-sm flex items-center gap-2 uppercase tracking-wide font-mono">
                      <AlertOctagon size={16} />
                      12. Prohibited Use — Competitors and Bad-Faith Access
                    </h5>
                    <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-bold">
                      Access to this Application by employees, agents, contractors, or representatives of any company developing competing spatial audio technology — including but not limited to Dolby Laboratories, DTS Inc., Barco, QSC Audio, Meyer Sound, or any direct or indirect competitor — is strictly prohibited without prior written authorisation from Nefron Audio.
                    </p>
                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                      Any information accessed through this Application by a competitor or bad-faith actor constitutes misappropriation of trade secrets and will be pursued through all available legal remedies. We reserve the right to seek injunctive relief, compensatory damages, and punitive damages in such cases.
                    </p>
                  </div>
                </section>

                <hr className="border-slate-100 dark:border-slate-900" />

                {/* 13. Disclaimers and Limitations */}
                <section className="space-y-3">
                  <h5 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                    <span className="text-electric-blue font-mono">13.</span> Disclaimers and Limitations
                  </h5>
                  <p>All engineering specifications, cost estimates, power calculations, acoustic performance projections, and financial models demonstrated or described within this Application are:</p>
                  <ul className="list-disc list-inside pl-2 space-y-1">
                    <li>Preliminary engineering estimates only</li>
                    <li>Subject to revision following prototype validation</li>
                    <li>Not guaranteed to represent final production performance</li>
                    <li>Clearly labelled as pre-prototype conceptual figures</li>
                  </ul>
                  <p className="text-xs italic text-slate-500 dark:text-slate-400">
                    *Nefron Audio makes no warranty, express or implied, regarding the completeness, accuracy, or fitness for any particular purpose of any information presented in this Application. Investment decisions should not be made based solely on this Application without independent due diligence.*
                  </p>
                </section>

                <hr className="border-slate-100 dark:border-slate-900" />

                {/* 14. Changes to This Privacy Policy */}
                <section className="space-y-3">
                  <h5 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                    <span className="text-electric-blue font-mono">14.</span> Changes to This Privacy Policy
                  </h5>
                  <p>We may update this Privacy Policy from time to time to reflect changes in our practices, technology, or applicable law. When we make material changes, we will update the effective date at the top of this document and, where reasonably practicable, notify you directly.</p>
                  <p>Your continued use of the Application following any update constitutes your acceptance of the revised Privacy Policy.</p>
                </section>

                <hr className="border-slate-100 dark:border-slate-900" />

                {/* 15. Governing Law and Jurisdiction */}
                <section className="space-y-3">
                  <h5 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                    <span className="text-electric-blue font-mono">15.</span> Governing Law and Jurisdiction
                  </h5>
                  <p>This Privacy Policy is governed by and construed in accordance with the laws of India, including the Information Technology Act 2000 and the Digital Personal Data Protection Act 2023. Any disputes arising under or in connection with this Privacy Policy shall be subject to the exclusive jurisdiction of the courts of Chennai, Tamil Nadu, India.</p>
                </section>

                <hr className="border-slate-100 dark:border-slate-900" />

                {/* 16. Contact Information */}
                <section className="space-y-3">
                  <h5 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                    <span className="text-electric-blue font-mono">16.</span> Contact Information
                  </h5>
                  <p>For any questions, concerns, requests, or notices relating to this Privacy Policy or the handling of your personal information, please contact:</p>
                  
                  <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-900 shadow-sm mt-2">
                    <table className="w-full border-collapse text-xs text-left">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-100 dark:border-slate-900 text-slate-800 dark:text-slate-200">
                          <th className="p-3 font-semibold font-mono">Field</th>
                          <th className="p-3 font-semibold font-mono">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-900 text-slate-700 dark:text-slate-300">
                        <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10">
                          <td className="p-3 font-semibold">Name</td>
                          <td className="p-3">Santhosh — Founder and Data Controller</td>
                        </tr>
                        <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10">
                          <td className="p-3 font-semibold">Company</td>
                          <td className="p-3">Nefron Audio</td>
                        </tr>
                        <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10">
                          <td className="p-3 font-semibold">Email</td>
                          <td className="p-3"><a href="mailto:nefronaudio@gmail.com" className="text-electric-blue hover:underline font-semibold font-mono">nefronaudio@gmail.com</a></td>
                        </tr>
                        <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10">
                          <td className="p-3 font-semibold">Phone</td>
                          <td className="p-3 font-mono text-slate-800 dark:text-slate-200 font-semibold">+91 97907 59715</td>
                        </tr>
                        <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10">
                          <td className="p-3 font-semibold">Response Time</td>
                          <td className="p-3">Within 30 business days</td>
                        </tr>
                        <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10">
                          <td className="p-3 font-semibold">Language</td>
                          <td className="p-3">English or Tamil</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>

                <hr className="border-slate-100 dark:border-slate-900" />

                {/* Acknowledgement Footer Card */}
                <div className="bg-slate-50 dark:bg-slate-950 p-5 rounded-2xl text-xs text-center border border-slate-100 dark:border-slate-900">
                  <p className="font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[10px] mb-2">Acknowledgement</p>
                  <p className="text-slate-500 dark:text-slate-400 italic">
                    &quot;By using this Application, you acknowledge that you have read this Privacy Policy in full, understood its terms, and agree to be bound by its provisions.&quot;
                  </p>
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-900 text-[10px] text-slate-400 dark:text-slate-500 font-mono space-y-1">
                    <p>© 2026 Nefron Audio · All Rights Reserved · Confidential</p>
                    <p>Founder: Santhosh · nefronaudio@gmail.com · +91 97907 59715</p>
                    <p className="font-semibold text-electric-blue mt-1">This document constitutes a timestamped prior art declaration for Nefron Audio technology. Effective: June 2026.</p>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="general-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {/* General Policy Header */}
                <div className="text-center pb-5 border-b border-slate-100 dark:border-slate-900">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full">
                    Active System Policy
                  </span>
                  <h4 className="text-xl font-bold text-slate-900 dark:text-white mt-3 mb-1 uppercase tracking-tight">
                    NEFRON AUDIO MOBILE APP
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-widest">
                    Privacy Policy & Confidentiality Notice
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 font-mono mt-1">Effective Date: June 29, 2026</p>
                </div>

                <p>Welcome to the Nefron Audio App.</p>
                <p>
                  Nefron Audio is a proprietary research and development platform focused on next-generation immersive spatial audio technologies. This Privacy Policy explains how we collect, use, protect, and manage user information while safeguarding our confidential technology and intellectual property.
                </p>

                <hr className="border-slate-100 dark:border-slate-900" />

                <section className="space-y-3">
                  <h5 className="font-bold text-slate-900 dark:text-white text-base">1. Introduction</h5>
                  <p>
                    Nefron Audio (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is committed to protecting user privacy and maintaining the confidentiality of our proprietary technologies.
                  </p>
                  <p>
                    Although certain components of the Nefron Audio platform are currently under research and development and may not yet be protected by issued patents, they remain confidential trade secrets and proprietary intellectual property.
                  </p>
                  <p>By using this application, you agree to this Privacy Policy.</p>
                </section>

                <hr className="border-slate-100 dark:border-slate-900" />

                <section className="space-y-3">
                  <h5 className="font-bold text-slate-900 dark:text-white text-base">2. Information We Collect</h5>
                  <p>The application may collect:</p>
                  <ul className="list-disc list-inside pl-2 space-y-1.5 text-slate-600 dark:text-slate-400">
                    <li>User account information</li>
                    <li>Device information</li>
                    <li>Operating system version</li>
                    <li>Crash reports</li>
                    <li>Diagnostic logs</li>
                    <li>Network performance</li>
                    <li>Audio processing settings</li>
                    <li>User preferences</li>
                    <li>Application usage statistics</li>
                  </ul>
                  <p>
                    The application does not intentionally collect personal conversations, photos, videos, contacts, or unrelated private files without your explicit permission.
                  </p>
                </section>

                <hr className="border-slate-100 dark:border-slate-900" />

                <section className="space-y-3">
                  <h5 className="font-bold text-slate-900 dark:text-white text-base">3. Purpose of Data Collection</h5>
                  <p>Collected information is used only for:</p>
                  <ul className="list-disc list-inside pl-2 space-y-1.5 text-slate-600 dark:text-slate-400">
                    <li>Improving application stability</li>
                    <li>Enhancing audio performance</li>
                    <li>Bug fixing</li>
                    <li>AI optimization</li>
                    <li>Device compatibility</li>
                    <li>Software updates</li>
                    <li>Customer support</li>
                    <li>Security monitoring</li>
                  </ul>
                </section>

                <hr className="border-slate-100 dark:border-slate-900" />

                <section className="space-y-3">
                  <h5 className="font-bold text-slate-900 dark:text-white text-base">4. Confidential Technology</h5>
                  <p>
                    The Nefron Audio system contains proprietary research, engineering concepts, software architecture, AI processing methods, spatial rendering algorithms, module configurations, rendering strategies, acoustic optimization techniques, and other confidential technical information.
                  </p>
                  <p>
                    These materials are confidential and constitute valuable trade secrets owned by Nefron Audio.
                  </p>
                  <p>
                    No portion of the application&apos;s internal architecture should be interpreted as being placed into the public domain merely because it is accessible through this application.
                  </p>
                </section>

                <hr className="border-slate-100 dark:border-slate-900" />

                <section className="space-y-3">
                  <h5 className="font-bold text-slate-900 dark:text-white text-base">5. Intellectual Property</h5>
                  <p>
                    All copyrights, trademarks, logos, software, documentation, source code, designs, graphics, user interfaces, algorithms, databases, AI workflows, processing pipelines, engineering concepts, product names, and branding are the exclusive property of Nefron Audio unless otherwise stated.
                  </p>
                  <p>
                    No license is granted to copy, reproduce, modify, reverse engineer, redistribute, or commercially exploit any part of the application.
                  </p>
                </section>

                <hr className="border-slate-100 dark:border-slate-900" />

                <section className="space-y-3">
                  <h5 className="font-bold text-slate-900 dark:text-white text-base">6. Reverse Engineering Restriction</h5>
                  <p>Users agree not to:</p>
                  <ul className="list-disc list-inside pl-2 space-y-1.5 text-slate-600 dark:text-slate-400">
                    <li>Reverse engineer the application</li>
                    <li>Decompile the software</li>
                    <li>Disassemble the application</li>
                    <li>Extract AI models</li>
                    <li>Copy system architecture</li>
                    <li>Duplicate algorithms</li>
                    <li>Replicate rendering techniques</li>
                    <li>Create derivative products based upon confidential system behavior</li>
                  </ul>
                  <p>except where expressly permitted by applicable law.</p>
                </section>

                <hr className="border-slate-100 dark:border-slate-900" />

                <section className="space-y-3">
                  <h5 className="font-bold text-slate-900 dark:text-white text-base">7. Confidentiality Notice</h5>
                  <p>Certain technical information visible within the application is provided solely for operational use.</p>
                  <p>Users shall not:</p>
                  <ul className="list-disc list-inside pl-2 space-y-1.5 text-slate-600 dark:text-slate-400">
                    <li>Record confidential engineering information</li>
                    <li>Publish internal technical documentation</li>
                    <li>Share proprietary system specifications</li>
                    <li>Disclose confidential development materials</li>
                    <li>Redistribute non-public engineering data</li>
                  </ul>
                  <p>without prior written authorization from Nefron Audio.</p>
                </section>

                <hr className="border-slate-100 dark:border-slate-900" />

                <section className="space-y-3">
                  <h5 className="font-bold text-slate-900 dark:text-white text-base">8. Data Security</h5>
                  <p>
                    We implement reasonable administrative, technical, and organizational safeguards to protect user information and confidential system data against unauthorized access, alteration, disclosure, or destruction.
                  </p>
                  <p>
                    While no digital system can guarantee absolute security, we continuously work to improve our security practices.
                  </p>
                </section>

                <hr className="border-slate-100 dark:border-slate-900" />

                <section className="space-y-3">
                  <h5 className="font-bold text-slate-900 dark:text-white text-base">9. Third-Party Services</h5>
                  <p>The application may use trusted third-party providers for:</p>
                  <ul className="list-disc list-inside pl-2 space-y-1.5 text-slate-600 dark:text-slate-400">
                    <li>Cloud infrastructure</li>
                    <li>Authentication</li>
                    <li>Analytics</li>
                    <li>Crash reporting</li>
                    <li>Payment processing</li>
                    <li>Software updates</li>
                  </ul>
                  <p>These providers process data according to their own privacy policies.</p>
                </section>

                <hr className="border-slate-100 dark:border-slate-900" />

                <section className="space-y-3">
                  <h5 className="font-bold text-slate-900 dark:text-white text-base">10. User Responsibilities</h5>
                  <p>Users agree to:</p>
                  <ul className="list-disc list-inside pl-2 space-y-1.5 text-slate-600 dark:text-slate-400">
                    <li>Use the application lawfully.</li>
                    <li>Respect confidential information.</li>
                    <li>Avoid unauthorized copying or redistribution.</li>
                    <li>Refrain from attempting to bypass security measures.</li>
                    <li>Report suspected security vulnerabilities responsibly.</li>
                  </ul>
                </section>

                <hr className="border-slate-100 dark:border-slate-900" />

                <section className="space-y-3">
                  <h5 className="font-bold text-slate-900 dark:text-white text-base">11. Future Intellectual Property</h5>
                  <p>Nefron Audio is an actively evolving technology platform.</p>
                  <p>
                    Future patents, copyrights, trademarks, trade secrets, industrial designs, and other intellectual property rights may be filed or registered covering technologies currently under development.
                  </p>
                  <p>
                    Nothing in this Privacy Policy should be interpreted as a waiver of any present or future intellectual property rights.
                  </p>
                </section>

                <hr className="border-slate-100 dark:border-slate-900" />

                <section className="space-y-3">
                  <h5 className="font-bold text-slate-900 dark:text-white text-base">12. Updates to This Policy</h5>
                  <p>We may update this Privacy Policy from time to time.</p>
                  <p>
                    The latest version will always be published within the application, and continued use of the app constitutes acceptance of any updated terms.
                  </p>
                </section>

                <hr className="border-slate-100 dark:border-slate-900" />

                <section className="space-y-3">
                  <h5 className="font-bold text-slate-900 dark:text-white text-base">13. Contact Information</h5>
                  <p><strong>Owner:</strong> Santhosh</p>
                  <p><strong>Company:</strong> Nefron Audio</p>
                  <p><strong>Email:</strong> <a href="mailto:santhoshnefron@gmail.com" className="text-electric-blue hover:underline font-semibold font-mono">santhoshnefron@gmail.com</a></p>
                  <p>
                    For privacy questions, legal inquiries, or requests regarding confidential information, please contact the above email address.
                  </p>
                </section>

                <hr className="border-slate-100 dark:border-slate-900" />

                <div className="bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-900 p-4 rounded-2xl text-xs space-y-2">
                  <h6 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider">Legal Notice</h6>
                  <p className="text-slate-500 dark:text-slate-400">
                    This Privacy Policy describes our data handling practices and our commitment to protecting confidential information. It is not, by itself, a substitute for patents or other intellectual property registrations. Nefron Audio relies on applicable intellectual property, copyright, trade secret, contract, and other applicable laws to protect its proprietary technologies where available.
                  </p>
                  <p className="text-slate-400 dark:text-slate-500 text-[10px] mt-2">
                    &copy; 2026 Nefron Audio. All Rights Reserved.
                  </p>
                </div>

                <hr className="border-slate-100 dark:border-slate-900" />

                {/* Extended hardware policy */}
                <div className="border border-electric-blue/30 bg-electric-blue/5 p-5 rounded-2xl space-y-4">
                  <h4 className="text-base font-bold text-slate-900 dark:text-white">Nefron Audio</h4>
                  <h5 className="text-sm font-semibold text-electric-blue uppercase tracking-widest text-[11px]">Privacy Policy & Intellectual Property Terms of Service</h5>
                  <p className="text-xs text-slate-500 dark:text-slate-400"><strong>Effective Date:</strong> June 29, 2026</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    This document (&quot;Policy&quot;) governs your use of the Nefron Audio mobile application, control interfaces, calibration tools, and associated software platforms (collectively, the &quot;App&quot;). By downloading, installing, or using the App, you agree to the terms outlined below. This document serves a dual purpose: it outlines our data privacy practices and establishes strict legally binding protections regarding our proprietary intellectual property (IP).
                  </p>
                  
                  <div className="border-l-4 border-amber-500 bg-amber-500/10 dark:bg-amber-500/5 p-3 rounded-r-lg text-xs leading-relaxed text-amber-800 dark:text-amber-400">
                    <strong className="block text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-1 text-[10px]">CRITICAL LEGAL NOTICE REGARDING INTELLECTUAL PROPERTY</strong>
                    Because certain elements of the Nefron Audio technology—including but not limited to the Dual Rendering Architecture (Music Mode & Movie Mode), Dynamic Zoning calculations, and proprietary module matrix layouts—are not currently registered under public patents, they are strictly protected as <strong>Proprietary Trade Secrets, Copyrighted Code, and Confidential Information</strong> under applicable national and international intellectual property laws.
                  </div>

                  <div className="space-y-4 text-xs mt-3 text-slate-600 dark:text-slate-400">
                    <div className="space-y-1.5">
                      <strong className="block text-slate-900 dark:text-white text-sm">1. Intellectual Property & Trade Secret Protection</strong>
                      <p>To protect the unpatented but highly confidential innovations of Nefron Audio, your use of the App and system is subject to the following strict prohibitions:</p>
                      <ul className="list-disc list-inside pl-2 space-y-1">
                        <li><strong>No Reverse Engineering:</strong> You may not decompile, decipher, disassemble, or reverse-engineer the App, its AI processing logic, spatial acoustic algorithms, or any embedded firmware.</li>
                        <li><strong>Protection of Architecture:</strong> The internal logic of the Nefron Geometric Engine, including the diamond staggered array matrix (3N-1) logic, hybrid audio matrix mixing formulas, and kinematic actuator cross-talk logic, are Trade Secrets. Extracting or reproducing this logic is strictly forbidden.</li>
                        <li><strong>Prohibition on Cloning:</strong> You may not use the App to analyze, measure, or monitor the behavior of the Nefron Audio system for the purpose of creating a competing product, cloning the hardware layout, or recreating the software&apos;s spatial steering capabilities.</li>
                        <li><strong>Data Mining & Scraping:</strong> You may not use automated tools to extract acoustic calibration data, DSP parameters, or network payloads transmitted between the App and the Nefron AI Brain servers.</li>
                      </ul>
                    </div>

                    <div className="space-y-1.5">
                      <strong className="block text-slate-900 dark:text-white text-sm">2. Data Collection and Privacy Policy</strong>
                      <p>Nefron Audio is committed to protecting your privacy. To provide our advanced spatial audio calibration and control features, the App must collect and process certain types of data.</p>
                      
                      <div className="pl-2 space-y-2">
                        <div>
                          <strong className="block text-slate-900 dark:text-white text-xs">A. Information We Collect</strong>
                          <ul className="list-disc list-inside pl-2 space-y-0.5">
                            <li><strong>Acoustic & Microphone Data:</strong> During system setup and calibration, the App requires microphone access to measure room impulse responses, latency, and phase alignment. <em>This audio data is processed locally or temporarily in volatile memory and is never permanently recorded, stored, or sold.</em></li>
                            <li><strong>Network & Device Information:</strong> We collect hardware identifiers, IP addresses, and local network topologies (Dante/EtherCAT connections) strictly to establish communication between the App and the physical Nefron tracking modules.</li>
                            <li><strong>Account Information:</strong> If registering as a cinema operator or system integrator, we collect your name, email, company details, and encrypted login credentials.</li>
                            <li><strong>Telemetry & Diagnostics:</strong> We collect non-personally identifiable hardware diagnostic data (e.g., motor temperatures, driver impedance, DSP load) to facilitate our self-healing AI maintenance algorithms and improve system reliability.</li>
                          </ul>
                        </div>

                        <div>
                          <strong className="block text-slate-900 dark:text-white text-xs">B. How We Use Your Data</strong>
                          <p>Your data is used exclusively to operate, maintain, and improve the Nefron Audio platform. We do not sell your personal data, acoustic profiles, or auditorium dimensions to third-party advertising or data brokerage firms.</p>
                        </div>

                        <div>
                          <strong className="block text-slate-900 dark:text-white text-xs">C. Data Security</strong>
                          <p>We implement enterprise-grade encryption (AES-256) for all data transmitted between the App and our cloud infrastructure. Access to diagnostic data is strictly limited to authorized Nefron Audio engineers for support purposes.</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <strong className="block text-slate-900 dark:text-white text-sm">3. Disclaimer of Warranties and Limitation of Liability</strong>
                      <p>The App and the Nefron Audio system are provided on an &quot;as-is&quot; and &quot;as-available&quot; basis. Nefron Audio makes no warranties regarding the uninterrupted operation of the App. Under no circumstances shall Nefron Audio be liable for any indirect, incidental, special, or consequential damages arising from the use or inability to use the App.</p>
                    </div>

                    <div className="space-y-1.5">
                      <strong className="block text-slate-900 dark:text-white text-sm">4. Legal Jurisdiction and Enforcement</strong>
                      <p>Any violation of the Intellectual Property & Trade Secret terms outlined in Section 1 will result in immediate termination of your license to use the App and associated hardware. Nefron Audio reserves the right to pursue full civil and criminal remedies, including injunctive relief and damages, for the theft of Trade Secrets or breach of this agreement.</p>
                      <p>This agreement shall be governed by and construed in accordance with the laws of India, with exclusive jurisdiction in the courts of Chennai, Tamil Nadu.</p>
                    </div>
                  </div>

                  <p className="text-slate-400 dark:text-slate-500 text-[10px] border-t border-slate-100 dark:border-slate-900 pt-4 mt-2">
                    <em>&copy; 2026 Nefron Audio. All Rights Reserved. Proprietary and Confidential. Not for unauthorized distribution.</em>
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 dark:border-slate-900 flex justify-end bg-slate-50/50 dark:bg-slate-950/50">
          <button
            onClick={onClose}
            className="px-6 py-3 rounded-xl bg-electric-blue text-white font-bold hover:bg-electric-blue/90 shadow-md hover:shadow-lg transition-all cursor-pointer focus:outline-none text-xs uppercase tracking-widest"
          >
            I Accept / Close
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
