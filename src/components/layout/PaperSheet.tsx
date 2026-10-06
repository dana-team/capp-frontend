import React from 'react'
import { motion } from 'motion/react'
import { cn } from '@/lib/utils'

const sheetVariants = {
  initial: { clipPath: 'inset(0 0 100% 0)', opacity: 0.6 },
  enter: {
    clipPath: 'inset(0 0 0% 0)',
    opacity: 1,
    transition: { duration: 0.28, ease: 'easeOut' as const },
  },
  exit: { opacity: 0, transition: { duration: 0.1, ease: 'easeIn' as const } },
}

interface PaperSheetProps {
  children: React.ReactNode
  className?: string
}

/** Page container: a sheet of paper unrolled over the painting. */
export const PaperSheet: React.FC<PaperSheetProps> = ({ children, className }) => (
  <motion.div
    variants={sheetVariants}
    initial="initial"
    animate="enter"
    exit="exit"
    className={cn(
      'mx-auto mt-[88px] mb-8 w-[calc(100%-32px)] max-w-[1200px] rounded-[3px] border border-border bg-card',
      'shadow-[0_18px_50px_-18px_hsl(var(--text)/0.35)] sm:w-[calc(100%-64px)]',
      className
    )}
  >
    {children}
  </motion.div>
)
