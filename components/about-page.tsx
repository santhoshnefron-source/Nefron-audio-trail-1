'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useMotionValue, animate } from 'motion/react';
import { Upload, X, Image as ImageIcon, Trash2, Sparkles, Loader2, Sliders, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from './ui/skeleton';
import { NefronLogo } from './icons';
import { db, auth } from '../lib/firebase';
import { doc, onSnapshot, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { AboutAiGuide } from './about-ai-guide';
import { storage } from '../lib/storage';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
}

const FullScreenOverlay = React.memo(({ src, onClose }: { src: string | null, onClose: () => void }) => {
  const [scale, setScale] = React.useState(1);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const lastTap = React.useRef<number>(0);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const handleImageClick = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    const now = Date.now();
    
    // Get coordinates
    let clientX = 0;
    let clientY = 0;
    
    if ('clientX' in e) {
      clientX = e.clientX;
      clientY = e.clientY;
    } else if ('changedTouches' in e && e.changedTouches.length > 0) {
      clientX = e.changedTouches[0].clientX;
      clientY = e.changedTouches[0].clientY;
    }

    if (now - lastTap.current < 400) {
      // Double tap detected
      if (scale > 1) {
        setScale(1);
        animate(x, 0, { type: "spring", stiffness: 400, damping: 40 });
        animate(y, 0, { type: "spring", stiffness: 400, damping: 40 });
      } else {
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        
        // Calculate how much to shift to center the tapped point
        const dx = (centerX - clientX) * 2;
        const dy = (centerY - clientY) * 2;
        
        setScale(2);
        animate(x, dx, { type: "spring", stiffness: 400, damping: 40 });
        animate(y, dy, { type: "spring", stiffness: 400, damping: 40 });
      }
    }
    lastTap.current = now;
  };

  // Reset scale and position when image changes or closes
  React.useEffect(() => {
    if (!src) {
      setScale(1);
      x.set(0);
      y.set(0);
    }
  }, [src, x, y]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {src && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.1, ease: "linear" }}
          className="fixed inset-0 z-[9999] bg-black flex items-center justify-center overflow-hidden touch-none"
          style={{ transform: 'translateZ(0)', backfaceVisibility: 'hidden' }}
          onClick={onClose}
        >
          <button
            className="absolute top-6 right-6 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors z-[10000] focus:outline-none"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
          >
            <X size={24} />
          </button>

          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md text-white/60 text-[10px] font-bold uppercase tracking-[0.2em] pointer-events-none select-none z-[10000]">
            {scale > 1 ? "Drag to pan • Double tap to reset" : "Double tap to zoom"}
          </div>

          <div 
            ref={containerRef}
            className="relative w-full h-full flex items-center justify-center"
            onClick={handleImageClick}
            onTouchEnd={handleImageClick}
          >
            <motion.img
              drag={scale > 1}
              dragConstraints={{ 
                left: -1200, 
                right: 1200, 
                top: -1200, 
                bottom: 1200 
              }}
              dragElastic={0.1}
              style={{ x, y, scale }}
              animate={{ scale }}
              transition={{ type: "spring", stiffness: 400, damping: 40 }}
              whileTap={{ scale: scale > 1 ? 0.98 : 1.02 }}
              src={src}
              alt="Full Screen Preview"
              className={cn(
                "max-w-full max-h-screen object-contain select-none",
                scale > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in"
              )}
              referrerPolicy="no-referrer"
              decoding="async"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
});

FullScreenOverlay.displayName = 'FullScreenOverlay';

