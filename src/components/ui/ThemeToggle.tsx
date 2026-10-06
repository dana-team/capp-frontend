import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Moon, Sun } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { useThemeStore } from '@/store/theme';

interface ThemeToggleProps {
  className?: string;
  /** Icon size in px (button is icon + 16px). Default 16. */
  size?: number;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className, size = 16 }) => {
  const dark = useThemeStore((s) => s.dark);
  const toggle = useThemeStore((s) => s.toggle);
  const reduce = useReducedMotion();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={dark ? 'Light theme' : 'Dark theme'}
      className={cn(
        'relative inline-flex items-center justify-center rounded border border-transparent text-text-secondary',
        'transition-colors duration-150 hover:border-border hover:text-text',
        className
      )}
      style={{ width: size + 16, height: size + 16 }}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={dark ? 'moon' : 'sun'}
          className="inline-flex"
          initial={reduce ? false : { opacity: 0, rotate: dark ? -60 : 60, scale: 0.7 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, rotate: dark ? 60 : -60, scale: 0.7 }}
          transition={{ duration: reduce ? 0 : 0.18, ease: 'easeOut' }}
        >
          {dark ? <Moon size={size} weight="regular" /> : <Sun size={size} weight="regular" />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
};
