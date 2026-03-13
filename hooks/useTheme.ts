import { useState } from 'react'

type Theme = 'dark' | 'light'
const STORAGE_KEY = 'lamba-theme'

function readStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'dark'
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    // localStorage unavailable
  }
  return 'dark'
}

export function useTheme(): { theme: Theme; toggleTheme: () => void } {
  const [theme, setTheme] = useState<Theme>(readStoredTheme)

  function toggleTheme() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // localStorage unavailable — preference not persisted, visual toggle still works
    }
  }

  return { theme, toggleTheme }
}
