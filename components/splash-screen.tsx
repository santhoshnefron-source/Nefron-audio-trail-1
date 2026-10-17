'use client';

import { useState, useEffect } from 'react';
import { NefronLogo } from '@/components/icons';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';

import { storage } from '../lib/storage';

const itemVariants: any = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeInOut' } },
  exit: { opacity: 0, y: -20, transition: { duration: 0.5, ease: 'easeInOut' } },
};

export function SplashScreen({ onFinished }: { onFinished: () => void }) {
  const [visible, setVisible] = useState(true);
  const [step, setStep] = useState(0); // 0: Logo, 1: Name
  const [theme, setTheme] = useState<'dark' | 'light'>('light');
  const [colorTheme, setColorTheme] = useState<'purple' | 'electric' | 'golden'>('golden');

  useEffect(() => {
    const isGolden = storage.getItemString('nefron-setup-golden');
    const currentTheme = !isGolden ? 'light' : ((storage.getItemString('nefron-theme') as 'dark' | 'light') || 'light');
    const currentColorTheme = !isGolden ? 'golden' : ((storage.getItemString('nefron-color-theme') as 'purple' | 'electric' | 'golden') || 'golden');

    setTheme(currentTheme);
    setColorTheme(currentColorTheme);

    // Apply to document element for consistent styling during splash
    if (currentTheme === 'light') {
      document.documentElement.classList.add('light');
      document.body.style.backgroundColor = currentColorTheme === 'golden' ? '#FAF6EE' : '#F1F5F9';
    } else {
      document.documentElement.classList.remove('light');
      document.body.style.backgroundColor = currentColorTheme === 'golden' ? '#0F0E0C' : '#0B0C10';
    }
    document.documentElement.setAttribute('data-color-theme', currentColorTheme);

    // Step 0: Logo draws (0-3.5s) then stays for 0.5s (Total 4s)
    const nameTimer = setTimeout(() => {
      setStep(1);
    }, 4000);

    // Step 1: Name shows for 3s then splash finishes (Total 7s)
    const finishTimer = setTimeout(() => {
      setVisible(false);
      // Wait for the exit animation (0.8s) to complete before notifying the parent
      setTimeout(() => {
        onFinished();
      }, 800);
    }, 7000);

    return () => {
      clearTimeout(nameTimer);
      clearTimeout(finishTimer);
    };
  }, [onFinished]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          exit={{ opacity: 0, transition: { duration: 0.8 } }}
          className={cn(
            'fixed inset-0 z-[101] flex flex-col items-center justify-center bg-black-deep dark:bg-black-deep light:bg-slate-50 text-cyan-bright transition-colors duration-300',
            theme === 'light' && 'light'
          )}
        >
          {/* Themed background glow for splash */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[var(--logo-gradient-end)]/10 pointer-events-none" />
          
          <AnimatePresence mode="wait">
            {step === 0 ? (
              <motion.div
                key="logo-step"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.8 } }}
                className="flex items-center justify-center"
              >
                <NefronLogo className="w-40 h-40" strokeWidth="1" />
              </motion.div>
            ) : (
              <motion.div
                key="name-step"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10, transition: { duration: 0.8 } }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="text-center"
              >
                <h1 className="text-5xl font-headline font-light tracking-[0.25em] mr-[-0.25em] bg-gradient-to-r from-[var(--logo-gradient-start)] via-[var(--logo-gradient-mid)] to-[var(--logo-gradient-end)] bg-clip-text text-transparent neon-glow">
                  NEFRON AUDIO
                </h1>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
