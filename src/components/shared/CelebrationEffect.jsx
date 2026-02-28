import { useEffect, useState } from 'react'

const COLORS = ['#D97757', '#D4A72C', '#788C5D', '#6A9BCC', '#C15F3C', '#E07BA0']

export default function CelebrationEffect({ trigger }) {
  const [pieces, setPieces] = useState([])

  useEffect(() => {
    if (!trigger) return

    const newPieces = Array.from({ length: 30 }, (_, i) => ({
      id: Date.now() + i,
      left: Math.random() * 100,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      delay: Math.random() * 0.5,
      size: 6 + Math.random() * 6,
      duration: 2 + Math.random() * 1,
    }))

    setPieces(newPieces)

    const timer = setTimeout(() => setPieces([]), 3500)
    return () => clearTimeout(timer)
  }, [trigger])

  if (pieces.length === 0) return null

  return (
    <>
      {pieces.map(p => (
        <div
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            backgroundColor: p.color,
            width: p.size,
            height: p.size,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </>
  )
}
