import React from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'motion/react'
import { TopBar } from './TopBar'
import { PaperSheet } from './PaperSheet'
import { InkLandscape } from '@/components/landscape/InkLandscape'

/** Where along the scroll painting a route sits (0..1). */
export function stationForPath(pathname: string): number {
  const base = pathname.startsWith('/secrets') ? 0.45
    : pathname.startsWith('/configmaps') ? 0.9
    : 0
  const segments = pathname.split('/').filter(Boolean)
  let offset = 0
  if (segments.length >= 2) {
    const last = segments[segments.length - 1]
    if (last === 'new' || last === 'edit') offset = 0.08
    else if (segments.length >= 3) offset = 0.05
  }
  return Math.min(1, Math.max(0, base + offset))
}

export const AppShell: React.FC = () => {
  const location = useLocation()

  return (
    <div className="relative h-[100dvh] overflow-hidden bg-background">
      <InkLandscape variant="stage" station={stationForPath(location.pathname)} />
      <TopBar />
      <main className="absolute inset-0 z-[1] overflow-y-auto">
        <AnimatePresence mode="wait" initial={false}>
          <PaperSheet key={location.pathname}>
            <Outlet />
          </PaperSheet>
        </AnimatePresence>
      </main>
    </div>
  )
}
