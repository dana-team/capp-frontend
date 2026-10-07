import { createContext, useContext, type RefObject } from 'react'

/**
 * The element that scrolls page content (AppShell's <main>). Components that
 * track scroll position use this instead of querying the DOM, so they keep
 * working if the shell's scroll container changes.
 */
export const ScrollContainerContext = createContext<RefObject<HTMLElement | null> | null>(null)

export function useScrollContainer(): RefObject<HTMLElement | null> | null {
  return useContext(ScrollContainerContext)
}
