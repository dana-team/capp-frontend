import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ThemeState {
  dark: boolean;
  toggle: () => void;
}

// With nothing stored, follow the OS preference. A persisted value overrides this.
const prefersDark = (): boolean => {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      dark: prefersDark(),
      toggle: () => set((s) => ({ dark: !s.dark })),
    }),
    { name: 'capp-theme' }
  )
);