export function AboutPage() {
  const [images, setImages] = React.useState<{ [key: string]: string | null }>({});
  const [isPageLoaded, setIsPageLoaded] = React.useState(false);
  const [loadingStates, setLoadingStates] = React.useState<{ [key: string]: boolean }>({
    main: true, theater: true, music: true, tilt: true,
    f1: true, f2: true, f3: true, f4: true, f5: true, f6: true,
    nefronAudio: true
  });
  const [uploadingStates, setUploadingStates] = React.useState<{ [key: string]: boolean }>({});

  const [fullScreenImage, setFullScreenImage] = React.useState<string | null>(null);
  const [, startTransition] = React.useTransition();

  const handleZoom = React.useCallback((src: string | null) => {
    startTransition(() => {
      setFullScreenImage(src);
    });
  }, []);

  React.useEffect(() => {
    // Artificial delay for skeleton demonstration, matching real app vibe
    const hasCache = localStorage.getItem('about_page_loaded_v1');
    if (hasCache) {
      setIsPageLoaded(true);
    } else {
      const timer = setTimeout(() => {
        setIsPageLoaded(true);
        localStorage.setItem('about_page_loaded_v1', 'true');
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  React.useEffect(() => {
    const configs = [
      { id: 'about_page', key: 'main', field: 'image' },
      { id: 'about_page_theater', key: 'theater', field: 'theaterImage' },
      { id: 'about_page_music_mode', key: 'music', field: 'musicModeImage' },
      { id: 'about_page_tilt', key: 'tilt', field: 'tiltImage' },
      { id: 'about_page_feature_one', key: 'f1', field: 'featureOneImage' },
      { id: 'about_page_feature_two', key: 'f2', field: 'featureTwoImage' },
      { id: 'about_page_feature_three', key: 'f3', field: 'featureThreeImage' },
      { id: 'about_page_feature_four', key: 'f4', field: 'featureFourImage' },
      { id: 'about_page_feature_five', key: 'f5', field: 'featureFiveImage' },
      { id: 'about_page_feature_six', key: 'f6', field: 'featureSixImage' },
      { id: 'about_page_nefron_audio', key: 'nefronAudio', field: 'nefronAudioImage' },
    ];

    // Load instantly from localStorage immediately so there is no blank state
    const cachedImages: { [key: string]: string | null } = {};
    const newLoadingStates: { [key: string]: boolean } = {};
    
    configs.forEach(config => {
      const cached = storage.getItemString(`nefron_img_${config.key}`);
      cachedImages[config.key] = cached;
      // Keep loading as true if not in cache, so skeleton shows until snapshot resolves
      newLoadingStates[config.key] = !cached;
    });
    setImages(prev => ({ ...prev, ...cachedImages }));
    setLoadingStates(prev => ({ ...prev, ...newLoadingStates }));

    // Subscribe to a SINGLE metadata document to avoid traversing large image sizes
    const unsub = onSnapshot(doc(db, 'app_settings', 'metadata_images'), async (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        
        // Check which images are outdated
        for (const config of configs) {
          const remoteTs = data[`ts_${config.key}`] || 0;
          const localTs = Number(storage.getItemString(`nefron_img_ts_${config.key}`) || 0);

          if (remoteTs > localTs) {
            // Need to fetch this specific image
            setLoadingStates(prev => ({ ...prev, [config.key]: true }));
            try {
              const imgSnap = await getDoc(doc(db, 'app_settings', config.id));
              if (imgSnap.exists()) {
                const base64Val = imgSnap.data()[config.field];
                if (base64Val) {
                  storage.setItemString(`nefron_img_${config.key}`, base64Val);
                  storage.setItemString(`nefron_img_ts_${config.key}`, String(remoteTs));
                  setImages(prev => ({ ...prev, [config.key]: base64Val }));
                } else {
                  storage.removeItem(`nefron_img_${config.key}`);
                  storage.removeItem(`nefron_img_ts_${config.key}`);
                  setImages(prev => ({ ...prev, [config.key]: null }));
                }
              }
            } catch (err) {
              console.warn(`Failed to fetch image ${config.key}`, err);
            } finally {
              setLoadingStates(prev => ({ ...prev, [config.key]: false }));
            }
          } else {
            // We are up to date! Stop loading if we were still waiting.
            setLoadingStates(prev => ({ ...prev, [config.key]: false }));
          }
        }
      } else {
        // Document doesn't exist, no images are uploaded. Stop all loaders.
        setLoadingStates(
          configs.reduce((acc, config) => ({ ...acc, [config.key]: false }), {})
        );
      }
    }, (error) => {
      console.warn('Firestore metadata subscription failed.', error);
      setLoadingStates(
        configs.reduce((acc, config) => ({ ...acc, [config.key]: false }), {})
      );
    });

    return () => unsub();
  }, []);

  const isAdmin = React.useMemo(() => {
    const email = auth.currentUser?.email;
    return email === 'p26893150@gmail.com';
  }, [auth.currentUser?.email]);

  const setUploading = (key: string, value: boolean) => {
    setUploadingStates(prev => ({ ...prev, [key]: value }));
  };

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const theaterFileInputRef = React.useRef<HTMLInputElement>(null);
  const musicModeFileInputRef = React.useRef<HTMLInputElement>(null);
  const tiltFileInputRef = React.useRef<HTMLInputElement>(null);
  const featureOneFileInputRef = React.useRef<HTMLInputElement>(null);
  const featureTwoFileInputRef = React.useRef<HTMLInputElement>(null);
  const featureThreeFileInputRef = React.useRef<HTMLInputElement>(null);
  const featureFourFileInputRef = React.useRef<HTMLInputElement>(null);
  const featureFiveFileInputRef = React.useRef<HTMLInputElement>(null);
  const featureSixFileInputRef = React.useRef<HTMLInputElement>(null);
  const nefronAudioFileInputRef = React.useRef<HTMLInputElement>(null);

  const configMap: { [key: string]: { id: string, field: string, ref: React.RefObject<HTMLInputElement | null> } } = {
    main: { id: 'about_page', field: 'image', ref: fileInputRef },
    theater: { id: 'about_page_theater', field: 'theaterImage', ref: theaterFileInputRef },
    music: { id: 'about_page_music_mode', field: 'musicModeImage', ref: musicModeFileInputRef },
    tilt: { id: 'about_page_tilt', field: 'tiltImage', ref: tiltFileInputRef },
    f1: { id: 'about_page_feature_one', field: 'featureOneImage', ref: featureOneFileInputRef },
    f2: { id: 'about_page_feature_two', field: 'featureTwoImage', ref: featureTwoFileInputRef },
    f3: { id: 'about_page_feature_three', field: 'featureThreeImage', ref: featureThreeFileInputRef },
    f4: { id: 'about_page_feature_four', field: 'featureFourImage', ref: featureFourFileInputRef },
    f5: { id: 'about_page_feature_five', field: 'featureFiveImage', ref: featureFiveFileInputRef },
    f6: { id: 'about_page_feature_six', field: 'featureSixImage', ref: featureSixFileInputRef },
    nefronAudio: { id: 'about_page_nefron_audio', field: 'nefronAudioImage', ref: nefronAudioFileInputRef },
  };

  const handleGenericUpload = async (key: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && isAdmin) {
      // 1. Optimistically display original image instantly
      const previewUrl = URL.createObjectURL(file);
      setImages(prev => ({ ...prev, [key]: previewUrl }));
      setUploading(key, false); // No blocking UI loader!
      
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          let base64String = reader.result as string;
          // Aggressive compression regardless of initial size to ensure it always fits in Firebase
          base64String = await compressImage(base64String);
          
          // Background sync
          const ts = Date.now();
          storage.setItemString(`nefron_img_${key}`, base64String);
          storage.setItemString(`nefron_img_ts_${key}`, String(ts));
          
          const config = configMap[key];
          await setDoc(doc(db, 'app_settings', config.id), { 
            [config.field]: base64String, 
            updatedAt: serverTimestamp() 
          });
          
          await setDoc(doc(db, 'app_settings', 'metadata_images'), {
            [`ts_${key}`]: ts
          }, { merge: true });
          
          // Free object url and swap to base64 silently
          URL.revokeObjectURL(previewUrl);
          setImages(prev => ({ ...prev, [key]: base64String }));
          
        } catch (error) {
          console.error('Upload error: ', error);
          // Rollback on error
          setImages(prev => ({ ...prev, [key]: storage.getItemString(`nefron_img_${key}`) }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const clearImageByKey = async (key: string) => {
    if (!isAdmin) return;
    
    // Save backup for rollback
    const originalImage = images[key];

    // 1. Instantly update UI and local state - No loading spinner
    const ts = Date.now();
    storage.removeItem(`nefron_img_${key}`);
    storage.setItemString(`nefron_img_ts_${key}`, String(ts));
    setImages(prev => ({ ...prev, [key]: null }));
    
    try {
      // 2. Background sync
      const config = configMap[key];
      await setDoc(doc(db, 'app_settings', config.id), { 
        [config.field]: null, 
        updatedAt: serverTimestamp() 
      });
      
      await setDoc(doc(db, 'app_settings', 'metadata_images'), {
        [`ts_${key}`]: ts
      }, { merge: true });
      
    } catch (error) {
      console.error('Delete error: ', error);
      // Rollback
      if (originalImage) {
        storage.setItemString(`nefron_img_${key}`, originalImage);
      }
      setImages(prev => ({ ...prev, [key]: originalImage }));
    }
  };

  const ImageHolder = React.memo(({ 
    imageKey, 
    title, 
    placeholder, 
    alt 
  }: { 
    imageKey: string, 
    title: string, 
    placeholder: string, 
    alt: string 
  }) => {
    const img = images[imageKey];
    const loading = loadingStates[imageKey];
    const uploading = uploadingStates[imageKey];
    const config = configMap[imageKey];

    if (!img && !isAdmin && !loading) return null;

    return (
      <div className="space-y-6 mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-muted flex items-center gap-2">
            <Sparkles size={16} className="text-electric-blue" />
            {title}
          </h2>
          {img && isAdmin && (
            <button
              onClick={() => clearImageByKey(imageKey)}
              disabled={uploading}
              className="text-xs font-bold uppercase tracking-widest text-red-500 hover:text-red-400 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              Remove Image
            </button>
          )}
        </div>

        <div className={cn(
          "relative group rounded-3xl overflow-hidden transition-all duration-500 flex items-center justify-center w-full",
          img 
            ? "border-none shadow-2xl shadow-electric-blue/10" 
            : "border-2 border-dashed min-h-[300px] border-foreground/10 hover:border-electric-blue/50 bg-gray-dark/30"
        )}>
          {isAdmin && (
            <input
              type="file"
              ref={config.ref}
              onChange={(e) => handleGenericUpload(imageKey, e)}
              accept="image/*"
              className="hidden"
            />
          )}

          <div className="w-full h-full flex items-center justify-center relative">
            {loading ? (
              <Skeleton className="absolute inset-0 w-full h-full min-h-[400px] rounded-3xl" />
            ) : img ? (
              <motion.div 
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                className="w-full relative cursor-zoom-in group/img" 
                onClick={() => handleZoom(img)}
              >
                <img src={img} alt={alt} className="w-full h-auto block transition-transform duration-500 group-hover/img:scale-[1.02] will-change-transform" referrerPolicy="no-referrer" />
                
                {/* Hover Overlay for all users to indicate zoomability */}
                <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/20 transition-colors duration-300 flex items-center justify-center">
                  <div className="p-3 rounded-full bg-white/10 backdrop-blur-md text-white opacity-0 group-hover/img:opacity-100 transition-all duration-300 transform scale-90 group-hover/img:scale-100">
                    <Sparkles size={24} className="animate-pulse" />
                  </div>
                </div>

                {isAdmin && (
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center gap-3">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        config.ref.current?.click();
                      }} 
                      disabled={uploading} 
                      className="px-6 py-3 rounded-full bg-white text-black font-bold text-sm flex items-center gap-2 transform translate-y-4 group-hover:translate-y-0 transition-all duration-300 disabled:opacity-50 hover:bg-electric-blue hover:text-white"
                    >
                      {uploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                      Change Image
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleZoom(img);
                      }}
                      className="px-6 py-3 rounded-full bg-black/50 border border-white/30 text-white font-bold text-sm flex items-center gap-2 transform translate-y-4 group-hover:translate-y-0 transition-all duration-300 delay-75 hover:bg-white/20"
                    >
                      <Sparkles size={18} />
                      View Full Screen
                    </button>
                  </div>
                )}
              </motion.div>
            ) : isAdmin ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-4 cursor-pointer py-12" onClick={() => config.ref.current?.click()}>
                <div className="w-16 h-16 rounded-full bg-electric-blue/10 flex items-center justify-center text-electric-blue group-hover:scale-110 transition-transform duration-500">
                  {uploading ? <Loader2 size={32} className="animate-spin" /> : <ImageIcon size={32} />}
                </div>
                <div className="text-center">
                  <p className="text-lg font-medium text-foreground">{placeholder}</p>
                  <p className="text-sm text-muted">Click to select a visualization</p>
                </div>
              </div>
            ) : (
              <div className="text-muted italic text-sm">No visualization set by administrator.</div>
            )}
          </div>
        </div>
      </div>
    );
  });

  const compressImage = (base64Str: string, maxWidth = 1000, maxHeight = 1000, quality = 0.6): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
    });
  };

  const mainContent = React.useMemo(() => (
    <div className="max-w-3xl w-full space-y-12 about-page-content">
      {/* Header Section */}
        <div className="text-center space-y-4">
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col items-center justify-center pt-8 md:pt-12"
          >
            <NefronLogo className="w-36 h-36 md:w-48 md:h-48 mx-auto mb-8 opacity-95 drop-shadow-[0_0_20px_var(--glow-color-strong)]" strokeWidth="1" />
          </motion.div>
          <h1 className="text-4xl md:text-5xl font-headline tracking-widest neon-glow bg-gradient-to-r from-[var(--logo-gradient-start)] via-[var(--logo-gradient-mid)] to-[var(--logo-gradient-end)] bg-clip-text text-transparent">
            About Nefron
          </h1>
          <div className="h-px w-32 mx-auto bg-gradient-to-r from-transparent via-electric-blue/50 to-transparent" />
        </div>

        {/* Story Section */}
        <div id="nefron-audio" className="space-y-10 text-left performance-section">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold text-electric-blue tracking-wider uppercase">NEFRON AUDIO</h2>
            <p className="text-xl font-medium text-foreground">The World's First Electro-Mechanical Spatial Audio Platform</p>
            <p className="text-sm text-muted italic">Founded by Santhosh</p>
            
            <ImageHolder 
              imageKey="nefronAudio"
              title="Nefron Audio Visualization"
              placeholder="Upload Nefron Audio Visualization"
              alt="Nefron Audio"
            />
          </div>

          <section id="story-sound" className="space-y-6">
            <h3 className="text-2xl font-bold text-foreground border-l-4 border-electric-blue pl-4">
              THE STORY OF SOUND — AND WHY IT NEEDED TO CHANGE
            </h3>
            <p className="text-muted leading-relaxed text-lg">
              For decades, the cinema industry has chased one singular goal: to make audiences forget they are sitting in a room and feel like they are living inside the story. Every generation of audio technology has brought us closer to that dream. But until today, one fundamental physical problem has remained unsolved.
            </p>
            <p className="text-muted leading-relaxed text-lg">
              This is the story of how Nefron Audio solved it.
            </p>
          </section>

          <section id="dolby-atmos" className="space-y-6">
            <h3 className="text-2xl font-bold text-foreground border-l-4 border-electric-blue pl-4">
              UNDERSTANDING DOLBY ATMOS — THE CURRENT GOLD STANDARD
            </h3>
            <p className="text-muted leading-relaxed text-lg">
              To appreciate what Nefron Audio has achieved, you must first understand what came before it.
            </p>
            <p className="text-muted leading-relaxed text-lg">
              Dolby Atmos, introduced in 2012, was a genuine revolution in cinematic sound. Before Atmos, audio was "channel-based" — meaning sound was rigidly locked to specific speakers around the room. If an explosion happened on screen, the left speaker played loudly and the right speaker played quietly. The movement was crude and mechanical.
            </p>
            <p className="text-muted leading-relaxed text-lg">
              Dolby Atmos changed this by introducing "object-based audio." Instead of assigning sound to a channel, Atmos treats every sound as a moving object with real coordinates in three-dimensional space. A helicopter flying overhead is no longer just "the ceiling speaker playing" — it is a data point with X, Y, and Z coordinates that the system tries to recreate using whatever speakers are available in the room.
            </p>
            <p className="text-muted leading-relaxed text-lg">
              This was a massive leap forward. Atmos brought Hollywood-quality immersive audio to cinemas around the world and became the undisputed industry standard. Today, over 10,000 screens globally are Atmos-certified, and virtually every major blockbuster is mixed in Atmos.
            </p>
            <p className="text-muted leading-relaxed text-lg">
              It is the best spatial audio system ever built.
            </p>
            <p className="text-muted leading-relaxed text-lg">
              And it still has a fundamental, unsolvable problem.
            </p>
          </section>

          <section id="limitations" className="space-y-6">
            <h3 className="text-2xl font-bold text-foreground border-l-4 border-electric-blue pl-4">
              THE LIMITATION THAT DOLBY ATMOS CANNOT FIX
            </h3>
            <p className="text-muted leading-relaxed text-lg">
              Here is the core issue. Dolby Atmos is brilliant software running on flawed hardware.
            </p>
            <p className="text-muted leading-relaxed text-lg">
              No matter how sophisticated the object-based audio metadata is, the sound still has to come out of a physical speaker that is bolted to a fixed position on the wall. And this creates what acoustic engineers call the "Sweet Spot Problem."
            </p>
            <p className="text-muted leading-relaxed text-lg">
              To understand it, imagine a car moving from left to right across the cinema screen. In a Dolby Atmos theater, this effect is created by a process called amplitude panning — the system gradually increases the volume on the right side speakers while decreasing it on the left side speakers. For the person sitting perfectly in the center of the theater, their brain combines these two signals and perceives the sound as smoothly moving from left to right.
            </p>
            <p className="text-muted leading-relaxed text-lg">
              But here is the brutal physical truth: only the person in the exact center of the room experiences this correctly.
            </p>
            <p className="text-muted leading-relaxed text-lg">
              For a person sitting near the left wall, the left speaker is physically much closer to their ears. Sound travels at 343 meters per second. The left speaker's sound arrives at their ear milliseconds before the right speaker's sound does. The human brain has a built-in survival mechanism called the Precedence Effect — it automatically trusts the first sound that arrives and ignores the later one. This means the person near the left wall does not hear a car smoothly moving across the screen. They hear a car that stays on the left side and then suddenly jumps to the right. The smooth motion completely breaks down.
            </p>
            <p className="text-muted leading-relaxed text-lg">
              This is not a software problem. This is not a mixing problem. This is a fundamental law of physics — the Inverse Square Law — which states that sound intensity drops exponentially with distance. No software update, no DSP algorithm, and no amount of additional speakers can fully overcome this physical reality as long as the speakers themselves are fixed and stationary.
            </p>
            <p className="text-muted leading-relaxed text-lg">
              In a standard multiplex with 300 seats, perhaps 30 to 50 people sitting in the center "sweet zone" experience the full premium Dolby Atmos experience. The remaining 250 people — who paid the same premium ticket price — receive a compromised version of that experience, even though the theater spent crores installing a world-class system.
            </p>
            <p className="text-muted leading-relaxed text-lg">
              Furthermore, Dolby Atmos has a hard technical ceiling of 128 simultaneous audio objects. In a complex cinematic scene with rain, multiple characters speaking, vehicles, explosions, and ambient sounds, the system is forced to compress and combine multiple sound sources into single objects. Nuance is lost. Detail disappears. The mix that the sound engineer crafted in the studio does not fully survive the journey to the listener's ears.
            </p>
            <p className="text-muted leading-relaxed text-lg">
              And finally, every Dolby Atmos installation requires days of manual calibration by certified engineers, and every film mixed in Atmos requires extensive, expensive post-production work where sound engineers manually input spatial coordinates frame by frame for every audio object.
            </p>
            <p className="text-muted leading-relaxed text-lg">
              These are not minor inconveniences. They are structural limitations built into the very foundation of how fixed-speaker spatial audio works. And for thirteen years, the entire industry accepted them as unavoidable.
            </p>
            <p className="text-muted leading-relaxed text-lg font-bold text-foreground italic">
              Santhosh did not accept them.
            </p>
          </section>

          <section id="intro-nefron" className="space-y-6">
            <h3 className="text-2xl font-bold text-foreground border-l-4 border-electric-blue pl-4">
              INTRODUCING NEFRON AUDIO — SOUND THAT PHYSICALLY MOVES
            </h3>
            <p className="text-muted leading-relaxed text-lg">
              Nefron Audio is not an upgrade to Dolby Atmos. It is not a better version of the same idea. It is a completely different idea built on a completely different physical principle.
            </p>
            <p className="text-muted leading-relaxed text-lg">
              The insight at the heart of Nefron Audio is simple but profound:
            </p>
            <p className="text-muted leading-relaxed text-xl font-bold text-electric-blue">
              If the problem is that fixed speakers cannot follow sound objects through space, then the solution is to build speakers that are not fixed.
            </p>
            <p className="text-muted leading-relaxed text-lg">
              Every speaker in the Nefron Audio system is physically capable of rotating. Not electronically simulating rotation. Not digitally panning between channels. Actually, mechanically rotating — pointing its acoustic energy in the precise direction the sound needs to travel, in real time, following every moving object on screen.
            </p>
            <p className="text-muted leading-relaxed text-lg font-bold text-foreground">
              This single idea changes everything.
            </p>
          </section>
        </div>

        {/* Technical Specifications Section */}
        <div id="technical-specs" className="space-y-12 text-left performance-section">
          <section id="nefron-module" className="space-y-6">
            <h3 className="text-2xl font-bold text-foreground border-l-4 border-electric-blue pl-4">
              THE NEFRON MODULE — ENGINEERING A NEW KIND OF SPEAKER
            </h3>

            {/* Image Holder Section */}
            <ImageHolder 
              imageKey="main"
              title="Module Visualization"
              placeholder="Upload Module Visualization"
              alt="About Nefron"
            />

            <p className="text-muted leading-relaxed text-lg mt-6">
              The fundamental physical unit of the Nefron Audio system is called a Module. Understanding the module is the key to understanding the entire system.
            </p>
            <p className="text-muted leading-relaxed text-lg">
              Each Nefron Module is a precision-engineered acoustic panel measuring approximately 1.06 meters wide by 1.15 meters tall and 22 centimeters deep. From the outside, it appears as a sleek, uniform panel mounted flush against the theater wall. But inside, it contains a sophisticated combination of acoustic and mechanical engineering unlike anything in the current market.
            </p>
          </section>

          <section id="rotating-drivers" className="space-y-4">
            <h4 className="text-xl font-bold text-electric-blue">The Rotating Drivers</h4>
            <p className="text-muted leading-relaxed text-lg">
              At the heart of each module is a 3x3 grid of nine B&C 6CXN8 6.5-inch Coaxial Drivers, each rated at 200 watts RMS. These are not ordinary speakers; they feature a compression tweeter built into the center cone, ensuring a single acoustic center and a highly controlled directivity beam. Every driver is mounted on its own independent micro-gimbal system, driven by direct drive servo motors with absolute encoders (minimum 5Nm continuous torque) for silent, vibration-free, millimeter-perfect rotation.
            </p>
            <p className="text-muted leading-relaxed text-lg">
              The first motor controls horizontal rotation, and the second controls vertical tilt, providing a full 0 to 180-degree range of physical motion. When an audio object moves across the screen, the relevant drivers physically rotate to follow its trajectory. The acoustic energy is not a faked psychoacoustic illusion created by volume panning — it is a real, physical sound wave emitted from a speaker genuinely pointing at the listener.
            </p>
          </section>

          <section id="woofer-subwoofer" className="space-y-4">
            <h4 className="text-xl font-bold text-electric-blue">The Woofer and Subwoofer Architecture</h4>
            <p className="text-muted leading-relaxed text-lg">
              Each module is completed by high-output transducers strategically positioned above and below the rotating 3x3 grid. In the standard modules (Rows 1 and 2), dual 12-inch Neodymium Long-Excursion Woofers (18 Sound 12NLW9400) handle mid-bass frequencies. These are mounted separately to protect the rotating grid, bringing the total installed height of the module to 1.81 meters.
            </p>
            <p className="text-muted leading-relaxed text-lg">
              In the foundation row positioned closest to the floor (Row 3), the architecture incorporates a dedicated, independent 270-liter floor-coupled subwoofer enclosure housing a B&C 21DS115 21-inch Ultra Long-Excursion Subwoofer (rated at 1,700 watts AES). Placed at the exact intersection of the wall and floor for maximum boundary loading, it is capable of reproducing ultra-low-frequency content below 30Hz. This design creates physiological sensations through bone conduction and chest cavity resonance, delivering massive, tactile bass without the painful air-pressure fatigue caused by conventional subwoofers.
            </p>
            <p className="text-muted leading-relaxed text-lg">
              The total continuous audio output of a standard module is 3,100 watts RMS (requiring a dedicated 20A circuit), while a foundation module requires a 30A breaker to support its 4,300 watts RMS output.
            </p>
          </section>

          <section id="theater-layout" className="space-y-6">
            <h3 className="text-2xl font-bold text-foreground border-l-4 border-electric-blue pl-4">
              THE THEATER LAYOUT — A DOME OF INTELLIGENT SOUND
            </h3>
            <p className="text-muted leading-relaxed text-lg">
              One Nefron Module is impressive engineering. But the true power of the system emerges when you understand how hundreds of modules work together to transform an entire cinema into a unified, intelligent acoustic environment.
            </p>
          </section>

          <section id="theater-layout-viz" className="space-y-4">
            <ImageHolder 
              imageKey="theater"
              title="Theater Layout Visualization"
              placeholder="Upload Theater Layout"
              alt="Theater Layout"
            />
          </section>

          <section id="diamond-array" className="space-y-4">
            <h4 className="text-xl font-bold text-electric-blue">The Staggered Diamond Array</h4>
            <p className="text-muted leading-relaxed text-lg">
              Nefron modules are installed across all four surfaces of the cinema interior. They are never installed as a simple flat grid. Instead, they follow a precisely calculated staggered diamond pattern that eliminates every acoustic dead zone in the room. The second row of modules is horizontally offset to fill the gaps between the rows above and below, ensuring overlapping coverage.
            </p>
            <p className="text-muted leading-relaxed text-lg">
              For a 40x20 meter PLF (Premium Large Format) theater, applying the rigorous deployment formula yields exactly 268 modules across the room. The side and rear walls utilize a standard 3-row layout, while the ceiling acts as a high-density atmospheric grid housing 187 ceiling modules. This translates to an unprecedented 2,412 rotating drivers and 4,824 motor axes executing real-time spatial calculations.
            </p>
            <p className="text-muted leading-relaxed text-lg">
              By tying each of the 187 ceiling modules to a specific tracking zone, the theater is divided into an ultra-high-resolution acoustic mesh. With approximately 5.5 seats per zone, the maximum directional error for any listener falls to roughly 4.5 degrees — well below the human perception threshold of 5 degrees. Every seat hears sound from the geometrically correct direction relative to their exact physical position.
            </p>
          </section>

          <section id="music-mode-viz" className="space-y-4">
            <ImageHolder 
              imageKey="music"
              title="Music Mode Visualization"
              placeholder="Upload Music Mode Visualization"
              alt="Music Mode Visualization"
            />
          </section>

          <section id="music-mode" className="space-y-4">
            <h4 className="text-xl font-bold text-electric-blue">The Dual Rendering Architecture</h4>
            <p className="text-muted leading-relaxed text-lg">
              Unlike legacy spatial formats that apply a singular rendering algorithm to the entire audio container, Nefron Audio employs a Context-Aware Dynamic Split Rendering Engine. It intelligently switches between two discrete behavioral layers depending on what kind of sound is being reproduced: the Music Engine (Performance-Preservation Layer) and the Movie Engine (Volumetric Tracking Layer).
            </p>
            <p className="text-muted leading-relaxed text-lg">
              <strong>Mode 1: The Music Engine.</strong> The goal of Music Mode is not to make different audience zones hear different versions of the music; every listener in the entire auditorium must hear the same musical performance with perfect spectral balance. The AI runs a zero-latency blind source separation algorithm, deconstructing the track into independent instrument and vocal stems. These objects are locked to dedicated fixed regions across the wall modules (e.g., Strings mapped to the left wall, Brass to the right, Lead Vocals to the center array). Global energy diffusion is then applied so the entire auditorium hears everything identically, while preserving the exact spatial origin of each instrument.
            </p>
            <p className="text-muted leading-relaxed text-lg">
              <strong>Mode 2: The Movie Engine.</strong> For dialogue, sound effects, and discrete cinematic objects, accurate volumetric localization is prioritized. The audience is divided into structural tracking zones. As objects move across the movie scene, the robotic micro-gimbals physically steer the coaxial drivers toward the targeted zone cluster. When a car drives from left to right, the acoustic energy physically "passes" along the ceiling and wall modules, guaranteeing pinpoint tracking accuracy for every single seat.
            </p>
            <p className="text-muted leading-relaxed text-lg">
              <strong>The Hybrid Mix.</strong> During playback, the Nefron system runs both rendering engines simultaneously. The cinematic background score diffuses globally via the Music Engine, while the dialogue and Foley effects pinpoint the audience via the Movie Engine. The result is total immersion with zero structural compromise.
            </p>
          </section>

          <section id="tilt-architecture" className="space-y-4">
            <h4 className="text-xl font-bold text-electric-blue">The Tilt Architecture</h4>
            
            <ImageHolder 
              imageKey="tilt"
              title="Tilt Architecture Visualization"
              placeholder="Upload Tilt Architecture Visualization"
              alt="Tilt Architecture Visualization"
            />

            <p className="text-muted leading-relaxed text-lg">
              One additional installation detail separates Nefron from any conventional speaker placement approach. Rather than mounting modules at 90 degrees flush against the wall — which is the standard for all current cinema audio systems — Nefron modules are angled at 30 to 45 degrees inward toward the seating area.
            </p>
            <p className="text-muted leading-relaxed text-lg">
              This inward tilt solves three acoustic problems simultaneously. First, it dramatically reduces early reflections — the immediate bouncing of sound off the adjacent wall surface, which smears the clarity of dialogue and musical detail. Second, it places the majority of the audience within the on-axis dispersion window of the mid-to-high frequency drivers, ensuring every seat receives the full frequency spectrum rather than an off-axis roll-off. Third, it redistributes acoustic pressure across the seating rows, preventing the rear seats from receiving an uncomfortably loud blast from the rear wall modules.
            </p>
            <p className="text-muted leading-relaxed text-lg">
              The ceiling modules are angled 45 degrees downward toward the audience. The rear wall modules are angled 15 to 20 degrees forward. Together, this precisely calculated angular architecture creates what can best be described as a Sonic Canopy — a continuous, curved dome of acoustically active surfaces that wraps around every seat in the theater with equal intensity and clarity.
            </p>
          </section>

          <section id="features" className="space-y-6">
            <h3 className="text-2xl font-bold text-foreground border-l-4 border-electric-blue pl-4">
              SIX REVOLUTIONARY FEATURES OF NEFRON AUDIO
            </h3>
            <p className="text-muted leading-relaxed text-lg">
              Beyond the fundamental breakthrough of physical acoustic steering, the Nefron Audio platform introduces six additional capabilities that collectively define an entirely new category of cinematic audio.
            </p>
          </section>

          <section id="feature-1" className="space-y-4">
            <h4 className="text-xl font-bold text-electric-blue">Feature One — The Live Orchestra Effect</h4>
            <ImageHolder 
              imageKey="f1"
              title="Feature One Visualization"
              placeholder="Upload Feature One Visualization"
              alt="Feature One Visualization"
            />
            <p className="text-muted leading-relaxed text-lg">
              When you attend a live orchestral performance, you do not hear a wall of blended sound. You hear each instrument coming from its own distinct physical location in space. The violin section is to your left. The brass is in the center rear. The percussion is far to the right. Each sound wave reaches your ear as a separate, independent signal, and your brain processes them individually. This is why live music feels so dramatically more vivid and three-dimensional than recorded music played through conventional speakers.
            </p>
            <p className="text-muted leading-relaxed text-lg">
              The Nefron Audio system replicates this physical reality. Because every driver is independently addressable, the system's digital signal processor can isolate the individual stems of the audio mix — vocals, guitar, piano, drums, violin, brass — and route each one to a dedicated physical driver in a specific location in the room. When a drummer uses five drums in a recording session, the Nefron system can assign each of those five drums to five separate drivers in different parts of the theater. The audience does not just hear "drum sounds from the speakers." They hear five distinct drums, each physically located in a different corner of their acoustic environment, with every subtle timing and tonal difference between them preserved and spatially reproduced.
            </p>
            <p className="text-muted leading-relaxed text-lg">
              The result is a listening experience that has never existed in a cinema before — a full live-performance acoustic environment that surrounds the audience on all sides, with every instrument present as a distinct, physically localized sound source.
            </p>
          </section>

          <section id="feature-2" className="space-y-4">
            <h4 className="text-xl font-bold text-electric-blue">Feature Two — Psychoacoustic Emotional Engineering</h4>
            <ImageHolder 
              imageKey="f2"
              title="Feature Two Visualization"
              placeholder="Upload Feature Two Visualization"
              alt="Feature Two Visualization"
            />
            <p className="text-muted leading-relaxed text-lg">
              Human beings do not merely hear sound; they physically internalize it. Nefron Audio is designed to harness the extremes of the frequency spectrum to directly stimulate physiological and emotional responses.
            </p>
            <p className="text-muted leading-relaxed text-lg">
              To elicit profound terror and unease during suspense sequences, the system leverages floor-coupled subwoofers capable of reproducing ultra-low-frequency content below 30Hz. These massive wavelengths interact directly with human biology, creating physiological sensations through bone conduction and chest cavity resonance. The audience senses the atmospheric pressure drop and structural vibration before they hear anything, activating a primal instinctual response to impending danger.
            </p>
            <p className="text-muted leading-relaxed text-lg">
              Conversely, to elevate moments of heroism or awe, the system exploits the psychoacoustic parameters responsible for "frisson" — the sudden onset of goosebumps. Scientific analysis reveals that frisson correlates heavily with sudden acoustic energy expansion in the 920 Hz to 4,400 Hz range. Nefron utilizes its highly directional drivers to execute localized, dynamic bursts of mid-high frequency energy on-axis to the listeners, shocking the nervous system into a euphoric dopamine release.
            </p>
          </section>

          <section id="feature-3" className="space-y-4">
            <h4 className="text-xl font-bold text-electric-blue">Feature Three — Frequency-Optimized Bass Architecture</h4>
            <ImageHolder 
              imageKey="f3"
              title="Feature Three Visualization"
              placeholder="Upload Feature Three Visualization"
              alt="Feature Three Visualization"
            />
            <p className="text-muted leading-relaxed text-lg">
              One of the most common criticisms of high-powered cinema audio is that excessive bass creates pain — the sensation of pressure in the ears, headaches, and nausea that accompany sustained high-volume low-frequency exposure. This happens because conventional subwoofers transmit their energy primarily through air pressure, which pounds directly against the tympanic membrane.
            </p>
            <p className="text-muted leading-relaxed text-lg">
              Nefron's floor-coupled subwoofer architecture bypasses this problem entirely. By transmitting ultra-low-frequency energy (below 40 Hz) structurally through the building — through the floor, into the seating frames, and into the bodies of the audience through bone conduction — the system delivers the physical sensation of massive bass without the painful air-pressure component that causes auditory fatigue. The audience feels the bass in their chest and skeleton at any scale desired, while their ears remain protected. The experience is tactile and visceral in a way that no pneumatic speaker system can replicate, and it can be sustained for an entire three-hour film without causing discomfort.
            </p>
          </section>

          <section id="feature-4" className="space-y-4">
            <h4 className="text-xl font-bold text-electric-blue">Feature Four — Dynamic Real-Time Volume Intelligence</h4>
            <ImageHolder 
              imageKey="f4"
              title="Feature Four Visualization"
              placeholder="Upload Feature Four Visualization"
              alt="Feature Four Visualization"
            />
            <p className="text-muted leading-relaxed text-lg">
              Every piece of music has a natural emotional arc — quiet passages of tension, building layers of complexity, explosive climaxes, and moments of release. Conventional cinema audio plays a film at a single calibrated volume level, allowing the mix engineer's master recording to dictate all dynamics. This produces a technically correct but emotionally flat experience.
            </p>
            <p className="text-muted leading-relaxed text-lg">
              Nefron's AI audio engine analyzes the structure of every piece of music in real time, identifying distinct sections — a solitary vocal, a growing instrumental layer, a full orchestral peak — and dynamically adjusts the decibel output of individual driver groups to match and enhance the emotional arc of the music. A solo vocal passage might hover at a focused, intimate 77 dB from the central drivers. As instrumentation builds, peripheral drivers gradually engage, adding +2 to +3 dB per layer and physically expanding the acoustic footprint of the sound across the room. At the climax, the full array engages at 94 dB, with the ceiling modules angling downward to create a cascading waterfall of sound that envelops every seat simultaneously.
            </p>
            <p className="text-muted leading-relaxed text-lg">
              This is not volume automation in the traditional sense. This is the physical expansion and contraction of the acoustic environment itself, synchronized to the emotional heartbeat of the content.
            </p>
          </section>

          <section id="feature-5" className="space-y-4">
            <h4 className="text-xl font-bold text-electric-blue">Feature Five — Predictive Audio-Follows-Video Tracking & Phase Coherence</h4>
            <ImageHolder 
              imageKey="f5"
              title="Feature Five Visualization"
              placeholder="Upload Feature Five Visualization"
              alt="Feature Five Visualization"
            />
            <p className="text-muted leading-relaxed text-lg">
              Legacy spatial mixing workflows require sound engineers to manually enter spatial coordinates for every audio object frame-by-frame. Nefron replaces this labor-intensive process with an autonomous computer vision tracking engine that identifies characters and vehicles, mapping their trajectories across the X, Y, and Z axes.
            </p>
            <p className="text-muted leading-relaxed text-lg">
              Because real-time tracking introduces an end-to-end latency of 47-168ms (exceeding the human audio-visual synchronization threshold of 40ms), Nefron employs Predictive Offline Processing. The AI pre-computes the object paths ahead of time using the video file, generating a motor position timeline stored as a binary file. During playback, the motors execute perfectly synchronized movements with absolute zero latency. For live sporting events or concerts, the system intelligently applies a latency-compensated delay buffer to maintain pristine AV-sync.
            </p>
            <p className="text-muted leading-relaxed text-lg">
              Furthermore, to maintain pristine sound quality as drivers continuously change their physical distance and angle relative to the listeners, the Nefron OS integrates a dynamic phase-coherence delay compensation engine. This calculates microsecond digital offsets for every driver thousands of times per second, ensuring zero comb-filtering or phase cancellation.
            </p>
          </section>

          <section id="feature-6" className="space-y-4">
            <h4 className="text-xl font-bold text-electric-blue">Feature Six — Unlimited Spatial Object Mapping</h4>
            <ImageHolder 
              imageKey="f6"
              title="Feature Six Visualization"
              placeholder="Upload Feature Six Visualization"
              alt="Feature Six Visualization"
            />
            <p className="text-muted leading-relaxed text-lg">
              Dolby Atmos supports a maximum of 128 simultaneous audio objects. This limit is not arbitrary — it is a direct consequence of the physics of fixed-speaker amplitude panning. Beyond a certain number of objects, the system simply does not have enough independent speaker positions to distinguish between them, and objects begin to crowd and interfere with each other.
            </p>
            <p className="text-muted leading-relaxed text-lg">
              Nefron Audio has no such limit.
            </p>
            <p className="text-muted leading-relaxed text-lg">
              Because every driver is an independent, physically aimed sound source, the system's object capacity is defined entirely by the number of drivers installed in the theater. In a standard 268-module PLF installation, this means 2,412 simultaneously addressable, independently moving audio objects — far exceeding the capacity of Dolby Atmos — each one a real physical speaker pointing in a precisely calculated direction in three-dimensional space. A rainstorm can have hundreds of individual raindrops, each physically located in a different part of the room. A crowd scene can have dozens of simultaneous voices, each tracked to the face of the character speaking. A symphony can have every instrument in the orchestra physically present as a distinct, localized sound source surrounding the audience.
            </p>
            <p className="text-muted leading-relaxed text-lg">
              This is not a quantitative improvement on existing technology. It is a qualitative transformation of what cinema audio can be.
            </p>
          </section>

          <section id="architecture" className="space-y-6">
            <h3 className="text-2xl font-bold text-foreground border-l-4 border-electric-blue pl-4">
              SYSTEM ARCHITECTURE — THE INTELLIGENCE BEHIND THE EXPERIENCE
            </h3>
          </section>

          <section id="nefron-cortex" className="space-y-4">
            <h4 className="text-xl font-bold text-electric-blue">The Nefron Cortex & Product Tiers</h4>
            <p className="text-muted leading-relaxed text-lg">
              Controlling up to 2,412 moving drivers requires computational power far beyond a standard audio processor. The Nefron Cortex is built around Dual AMD EPYC server processors to handle pristine Dante audio routing with strict Precision Time Protocol (PTP) clocking, alongside Dual NVIDIA RTX 6000 Ada GPUs that leverage their CUDA cores to solve thousands of simultaneous trigonometric motor calculations.
            </p>
            <p className="text-muted leading-relaxed text-lg">
              Motor control commands travel via a 10 Gigabit fiber optic backbone utilizing EtherCAT — the deterministic industrial robotics protocol — guaranteeing sub-millisecond physical synchronization across the entire theater.
            </p>
            <p className="text-muted leading-relaxed text-lg">
              To match the varying budgets of cinema chains, Nefron Audio utilizes a brilliant deployment strategy built around three product tiers: Standard, Premium, and Luxury. The core technology, AI processing, and hardware remain identical across all tiers. The only variable is the structural ceiling density (the spacing gap between ceiling modules). A Standard deployment provides ~18 seats per zone, while a Luxury deployment utilizes a dense ceiling grid serving ~3 to 4 seats per zone, reducing maximum directional error to a sub-perception limit of 4.7 degrees.
            </p>
            <NefronTiersCalculator />
          </section>

          <section id="self-healing" className="space-y-4">
            <h4 className="text-xl font-bold text-electric-blue">Self-Healing Intelligence</h4>
            <p className="text-muted leading-relaxed text-lg">
              Every module in the Nefron system is individually addressable and continuously monitored. The Cortex receives real-time telemetry from every driver and every motor in the installation at all times. If a single driver fails, the system detects the fault within milliseconds, recalculates the acoustic geometry of the surrounding modules, and automatically redistributes the failed driver's audio object to its neighbors — physically rotating them to compensate for the coverage gap. The audience hears nothing. The show continues without interruption. Maintenance can be scheduled for the next service window rather than causing an emergency shutdown.
            </p>
          </section>

          <section id="auto-calibration" className="space-y-4">
            <h4 className="text-xl font-bold text-electric-blue">Auto-Calibration</h4>
            <p className="text-muted leading-relaxed text-lg">
              When a Nefron system is powered on for the first time in a new theater, it does not require days of manual calibration by specialist engineers. The Cortex automatically queries every module in the network, measures the signal travel time to each one, and uses this data combined with the known physical spacing of the modules to mathematically reconstruct a precise three-dimensional digital twin of the theater. Within minutes of first power-on, the system has mapped the entire acoustic environment and optimized the rotation angles of every driver for the specific geometry of that room.
            </p>
          </section>

          <section id="market-opportunity" className="space-y-6">
            <h3 className="text-2xl font-bold text-foreground border-l-4 border-electric-blue pl-4">
              MARKET OPPORTUNITY — THE SCALE OF THE DISRUPTION
            </h3>
            <p className="text-muted leading-relaxed text-lg">
              The global cinema audio equipment market is currently valued at approximately USD 2.8 billion and is projected to reach USD 4.6 billion by 2030, driven by the aggressive global expansion of Premium Large Format screens and the post-pandemic renaissance of the theatrical moviegoing experience.
            </p>
            <p className="text-muted leading-relaxed text-lg">
              Dolby Laboratories, the current dominant force in this market, generated revenues of approximately USD 1.3 billion in 2023, with a substantial portion derived from cinema licensing fees and hardware sales. This revenue comes not from selling superior acoustic physics, but from licensing a format that the entire film industry has standardized on — and that has remained fundamentally unchanged in its core technology since 2012.
            </p>
            <p className="text-muted leading-relaxed text-lg">
              The Indian cinema market specifically represents one of the highest-potential deployment environments in the world. India is the largest cinema market by ticket volume globally, with over 1.5 billion tickets sold annually. PVR INOX, India's largest multiplex chain with over 1,700 screens, has been aggressively investing in premium format upgrades. A single chain-wide deployment of Nefron Audio across their top 200 PLF screens would represent a hardware contract of approximately ₹500 to ₹850 Crores, entirely independent of any software licensing revenue.
            </p>
            <p className="text-muted leading-relaxed text-lg">
              Beyond traditional cinema, the Nefron platform addresses several adjacent multi-billion dollar markets: premium home theater systems for high-net-worth individuals, professional recording studios requiring the highest-fidelity playback environments, live music venue upgrades, theme park attraction audio, luxury hospitality immersive experience rooms, and military and defense simulation environments where accurate three-dimensional audio is a training requirement.
            </p>
          </section>

          <section id="investment-case" className="space-y-6">
            <h3 className="text-2xl font-bold text-foreground border-l-4 border-electric-blue pl-4">
              THE INVESTMENT CASE
            </h3>
          </section>

          <section id="capex" className="space-y-4">
            <h4 className="text-xl font-bold text-electric-blue">Capital Expenditure for Deployment</h4>
            <p className="text-muted leading-relaxed text-lg">
              Nefron Audio installations are priced on a tiered scale corresponding to theater size and module count.
            </p>
            <p className="text-muted leading-relaxed text-lg">
              A small boutique or VIP format screen (approximately 40 modules) carries a total integrated project cost of approximately ₹1.53 Crores, inclusive of hardware, the Cortex server, networking infrastructure, and installation.
            </p>
            <p className="text-muted leading-relaxed text-lg">
              A standard premium multiplex screen (approximately 80 modules) — the highest-volume market segment in India — carries a total cost of approximately ₹3.07 Crores.
            </p>
            <p className="text-muted leading-relaxed text-lg">
              A flagship PLF installation of the 40-meter class (268 modules, 2,412 drivers, 4,824 motors) carries a total project cost of approximately ₹4.25 Crores — positioning Nefron Audio at a 15 to 25 percent cost advantage over comparable Dolby Cinema or IMAX audio installations, while delivering an objectively superior and physically unreplicable acoustic experience.
            </p>
          </section>

          <section id="operating-economics" className="space-y-4">
            <h4 className="text-xl font-bold text-electric-blue">Operating Economics</h4>
            <p className="text-muted leading-relaxed text-lg">
              For a 268-module PLF theater, the installed peak electrical capacity may exceed 900kW, but average operational load stays at approximately 360kW, thanks to the AI selectively gating non-active modules. Assuming a continuous-load safety estimation of 960 kilowatt-hours per three-hour show, the operational electricity cost is approximately ₹13,000 to ₹15,000 per show. Across five daily shows, this is ~₹66,000 per day — representing just 2 to 4 percent of gross ticket revenue for a premium large-format theater. 
            </p>
            <p className="text-muted leading-relaxed text-lg">
              *Note: All numerical claims regarding component power draws, acoustic outputs, latency buffers, and deployment dimensions presented in this document act as a "Preliminary Engineering Estimate — Subject to Prototype Validation."*
            </p>
          </section>

          <section id="revenue-model" className="space-y-4">
            <h4 className="text-xl font-bold text-electric-blue">Revenue Model and Return on Investment</h4>
            <p className="text-muted leading-relaxed text-lg">
              The Nefron Audio business model operates across three parallel revenue streams.
            </p>
            <p className="text-muted leading-relaxed text-lg">
              The primary revenue stream is hardware sales — the direct sale of modular speaker systems to cinema chains, venue operators, and premium installation clients. Gross margins on hardware at scale, assuming direct manufacturing relationships with Indian component suppliers, are projected at 35 to 45 percent.
            </p>
            <p className="text-muted leading-relaxed text-lg">
              The secondary revenue stream is software licensing — a recurring annual subscription for the Nefron OS AI platform, including the Audio-Follows-Video tracking engine, the legacy content upmixing system, and the dynamic emotional audio processing features. This SaaS component transforms a one-time hardware purchase into a recurring revenue relationship with each installed client and is projected to generate annual per-theater revenues of ₹8 to ₹15 Lakhs.
            </p>
            <p className="text-muted leading-relaxed text-lg">
              The tertiary revenue stream is content royalties — as the Nefron Audio format becomes established, studios and streaming platforms producing content specifically mastered for the Nefron platform will pay a per-title licensing fee, creating a royalty income stream that scales with the growth of the installed base.
            </p>
          </section>

          <section id="seed-investment" className="space-y-4">
            <h4 className="text-xl font-bold text-electric-blue">The Seed Investment Requirement</h4>
            <p className="text-muted leading-relaxed text-lg">
              The current funding requirement is ₹25 to ₹30 Lakhs for the construction and demonstration of a fully functional single-module prototype. This prototype will physically demonstrate rotating driver actuation, real-time AI audio tracking, and the acoustic quality differential between Nefron-steered sound and conventional fixed-speaker panning — giving potential strategic partners and Series A investors a tangible, experiential proof of concept rather than a theoretical presentation.
            </p>
            <p className="text-muted leading-relaxed text-lg">
              Upon successful prototype validation, the Series A raise of ₹3 to ₹5 Crores will fund the construction of a 15-module demonstration room, the filing of core mechanical and software patents across the key markets of India, United States, and European Union, and the initiation of conversations with PVR INOX, Cinepolis India, and select international Premium Large Format operators.
            </p>
          </section>

          <section id="why-now" className="space-y-6">
            <h3 className="text-2xl font-bold text-foreground border-l-4 border-electric-blue pl-4">
              WHY THIS. WHY NOW. WHY SANTHOSH.
            </h3>
            <p className="text-muted leading-relaxed text-lg">
              The cinema industry is at an inflection point. Streaming platforms have permanently altered the casual moviegoing habit. The theaters that will survive and thrive are the ones that deliver an experience so powerful, so physical, and so irreplaceable that no home system can simulate it.
            </p>
            <p className="text-muted leading-relaxed text-lg">
              Dolby Atmos gave the industry object-based audio. That was the software revolution. Nefron Audio is the hardware revolution that completes it — the moment when the speakers themselves finally learned to move.
            </p>
            <p className="text-muted leading-relaxed text-lg">
              My name is Santhosh. I am the founder of Nefron Audio. I developed this concept from first principles, driven by a simple conviction: that the future of cinema is not louder — it is more real. That the audience in seat number one and the audience in seat number 500 both paid the same price and both deserve the same extraordinary experience.
            </p>
            <p className="text-muted leading-relaxed text-lg">
              I built Nefron Audio to deliver that promise. And I am looking for partners who believe, as I do, that the most powerful technology in the world is the kind that makes people feel something.
            </p>
            <p className="text-muted leading-relaxed text-lg">
              For investment inquiries, technical documentation, and prototype demonstration requests, please use the contact options available in this application.
            </p>
            <p className="text-muted leading-relaxed text-sm font-bold pt-4">
              © 2026 Nefron Audio. All concepts, architectural designs, and system specifications described herein are the original intellectual property of the founder and are in the process of formal patent registration.
            </p>
          </section>
        </div>

        {/* Footer Info */}
        <div className="pt-12 pb-8 text-[10px] text-muted uppercase tracking-[0.3em] font-bold">
          Nefron Audio AI &copy; 2026 • Version 2.4.0
        </div>
      </div>
    ), [
      images,
      loadingStates,
      uploadingStates,
      isAdmin,
      handleZoom
    ]);

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        id="about-page-scroll-container"
        className="h-screen flex flex-col items-center justify-start pt-24 pb-6 px-6 md:pt-28 md:pb-12 md:px-12 overflow-y-auto custom-scrollbar"
      >
        {isPageLoaded ? mainContent : (
          <div className="max-w-3xl w-full space-y-12">
            <div className="text-center space-y-6 pt-8 md:pt-12">
              <Skeleton className="w-36 h-36 md:w-48 md:h-48 mx-auto rounded-full bg-white/5" />
              <Skeleton className="h-10 w-64 mx-auto rounded bg-white/5" />
              <Skeleton className="h-px w-32 mx-auto bg-white/5" />
            </div>
            
            <div className="space-y-6">
              <Skeleton className="h-8 w-48 rounded bg-white/5" />
              <Skeleton className="h-6 w-96 rounded bg-white/5" />
              <Skeleton className="h-4 w-32 rounded bg-white/5" />
              <Skeleton className="w-full h-64 md:h-[400px] rounded-3xl bg-white/5" />
            </div>

            <div className="space-y-6">
              <Skeleton className="h-8 w-64 rounded bg-white/5" />
              <div className="space-y-3">
                <Skeleton className="h-4 w-full rounded bg-white/5" />
                <Skeleton className="h-4 w-11/12 rounded bg-white/5" />
                <Skeleton className="h-4 w-full rounded bg-white/5" />
                <Skeleton className="h-4 w-5/6 rounded bg-white/5" />
                <Skeleton className="h-4 w-full rounded bg-white/5" />
              </div>
            </div>
            
            <div className="space-y-6">
              <Skeleton className="h-8 w-72 rounded bg-white/5" />
              <div className="space-y-3">
                <Skeleton className="h-4 w-full rounded bg-white/5" />
                <Skeleton className="h-4 w-full rounded bg-white/5" />
                <Skeleton className="h-4 w-10/12 rounded bg-white/5" />
              </div>
            </div>
          </div>
        )}

        {/* Full Screen Image Overlay */}
        <FullScreenOverlay 
          src={fullScreenImage} 
          onClose={() => handleZoom(null)} 
        />
      </motion.div>
      <AboutAiGuide isPageLoaded={isPageLoaded} />
    </>
  );
}

