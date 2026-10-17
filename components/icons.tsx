import type { SVGProps } from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

export function CometIcon({ className }: { className?: string }) {
  return (
    <div className={cn("relative flex items-center justify-center w-8 h-8", className)}>
        {/* Spark Star Shape (Outline) with Breathing Effect */}
        <div className="relative">
            <motion.svg 
                viewBox="0 0 24 24" 
                className="w-3.5 h-3.5 text-cyan-glow z-10 fill-none stroke-cyan-glow" 
                style={{ strokeWidth: 2.5 }}
                animate={{ 
                  scale: [1, 1.15, 1], 
                  opacity: [0.7, 1, 0.7],
                  filter: ["drop-shadow(0 0 0px var(--color-cyan-glow))", "drop-shadow(0 0 4px var(--color-cyan-glow))", "drop-shadow(0 0 0px var(--color-cyan-glow))"]
                } as any}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            >
                <path d="M12 0l2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5L12 0z" />
            </motion.svg>
            
            {/* Ambient Star Sparkles */}
            {[0, 72, 144, 216, 288].map((deg) => (
                <motion.div
                    key={deg}
                    className="absolute top-1/2 left-1/2 w-0.5 h-0.5 bg-cyan-glow rounded-full"
                    animate={{ 
                        scale: [0, 1.8, 0],
                        opacity: [0, 0.8, 0],
                        x: [0, Math.cos(deg * Math.PI / 180) * 12],
                        y: [0, Math.sin(deg * Math.PI / 180) * 12]
                    }}
                    transition={{ 
                        duration: 0.8 + Math.random() * 0.4, 
                        repeat: Infinity, 
                        delay: Math.random() * 2,
                        ease: "easeOut"
                    }}
                />
            ))}
        </div>

        {/* Orbit Container */}
        <motion.div
            className="absolute flex justify-center items-start w-8 h-8"
            animate={{ rotate: 360 }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
        >
            {/* Tapered Orbit Tail */}
            <svg 
              className="absolute inset-0 w-8 h-8 pointer-events-none z-10" 
              viewBox="0 0 32 32"
            >
              <defs>
                <linearGradient id="tailFade" x1="0%" y1="100%" x2="50%" y2="0%">
                  <stop offset="0%" stopColor="transparent" />
                  <stop offset="20%" stopColor="transparent" />
                  <stop offset="100%" stopColor="white" />
                </linearGradient>
                <mask id="tailMask">
                  <rect width="32" height="32" fill="url(#tailFade)" />
                </mask>
              </defs>
              <motion.path 
                d="M 16 1.0 A 15 15 0 0 0 5.0 26.3 A 0.8 0.8 0 0 0 6.5 25.5 A 13.5 13.5 0 0 1 16 3.4 Z" 
                className="fill-electric-green"
                mask="url(#tailMask)"
                animate={{ opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              />
            </svg>

            <div className="relative z-20 mt-[0.5px]">
                {/* Floating Comet Head */}
                <motion.div 
                    className="w-[3px] h-[3px] bg-electric-green rounded-full shadow-[0_0_8px_var(--color-electric-green)]"
                    animate={{ scale: [1, 1.3, 1], opacity: [0.8, 1, 0.8] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                />
                
                {/* Trailing Micro-Sparkles */}
                {[1, 2, 3].map((i) => (
                  <motion.div
                      key={i}
                      className="absolute top-0 left-0 w-px h-px bg-electric-green rounded-full opacity-60"
                      animate={{ 
                        opacity: [0, 1, 0], 
                        scale: [0, 1.5, 0],
                        x: [-4 * i, -12 * i],
                        y: [-1, 1 * i]
                      }}
                      transition={{ 
                        duration: 0.5, 
                        repeat: Infinity, 
                        delay: i * 0.15 
                      }}
                  />
                ))}
            </div>
        </motion.div>
    </div>
  );
}

const svgVariants: any = {
  hidden: { opacity: 0, scale: 0 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.5,
      ease: 'easeInOut',
      when: 'beforeChildren',
      staggerChildren: 0.5,
    },
  },
};

const pathVariants: any = {
  hidden: {
    pathLength: 0,
  },
  visible: {
    pathLength: 1,
    transition: {
      duration: 2,
      ease: 'easeInOut',
    },
  },
};

export function NefronLogo(props: SVGProps<SVGSVGElement> & { isThinking?: boolean }) {
  const { isThinking, className, ...svgProps } = props;
  const MotionSvg = motion.svg as any;
  const MotionPath = motion.path as any;
  
  const svgElement = (
    <MotionSvg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="url(#nefron-splash-gradient)"
      strokeWidth={props.strokeWidth || "1.5"}
      strokeLinecap="round"
      strokeLinejoin="round"
      variants={svgVariants}
      initial="hidden"
      animate="visible"
      className={cn("neon-glow", className)}
      {...svgProps}
    >
      <defs>
        <linearGradient
          id="nefron-splash-gradient"
          x1="0%"
          y1="0%"
          x2="100%"
          y2="100%"
        >
          <stop offset="0%" stopColor="var(--logo-gradient-start)" />
          <stop offset="50%" stopColor="var(--logo-gradient-mid)" />
          <stop offset="100%" stopColor="var(--logo-gradient-end)" />
        </linearGradient>
      </defs>
      <MotionPath variants={pathVariants} d="M8.34,3.49l7.32,17.02" />
      <MotionPath variants={pathVariants} d="M8.34,3.49C2.4,10.15,2.4,13.85,8.34,20.51" />
      <MotionPath variants={pathVariants} d="M15.66,3.49c5.94,6.66,5.94,10.36,0,17.02" />
    </MotionSvg>
  );

  if (isThinking) {
    return (
      <motion.div
        animate={{
          scale: [1, 1.1, 1],
          rotate: [0, 2, -2, 0],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="flex items-center justify-center w-full h-full"
      >
        {svgElement}
      </motion.div>
    );
  }

  return svgElement;
}
