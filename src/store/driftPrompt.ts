import { create } from 'zustand'
import type { Drift } from '@/types/drift'

interface DriftPromptState {
  drift: Drift | null
  answer: (keep: boolean) => void
}

/** The question open in DriftPrompt, if any. */
export const useDriftPrompt = create<DriftPromptState>(() => ({ drift: null, answer: () => {} }))

/**
 * Asks whether an update may keep the changes somebody made outside the console.
 * A second question cancels the first.
 */
export function askToKeepDrift(drift: Drift): Promise<boolean> {
  useDriftPrompt.getState().answer(false)
  return new Promise((resolve) => {
    useDriftPrompt.setState({
      drift,
      answer: (keep) => {
        useDriftPrompt.setState({ drift: null, answer: () => {} })
        resolve(keep)
      },
    })
  })
}
