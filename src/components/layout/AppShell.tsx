/**
 * AppShell: stage landscape + TopBar + a transparent, centred page container
 * that unrolls on route change.
 *
 * PAGE LAYOUT MODES
 *  - Legacy (default): the routed page is wrapped in a single <Sheet> so it
 *    looks like one sheet of paper over the painting.
 *  - Dashboard: the page renders directly over the painting and composes its
 *    own floating tiles / <Sheet>s. To convert a page, add its route pattern
 *    (react-router syntax, e.g. '/capps/:namespace/:name') to DASHBOARD_ROUTES
 *    below and build the page from PageHeader / StatBand / Sheet.
 */
import React from 'react'
import { Outlet, matchPath, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { TopBar } from './TopBar'
import { Sheet } from './Sheet'
import { InkLandscape } from '@/components/landscape/InkLandscape'
import { cn } from '@/lib/utils'

/** Route patterns that render as dashboard pages (no default Sheet wrapper). */
export const DASHBOARD_ROUTES: string[] = [
  '/capps',
  '/secrets',
  '/configmaps',
  '/capps/:namespace/:name',
  '/secrets/:namespace/:name',
  '/configmaps/:namespace/:name',
]

export function isDashboardRoute(pathname: string): boolean {
  return DASHBOARD_ROUTES.some((pattern) => matchPath({ path: pattern, end: true }, pathname) !== null)
}

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

const pageVariants = {
  initial: { clipPath: 'inset(0 0 100% 0)', opacity: 0.6 },
  enter: {
    clipPath: 'inset(0 0 0% 0)',
    opacity: 1,
    transition: { duration: 0.28, ease: 'easeOut' as const },
  },
  exit: { opacity: 0, transition: { duration: 0.1, ease: 'easeIn' as const } },
}

export const AppShell: React.FC = () => {
  const location = useLocation()
  const dashboard = isDashboardRoute(location.pathname)

  return (
    <div className="relative h-[100dvh] overflow-hidden bg-background">
      <InkLandscape variant="stage" station={stationForPath(location.pathname)} />
      <TopBar />
      <main className="absolute inset-0 z-[1] overflow-y-auto">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            variants={pageVariants}
            initial="initial"
            animate="enter"
            exit="exit"
            className={cn(
              'mx-auto mt-24 mb-10 w-[calc(100%-32px)] sm:w-[calc(100%-64px)]',
              dashboard ? 'max-w-[1120px]' : 'max-w-[1200px]'
            )}
          >
            {dashboard ? <Outlet /> : <Sheet><Outlet /></Sheet>}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}
