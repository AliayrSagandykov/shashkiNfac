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

  return (
    <div className="bg-[#16213e] rounded-xl border border-[#0f3460] overflow-hidden flex flex-col h-full">
      <div className="px-4 py-2 border-b border-[#0f3460] text-gray-300 text-sm font-semibold">
        {t('moves')}
      </div>
      <div className="overflow-y-auto flex-1 text-sm font-mono">
        {rows.length === 0 ? (
          <div className="text-gray-500 text-xs text-center py-4">—</div>
        ) : (
          rows.map((r) => (
            <div
              key={r.num}
              className="grid grid-cols-[2rem_1fr_1fr] gap-2 px-3 py-1 border-b border-[#0f3460]/50 last:border-0 hover:bg-[#1a2a4e]"
            >
              <span className="text-gray-500">{r.num}.</span>
              <span className="text-gray-100">{r.black ? notate(r.black) : ''}</span>
              <span className="text-gray-300">{r.white ? notate(r.white) : ''}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
