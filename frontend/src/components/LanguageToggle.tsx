import { useEffect, useState } from 'react'
import { getLang, setLang, subscribeLang, type Lang } from '../i18n'

interface Props {
  /** Persist to backend / profile when set. */
  onChange?: (lang: Lang) => void | Promise<void>
  className?: string
}

export default function LanguageToggle({ onChange, className }: Props) {
  const [lang, setLangState] = useState<Lang>(getLang())

  useEffect(() => subscribeLang(setLangState), [])

  const pick = async (next: Lang) => {
    if (next === lang) return
    setLang(next)
    if (onChange) await onChange(next)
  }

  return (
    <div
      className={`inline-flex items-center gap-0.5 p-1 rounded-full bg-[#0f1e3d] border border-[#374151] text-xs ${className ?? ''}`}
    >
      {(['en', 'ru'] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => pick(l)}
          className={`px-3 py-1 rounded-full font-semibold uppercase transition-colors ${
            lang === l
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  )
}
