import { useEffect, useRef, useState } from 'react'
import { t } from '../i18n'
import type { Player } from '../engine/rules'

export interface ChatMsg {
  from: Player | 'system'
  text: string
  ts: number
}

interface Props {
  messages: ChatMsg[]
  myColor: Player | null
  disabled?: boolean
  onSend: (text: string) => void
}

export default function ChatPanel({ messages, myColor, disabled, onSend }: Props) {
  const [text, setText] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed) return
    onSend(trimmed)
    setText('')
  }

  return (
    <div className="flex flex-col h-full bg-card2 rounded-xl border border-line2 overflow-hidden">
      <div className="px-4 py-2 border-b border-line2 text-fg2 text-sm font-semibold">
        {t('chat')}
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-1 text-sm">
        {messages.length === 0 ? (
          <div className="text-faint text-xs text-center mt-4">—</div>
        ) : (
          messages.map((m, i) => {
            const mine = m.from === myColor
            const sys = m.from === 'system'
            return (
              <div
                key={i}
                className={`leading-tight ${
                  sys
                    ? 'text-faint italic text-xs text-center'
                    : mine
                    ? 'text-blue-300'
                    : 'text-fg2'
                }`}
              >
                {!sys && (
                  <span className="text-faint text-xs mr-1">
                    {m.from === 'black' ? '●' : '○'}
                  </span>
                )}
                {m.text}
              </div>
            )
          })
        )}
      </div>
      <form onSubmit={submit} className="border-t border-line2 p-2 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={disabled}
          placeholder={t('typeMessage')}
          maxLength={200}
          className="flex-1 bg-card2 text-fg placeholder-faint text-sm py-2 px-3 rounded-lg border border-line2 focus:outline-none focus:border-blue-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={disabled || !text.trim()}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-fg px-3 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          →
        </button>
      </form>
    </div>
  )
}
