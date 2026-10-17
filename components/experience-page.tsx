'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Youtube, Activity, Link2, Loader2, Play, Pause, SlidersHorizontal, Mic2, Guitar, Drum, Maximize2, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NefronLogo } from './icons';
import { Theater3D } from './theater-3d';

interface ExperiencePageProps {
  userId: string;
  userEmail: string;
}

type ProcessStep = {
  id: string;
  label: string;
  durationMs: number;
};

const PROCESS_STEPS: ProcessStep[] = [
  { id: 'download', label: 'Accessing YouTube Stream & Caching Media...', durationMs: 4000 },
  { id: 'init', label: 'Initializing Nefron AI Deep Extraction Models...', durationMs: 3000 },
  { id: 'vocals', label: 'Isolating Vocals, Chorus, and Voice Patterns...', durationMs: 5000 },
  { id: 'echo', label: 'Extracting Spatial Echo & Reverb Profiles...', durationMs: 4500 },
  { id: 'instruments', label: 'Separating Instruments (Drums, Guitars, Keys)...', durationMs: 6000 },
  { id: 'objects', label: 'Granular Spatial Object Audio Demuxing (Every Object)...', durationMs: 8000 },
  { id: 'finalize', label: 'Finalizing Multi-Channel Stem Rendering...', durationMs: 2500 }
];

interface Stem {
  id: string;
  name: string;
  category: 'vocal' | 'instrument' | 'object';
  icon: React.ElementType;
  value: number;
  color: string;
}

const INITIAL_STEMS: Stem[] = [
  { id: 's1', name: 'Lead Voice', category: 'vocal', icon: Mic2, value: 80, color: '#3B82F6' },
  { id: 's2', name: 'Chorus', category: 'vocal', icon: Mic2, value: 60, color: '#60A5FA' },
  { id: 's3', name: 'Echo/Reverb', category: 'vocal', icon: Activity, value: 45, color: '#93C5FD' },
  { id: 's4', name: 'Drums', category: 'instrument', icon: Drum, value: 85, color: '#F59E0B' },
  { id: 's5', name: 'Guitars', category: 'instrument', icon: Guitar, value: 75, color: '#D97706' },
  { id: 's6', name: 'Keys/Synth', category: 'instrument', icon: SlidersHorizontal, value: 65, color: '#FCD34D' },
  { id: 's7', name: 'Object 1 (Foley)', category: 'object', icon: Maximize2, value: 50, color: '#10B981' },
  { id: 's8', name: 'Object 2 (Kinetic)', category: 'object', icon: Maximize2, value: 55, color: '#34D399' },
  { id: 's9', name: 'Object 3 (Ambient)', category: 'object', icon: Maximize2, value: 40, color: '#6EE7B7' },
];

const getYouTubeId = (url: string) => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

