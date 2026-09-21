'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/** transitions.dev "Success check": fade + rotate + blur + bob while the stroke draws. */
export function SuccessCheck({ show, size = 18 }: { show: boolean; size?: number }) {
  if (!show) return null
  return (
    <span className="t-success-check" data-state="in" data-testid="success-check" aria-hidden="true">
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 13l4 4L19 7" style={{ strokeDasharray: 24, strokeDashoffset: 24 }} />
      </svg>
    </span>
  )
}

/** `const [saved, flashSaved] = useSuccessFlash()` — true for a moment after flashSaved(). */
export function useSuccessFlash(ms = 1800): [boolean, () => void] {
  const [on, setOn] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flash = useCallback(() => {
    setOn(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setOn(false), ms)
  }, [ms])
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  return [on, flash]
}
