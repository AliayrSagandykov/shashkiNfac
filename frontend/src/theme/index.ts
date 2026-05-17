export type Theme = 'dark' | 'light'

const STORAGE_KEY = 'theme'

function detectTheme(): Theme {
  if (typeof window !== 'undefined') {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved === 'dark' || saved === 'light') return saved
  }
  return 'dark'
}

let current: Theme = detectTheme()
const listeners = new Set<(t: Theme) => void>()

function apply(theme: Theme) {
  if (typeof document === 'undefined') return
  if (theme === 'light') document.documentElement.setAttribute('data-theme', 'light')
  else document.documentElement.removeAttribute('data-theme')
}

// Apply at module load so a refresh shows the right theme without flicker.
apply(current)

export function getTheme(): Theme {
  return current
}

export function setTheme(next: Theme): void {
  if (next === current) return
  current = next
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, next)
  }
  apply(next)
  for (const fn of listeners) fn(next)
}

export function subscribeTheme(fn: (t: Theme) => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
