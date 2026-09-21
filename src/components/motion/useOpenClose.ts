'use client'

import { useEffect, useState } from 'react'

type Phase = 'closed' | 'opening' | 'open' | 'closing'

/**
 * Drives the transitions.dev open/close pattern: add `.is-open` to open, swap
 * it for `.is-closing` on close, then drop it once the close duration elapses.
 * `mounted` stays true through the closing phase so the exit can play.
 */
export function useOpenClose(open: boolean, closeMs = 150) {
  const [prevOpen, setPrevOpen] = useState(open)
  const [phase, setPhase] = useState<Phase>(open ? 'open' : 'closed')

  if (open !== prevOpen) {
    setPrevOpen(open)
    setPhase(open ? 'opening' : phase === 'closed' ? 'closed' : 'closing')
  }

  useEffect(() => {
    if (phase === 'opening') {
      // one frame at the resting (pre-open) style so the transition has somewhere to start
      const raf = requestAnimationFrame(() => setPhase('open'))
      return () => cancelAnimationFrame(raf)
    }
    if (phase === 'closing') {
      const timer = setTimeout(() => setPhase('closed'), closeMs)
      return () => clearTimeout(timer)
    }
  }, [phase, closeMs])

  return {
    mounted: phase !== 'closed',
    stateClass: phase === 'open' ? 'is-open' : phase === 'closing' ? 'is-closing' : '',
  }
}