function NefronTiersCalculator() {
  const [seats, setSeats] = React.useState(900);
  const [length, setLength] = React.useState(33);
  const [width, setWidth] = React.useState(20);
  const [height, setHeight] = React.useState(9.5);

  const W_m = 1.06;
  const G_w = 2.5;
  const P_w = W_m + G_w;

  const N_L = Math.floor((length + G_w) / P_w);
  const N_W = Math.floor((width + G_w) / P_w);

  const leftWall = Math.max(0, 3 * N_L - 1);
  const rightWall = Math.max(0, 3 * N_L - 1);
  const rearWall = Math.max(0, 3 * N_W - 1);
  const totalWalls = leftWall + rightWall + rearWall;

  const getTierData = (G_C: number, name: string) => {
    const P_C = W_m + G_C;
    const N_CL = Math.floor((length + G_C) / P_C);
    const N_CW = Math.floor((width + G_C) / P_C);
    const oddRows = Math.ceil(N_CW / 2) * N_CL;
    const evenRows = Math.floor(N_CW / 2) * (N_CL - 1);
    const ceilingModules = Math.max(0, oddRows + evenRows);
    const totalModules = totalWalls + ceilingModules;
    const zones = ceilingModules;
    const seatsPerZone = zones > 0 ? (seats / zones).toFixed(1) : '0';
    const directionError = Math.atan((P_C / 2) / height) * (180 / Math.PI);

    let errorLabel = "Basic (>10°)";
    let errorColor = "text-zinc-400 bg-zinc-500/10 border-zinc-500/20";
    if (directionError <= 5.0) {
      errorLabel = "Excellent (<5°)";
      errorColor = "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
    } else if (directionError <= 8.0) {
      errorLabel = "Good (<8°)";
      errorColor = "text-amber-400 bg-amber-500/10 border-amber-500/20";
    }

    return {
      name,
      ceilingModules,
      totalModules,
      zones,
      seatsPerZone,
      directionError: directionError.toFixed(1),
      drivers: totalModules * 9,
      motorAxes: totalModules * 18,
      errorLabel,
      errorColor
    };
  };

  const standard = getTierData(2.5, "Standard");
  const premium = getTierData(1.0, "Premium");
  const luxury = getTierData(0.5, "Luxury");

  return (
    <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-3xl p-6 md:p-8 space-y-8 my-10 shadow-[0_0_50px_rgba(0,0,0,0.8)] relative overflow-hidden text-left w-full">
      <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-electric-blue/5 rounded-full blur-[100px] pointer-events-none" />
      
      <div className="space-y-2">
        <h4 className="text-lg font-bold text-electric-blue uppercase tracking-widest flex items-center gap-2">
          <Sparkles size={18} className="animate-pulse" />
          Interactive Tier & Spacing Calculator
        </h4>
        <p className="text-sm text-zinc-300">
          Adjust the theater parameters below to see how Standard, Premium, and Luxury tiers scale mathematically and acoustically.
        </p>
      </div>

      {/* Input Controls Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-zinc-900/60 p-6 rounded-2xl border border-zinc-800/80">
        {/* Seats */}
        <div className="space-y-3">
          <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider text-gray-200">
            <span>Auditorium Seats</span>
            <span className="text-electric-blue font-mono bg-electric-blue/10 px-2.5 py-0.5 rounded border border-electric-blue/20">{seats}</span>
          </div>
          <input 
            type="range" 
            min="100" 
            max="3000" 
            step="50" 
            value={seats} 
            onChange={(e) => setSeats(Number(e.target.value))}
            className="w-full h-1 bg-zinc-850 rounded-lg cursor-pointer appearance-none accent-electric-blue"
          />
        </div>

        {/* Length */}
        <div className="space-y-3">
          <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider text-gray-200">
            <span>Theater Length (L)</span>
            <span className="text-electric-blue font-mono bg-electric-blue/10 px-2.5 py-0.5 rounded border border-electric-blue/20">{length}m</span>
          </div>
          <input 
            type="range" 
            min="10" 
            max="60" 
            step="1" 
            value={length} 
            onChange={(e) => setLength(Number(e.target.value))}
            className="w-full h-1 bg-zinc-850 rounded-lg cursor-pointer appearance-none accent-electric-blue"
          />
        </div>

        {/* Width */}
        <div className="space-y-3">
          <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider text-gray-200">
            <span>Theater Width (W)</span>
            <span className="text-electric-blue font-mono bg-electric-blue/10 px-2.5 py-0.5 rounded border border-electric-blue/20">{width}m</span>
          </div>
          <input 
            type="range" 
            min="10" 
            max="40" 
            step="1" 
            value={width} 
            onChange={(e) => setWidth(Number(e.target.value))}
            className="w-full h-1 bg-zinc-850 rounded-lg cursor-pointer appearance-none accent-electric-blue"
          />
        </div>

        {/* Height */}
        <div className="space-y-3">
          <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider text-gray-200">
            <span>Ceiling Height (h)</span>
            <span className="text-electric-blue font-mono bg-electric-blue/10 px-2.5 py-0.5 rounded border border-electric-blue/20">{height}m</span>
          </div>
          <input 
            type="range" 
            min="5" 
            max="15" 
            step="0.5" 
            value={height} 
            onChange={(e) => setHeight(Number(e.target.value))}
            className="w-full h-1 bg-zinc-850 rounded-lg cursor-pointer appearance-none accent-electric-blue"
          />
        </div>
      </div>

      {/* Comparison Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {[standard, premium, luxury].map((tier) => (
          <div 
            key={tier.name}
            className={cn(
              "p-6 rounded-2xl border transition-all duration-300 flex flex-col gap-4 relative overflow-hidden bg-zinc-950/80 backdrop-blur-sm",
              tier.name === "Luxury" 
                ? "border-amber-500/30 shadow-[0_0_30px_rgba(245,158,11,0.05)]"
                : tier.name === "Premium"
                  ? "border-electric-blue/30 shadow-[0_0_30px_rgba(0,180,216,0.05)]"
                  : "border-zinc-800 bg-zinc-950/90"
            )}
          >
            <div className="flex items-center justify-between">
              <h5 className={cn(
                "text-base font-bold",
                tier.name === "Luxury" ? "text-amber-400" : tier.name === "Premium" ? "text-electric-blue" : "text-zinc-300"
              )}>
                {tier.name}
              </h5>
              <div className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded bg-white/10 text-zinc-300">
                Tier
              </div>
            </div>

            <div className="space-y-3 pt-4">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-400">Ceiling Modules:</span>
                <span className="font-mono font-bold text-white">{tier.ceilingModules}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-400">Total Modules:</span>
                <span className="font-mono font-bold text-white">{tier.totalModules}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-400">Total Zones:</span>
                <span className="font-mono font-bold text-white">{tier.zones}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-400">Seats / Zone:</span>
                <span className="font-mono font-bold text-white">{tier.seatsPerZone}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-400">Total Drivers:</span>
                <span className="font-mono font-bold text-white">{tier.drivers}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-400">Total Motor Axes:</span>
                <span className="font-mono font-bold text-white">{tier.motorAxes}</span>
              </div>
              <div className="flex justify-between text-xs border-t border-zinc-800/50 pt-2 mt-2">
                <span className="text-zinc-300 font-bold text-electric-blue">Directional Error:</span>
                <span className={cn(
                  "font-mono font-bold",
                  tier.name === "Luxury" ? "text-emerald-400" : tier.name === "Premium" ? "text-amber-400" : "text-red-400"
                )}>
                  {tier.directionError}°
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
