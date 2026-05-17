interface Props {
  evals: number[]            // white-POV centipawns, length = ply+1
  currentPly: number         // -1 = initial position
  onSeek?: (ply: number) => void
}

const W = 800
const H = 120
const CLAMP = 1000

export default function EvalGraph({ evals, currentPly, onSeek }: Props) {
  if (evals.length === 0) return null

  const stepX = W / Math.max(1, evals.length - 1)
  const points = evals
    .map((e, i) => {
      const x = i * stepX
      const clipped = Math.max(-CLAMP, Math.min(CLAMP, e))
      const y = H / 2 - (clipped / CLAMP) * (H / 2 - 4)
      return `${x},${y}`
    })
    .join(' ')

  const fillPoints = `0,${H / 2} ${points} ${W},${H / 2}`

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!onSeek) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * W
    const idx = Math.round(x / stepX)
    onSeek(Math.max(-1, Math.min(evals.length - 2, idx - 1)))
  }

  const cursorX = (currentPly + 1) * stepX

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      onClick={handleClick}
      className="w-full h-24 bg-card2 rounded-lg cursor-pointer select-none"
      preserveAspectRatio="none"
    >
      <line x1="0" y1={H / 2} x2={W} y2={H / 2} stroke="rgb(var(--line2))" strokeWidth="1" />
      <polygon points={fillPoints} fill="rgba(59,130,246,0.25)" />
      <polyline points={points} fill="none" stroke="rgb(59 130 246)" strokeWidth="2" />
      <line
        x1={cursorX}
        y1="0"
        x2={cursorX}
        y2={H}
        stroke="rgb(250 204 21)"
        strokeWidth="2"
      />
    </svg>
  )
}
