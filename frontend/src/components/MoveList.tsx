import { useEffect, useRef } from 'react'
import { t } from '../i18n'
import type { Move } from '../engine/rules'

function notate(move: Move): string {
  const col = (c: number) => String.fromCharCode(97 + c)
  const from = `${col(move.from[1])}${10 - move.from[0]}`
  const to = `${col(move.to[1])}${10 - move.to[0]}`
  const sep = move.captures.length > 0 ? 'x' : '-'
  return `${from}${sep}${to}`
}

export default function MoveList({ moves }: { moves: Move[] }) {
  const rows: { num: number; black?: Move; white?: Move }[] = []
  for (let i = 0; i < moves.length; i++) {
    if (i % 2 === 0) rows.push({ num: i / 2 + 1, black: moves[i] })
    else rows[rows.length - 1].white = moves[i]
  }

  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [moves.length])

  return (
    <div className="bg-card2 rounded-xl border border-line2 overflow-hidden flex flex-col h-full">
      <div className="px-4 py-2 border-b border-line2 text-fg2 text-sm font-semibold">
        {t('moves')}
      </div>
      <div ref={scrollRef} className="overflow-y-auto flex-1 text-sm font-mono">
        {rows.length === 0 ? (
          <div className="text-faint text-xs text-center py-4">—</div>
        ) : (
          rows.map((r) => (
            <div
              key={r.num}
              className="grid grid-cols-[2rem_1fr_1fr] gap-2 px-3 py-1 border-b border-line2/50 last:border-0 hover:bg-hover"
            >
              <span className="text-faint">{r.num}.</span>
              <span className="text-fg">{r.black ? notate(r.black) : ''}</span>
              <span className="text-fg2">{r.white ? notate(r.white) : ''}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
