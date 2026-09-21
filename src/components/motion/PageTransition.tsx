'use client'

import { useLayoutEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

// Tab-bar order. Moving right through it slides the new page in from the right;
// moving left (or back up out of a detail page) slides it in from the left.
const SECTIONS = ['/', '/clients', '/orders', '/calendar', '/email']

function sectionIndex(path: string): number {
  if (path === '/') return 0
  const idx = SECTIONS.findIndex((s, i) => i > 0 && path.startsWith(s))
  return idx === -1 ? SECTIONS.length : idx // settings, referrals… sit to the right of everything
}
const depth = (path: string) => path.split('/').filter(Boolean).length

// Survives client-side navigations (the module stays loaded); resets on a hard reload.
let lastPath: string | null = null
let lastDirection: 'forward' | 'back' = 'forward'

function directionFor(path: string): 'forward' | 'back' {
  // Same path again = React re-running the effect (Strict Mode, re-render): keep the answer.
  if (lastPath === path) return lastDirection
  if (!lastPath) return 'forward'
  const from = sectionIndex(lastPath)
  const to = sectionIndex(path)
  if (from !== to) return to > from ? 'forward' : 'back'
  return depth(path) >= depth(lastPath) ? 'forward' : 'back'
}

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/'
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    lastDirection = directionFor(pathname)
    lastPath = pathname
    if (ref.current) ref.current.dataset.dir = lastDirection
  }, [pathname])

  return (
    <div ref={ref} className="t-page" data-testid="page-transition">
      {children}
    </div>
  )
}
