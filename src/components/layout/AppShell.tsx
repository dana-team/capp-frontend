import React from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { Sidebar } from './Sidebar'

const pageVariants = {
  initial: { opacity: 0, y: 6 },
  enter:   { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -4 },
}

const pageTransition = {
  duration: 0.18,
  ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
}

export const AppShell: React.FC = () => {
  const location = useLocation()

  return (
    <div className="flex min-h-[100dvh] overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            variants={pageVariants}
            initial="initial"
            animate="enter"
            exit="exit"
            transition={pageTransition}
            className="min-h-full"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}
