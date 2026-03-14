'use client'

import { useState, useEffect } from 'react'

const LABELS = ['Thinking', 'Analyzing', 'Planning', 'Mapping', 'Building']
const INTERVAL_MS = 1800

export default function TypingIndicator() {
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const cycle = setInterval(() => {
      // Fade out
      setVisible(false)
      setTimeout(() => {
        setIndex(i => (i + 1) % LABELS.length)
        setVisible(true)
      }, 200)
    }, INTERVAL_MS)

    return () => clearInterval(cycle)
  }, [])

  return (
    <span
      className="inline-block text-sm text-[var(--ov-text-muted,#727272)] transition-all duration-200"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(4px)',
      }}
    >
      {LABELS[index]}…
    </span>
  )
}
