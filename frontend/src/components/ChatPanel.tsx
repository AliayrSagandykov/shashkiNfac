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
    <div className="flex flex-col h-full bg-[#16213e] rounded-xl border border-[#0f3460] overflow-hidden">
      <div className="px-4 py-2 border-b border-[#0f3460] text-gray-300 text-sm font-semibold">
        {t('chat')}
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-1 text-sm">
        {messages.length === 0 ? (
          <div className="text-gray-500 text-xs text-center mt-4">—</div>
        ) : (
          messages.map((m, i) => {
            const mine = m.from === myColor
            const sys = m.from === 'system'
            return (
              <div
                key={i}
                className={`leading-tight ${
                  sys
                    ? 'text-gray-500 italic text-xs text-center'
                    : mine
                    ? 'text-blue-300'
                    : 'text-gray-200'
                }`}
              >
                {!sys && (
                  <span className="text-gray-500 text-xs mr-1">
                    {m.from === 'black' ? '●' : '○'}
                  </span>
                )}
                {m.text}
              </div>
            )
          })
        )}
      </div>
      <form onSubmit={submit} className="border-t border-[#0f3460] p-2 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={disabled}
          placeholder={t('typeMessage')}
          maxLength={200}
          className="flex-1 bg-[#0f3460] text-white placeholder-gray-500 text-sm py-2 px-3 rounded-lg border border-[#1a4a7a] focus:outline-none focus:border-blue-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={disabled || !text.trim()}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          →
        </button>
      </form>
    </div>
  )
}
