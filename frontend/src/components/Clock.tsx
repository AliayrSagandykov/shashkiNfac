interface Props {
  ms: number
  active: boolean
  unlimited?: boolean
}

function format(ms: number): string {
  if (!isFinite(ms)) return '∞'
  const total = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  if (ms < 10_000) {
    const tenths = Math.floor((ms % 1000) / 100)
    return `${m}:${s.toString().padStart(2, '0')}.${tenths}`
  }
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function Clock({ ms, active, unlimited }: Props) {
  const low = ms < 30_000 && !unlimited
  return (
    <div
      className={`px-4 py-2 rounded-lg font-mono text-2xl font-bold tabular-nums transition-colors ${
        active
          ? low
            ? 'bg-red-600 text-white'
            : 'bg-white text-black'
          : 'bg-[#1f2937] text-gray-400'
      }`}
    >
      {unlimited ? '∞' : format(ms)}
    </div>
  )
}