export function ExperiencePage({ userId, userEmail }: ExperiencePageProps) {
  const [stems, setStems] = React.useState<Stem[]>(INITIAL_STEMS);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [isPageLoaded, setIsPageLoaded] = React.useState(false);

  React.useEffect(() => {
    // Artificial delay for skeleton demonstration
    const hasCache = localStorage.getItem('experience_page_loaded_v1');
    if (hasCache) {
      setIsPageLoaded(true);
    } else {
      const timer = setTimeout(() => {
        setIsPageLoaded(true);
        localStorage.setItem('experience_page_loaded_v1', 'true');
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  React.useEffect(() => {
    const handler = (e: PromiseRejectionEvent) => {
      if (
        (e.reason && typeof e.reason.message === 'string' && (e.reason.message.includes('The play() request was interrupted') || e.reason.message.includes('call to pause()'))) ||
        (e.reason && e.reason.name === 'FirebaseError' && e.reason.code === 'unavailable')
      ) {
        e.preventDefault();
      }
    };
    window.addEventListener('unhandledrejection', handler);
    return () => window.removeEventListener('unhandledrejection', handler);
  }, []);

  // Fallback check
  if (userEmail !== 'p26893150@gmail.com') {
    return (
      <div className="flex items-center justify-center h-full w-full bg-black-deep text-white p-6">
        <div className="text-center">
          <Activity className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2 uppercase tracking-widest text-red-500 font-headline">Access Restricted</h2>
          <p className="text-muted">This experimental lab is restricted to authorized developer accounts only.</p>
        </div>
      </div>
    );
  }

  const handleSliderChange = (id: string, newValue: number) => {
    setStems(stems.map(s => s.id === id ? { ...s, value: newValue } : s));
  };

  return (
    <div className="h-full w-full overflow-y-auto custom-scrollbar relative p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto space-y-8 pb-32">
        {!isPageLoaded ? (
          <div className="space-y-8 animate-pulse">
            <header className="mb-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-white/5" />
                <div className="space-y-2">
                  <div className="h-8 w-48 bg-white/5 rounded" />
                  <div className="h-4 w-64 bg-white/5 rounded" />
                </div>
              </div>
              <div className="w-48 h-12 bg-white/5 rounded-2xl" />
            </header>
            
            <div className="w-full h-[400px] rounded-3xl bg-white/5" />
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white/5 border border-white/5 rounded-2xl p-5 space-y-6">
                  <div className="h-6 w-32 bg-white/10 rounded mb-6" />
                  <div className="space-y-5">
                    {[1, 2, 3].map(j => (
                      <div key={j} className="space-y-2">
                        <div className="flex justify-between">
                          <div className="h-4 w-24 bg-white/5 rounded" />
                          <div className="h-4 w-8 bg-white/5 rounded" />
                        </div>
                        <div className="h-2 w-full bg-white/10 rounded-full" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            <header className="mb-10 text-center sm:text-left flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div className="flex items-center gap-4 text-left">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[var(--logo-gradient-start)] to-transparent p-px">
                  <div className="w-full h-full bg-black-deep rounded-2xl flex items-center justify-center">
                    <Activity className="w-6 h-6 text-[var(--logo-gradient-start)] font-bold animate-pulse" />
                  </div>
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-headline font-bold tracking-widest text-foreground uppercase">
                    Interactive <span className="text-[var(--logo-gradient-start)]">Lab</span>
                  </h1>
                  <p className="text-muted text-sm mt-1">Real-time Nefron module audio & laser simulation</p>
                </div>
              </div>

              <div className="flex items-center gap-4 bg-gray-dark/40 border border-[var(--glow-color-strong)]/30 p-3 px-5 rounded-2xl shrink-0 self-start sm:self-auto">
                <button 
                  onClick={() => setIsPlaying(!isPlaying)}
                  className={cn(
                    "w-12 h-12 rounded-full text-white flex items-center justify-center transition-all bg-gradient-to-br duration-300 font-bold",
                    isPlaying 
                      ? "from-amber-500 to-red-600 hover:shadow-[0_0_15px_rgba(245,158,11,0.5)]" 
                      : "from-[var(--logo-gradient-start)] to-[var(--logo-gradient-end)] hover:shadow-[0_0_20px_var(--glow-color-strong)]"
                  )}
                >
                  {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-1" />}
                </button>
                <div className="text-left select-none">
                  <h3 className="font-bold text-sm tracking-wide uppercase font-headline">
                    {isPlaying ? "Laser matrix: ACTIVE" : "Theater standby"}
                  </h3>
                  <p className="text-[11px] text-muted">
                    {isPlaying ? "Simulating surround stem beams" : "Tap play to activate virtual emitters"}
                  </p>
                </div>
              </div>
            </header>

            {/* Beautiful high contrast Three.js Theater scene */}
            <Theater3D stems={stems} isPlaying={isPlaying} />

            {/* Stem Slider panel */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Vocals & Voice */}
              <div className="bg-gray-dark/20 border border-[var(--glow-color-strong)]/30 rounded-2xl p-5 space-y-6">
                <h4 className="text-sm font-bold uppercase tracking-wider text-muted border-b border-foreground/10 pb-2 flex items-center gap-2 font-headline">
                  <Mic2 size={16} className="text-[#3B82F6]" /> Vocals & Voice
                </h4>
                <div className="space-y-5">
                  {stems.filter(s => s.category === 'vocal').map((stem) => (
                    <StemSlider key={stem.id} stem={stem} isPlaying={isPlaying} onChange={handleSliderChange} />
                  ))}
                </div>
              </div>

              {/* Instruments */}
              <div className="bg-gray-dark/20 border border-[var(--glow-color-strong)]/30 rounded-2xl p-5 space-y-6">
                <h4 className="text-sm font-bold uppercase tracking-wider text-muted border-b border-foreground/10 pb-2 flex items-center gap-2 font-headline">
                  <Guitar size={16} className="text-[#F59E0B]" /> Instruments & Music
                </h4>
                <div className="space-y-5">
                  {stems.filter(s => s.category === 'instrument').map((stem) => (
                    <StemSlider key={stem.id} stem={stem} isPlaying={isPlaying} onChange={handleSliderChange} />
                  ))}
                </div>
              </div>

              {/* Objects */}
              <div className="bg-gray-dark/20 border border-[var(--glow-color-strong)]/30 rounded-2xl p-5 space-y-6">
                <h4 className="text-sm font-bold uppercase tracking-wider text-[var(--logo-gradient-start)] border-b border-[var(--logo-gradient-start)]/20 pb-2 flex items-center gap-2 font-headline">
                  <Maximize2 size={16} className="text-[#10B981]" /> Spatial Objects
                </h4>
                <div className="space-y-5">
                  {stems.filter(s => s.category === 'object').map((stem) => (
                    <StemSlider key={stem.id} stem={stem} isPlaying={isPlaying} onChange={handleSliderChange} />
                  ))}
                </div>
              </div>
            </div>
            
            <div className="p-6 bg-black-deep border border-[var(--logo-gradient-start)]/20 rounded-2xl flex flex-col items-center justify-center text-center">
               <NefronLogo className="w-12 h-12 text-[var(--logo-gradient-start)] mb-4" />
               <h3 className="font-headline tracking-widest text-lg font-bold text-foreground">NEFRON AUDIO TRANSLATOR</h3>
               <p className="text-sm text-muted mt-2 max-w-2xl leading-relaxed">
                 This interactive virtual simulation gives investors a dynamic preview of the physical Nefron spatial theater experience. Adjust the sliders above to mix individual stem emission levels and explore the gorgeous geometry in real-time.
               </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StemSlider({ stem, isPlaying, onChange }: { stem: Stem, isPlaying: boolean, onChange: (id: string, val: number) => void }) {
  const Icon = stem.icon;
  // Simulate levels jumping when playing
  const [visualLevel, setVisualLevel] = React.useState(stem.value);

  React.useEffect(() => {
    if (!isPlaying) {
      setVisualLevel(0);
      return;
    }
    const interval = setInterval(() => {
      // Fluctuate between 40% below and 20% above the set value
      const modifier = (Math.random() * 60) - 40;
      setVisualLevel(Math.max(5, Math.min(100, stem.value + modifier)));
    }, 150);
    return () => clearInterval(interval);
  }, [isPlaying, stem.value]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-foreground">
          <Icon size={14} style={{ color: stem.value > 0 ? stem.color : '#666' }} />
          <span>{stem.name}</span>
        </div>
        <span className="text-xs font-mono text-muted">{stem.value}%</span>
      </div>
      
      <div className="relative h-6 flex items-center group">
        {/* The Audio level visualizer behind the slider */}
        <div className="absolute inset-y-0 left-0 bottom-0 bg-gradient-to-t from-transparent to-current opacity-10 pointer-events-none rounded-r" 
             style={{ width: `${visualLevel}%`, color: stem.color, transition: 'width 0.15s ease-out' }} />
             
        <input 
          type="range" 
          min="0" 
          max="100" 
          value={stem.value}
          onChange={(e) => onChange(stem.id, parseInt(e.target.value))}
          className="w-full h-1 bg-foreground/10 rounded-full appearance-none cursor-pointer outline-none z-10"
          style={{
            background: `linear-gradient(to right, ${stem.color} ${stem.value}%, rgba(255,255,255,0.1) ${stem.value}%)`
          }}
        />
        {/* Custom thumb style works via globals but standard styling mostly works on webkit */}
        <style dangerouslySetInnerHTML={{__html: `
          input[type=range]::-webkit-slider-thumb {
            appearance: none;
            width: 14px;
            height: 14px;
            border-radius: 50%;
            background: ${stem.color};
            cursor: pointer;
            box-shadow: 0 0 10px ${stem.color};
          }
        `}} />
      </div>
    </div>
  );
}
