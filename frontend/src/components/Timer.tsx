import { useState, useEffect } from 'react'

interface Props {
  active: boolean
  initialSeconds?: number
  onExpire?: () => void
}

export default function Timer({ active, initialSeconds = 600, onExpire }: Props) {
  const [seconds, setSeconds] = useState(initialSeconds)

  useEffect(() => {
    if (!active) return
    if (seconds <= 0) {
      onExpire?.()
      return
    }
    const id = setInterval(() => setSeconds((s) => s - 1), 1000)
    return () => clearInterval(id)
  }, [active, seconds, onExpire])

  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  const isLow = seconds < 30

  return (
    <span className={`font-mono font-bold ${isLow ? 'text-red-400' : 'text-white'}`}>
      {m}:{s.toString().padStart(2, '0')}
    </span>
  )
}
