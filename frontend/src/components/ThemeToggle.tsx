import { useEffect, useState } from 'react'
import { getTheme, setTheme, subscribeTheme, type Theme } from '../theme'

interface Props {
  onChange?: (theme: Theme) => void | Promise<void>
  className?: string
}

export default function ThemeToggle({ onChange, className }: Props) {
  const [theme, setThemeState] = useState<Theme>(getTheme())

  useEffect(() => subscribeTheme(setThemeState), [])

  const toggle = async () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    if (onChange) await onChange(next)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle theme"
      className={`w-9 h-9 rounded-full bg-field border border-line text-fg hover:bg-hover transition-colors flex items-center justify-center text-base ${className ?? ''}`}
    >
      {theme === 'dark' ? '☀' : '☾'}
    </button>
  )
}
