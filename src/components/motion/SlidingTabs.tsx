'use client'

import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'

export type TabItem<T extends string> = { id: T; label: string; icon?: React.ReactNode; controls?: string }

type Props<T extends string> = {
  tabs: TabItem<T>[]
  value: T
  onChange: (id: T) => void
  ariaLabel: string
  idPrefix?: string
}

/** transitions.dev "Tabs sliding": a pill that follows the active tab. */
export default function SlidingTabs<T extends string>({ tabs, value, onChange, ariaLabel, idPrefix = 'tab' }: Props<T>) {
  const barRef = useRef<HTMLDivElement>(null)
  const pillRef = useRef<HTMLSpanElement>(null)

  const placePill = useCallback(() => {
    const bar = barRef.current
    const pill = pillRef.current
    const active = bar?.querySelector<HTMLButtonElement>('[aria-selected="true"]')
    if (!bar || !pill || !active) return
    pill.style.transform = `translateX(${active.offsetLeft}px)`
    pill.style.width = `${active.offsetWidth}px`
  }, [])

  useLayoutEffect(() => {
    placePill()
    // enable the slide only after the first placement, so it doesn't fly in from x=0
    const raf = requestAnimationFrame(() => { if (pillRef.current) pillRef.current.dataset.ready = 'true' })
    return () => cancelAnimationFrame(raf)
  }, [placePill, value])

  useEffect(() => {
    const bar = barRef.current
    if (!bar || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(placePill)
    ro.observe(bar)
    return () => ro.disconnect()
  }, [placePill])

  return (
    <div ref={barRef} className="t-tabs" role="tablist" aria-label={ariaLabel}>
      <span ref={pillRef} className="t-tabs-pill" data-ready="false" data-testid="tabs-pill" aria-hidden="true" />
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          id={`${idPrefix}-${tab.id}`}
          aria-selected={value === tab.id}
          aria-controls={tab.controls}
          onClick={() => onChange(tab.id)}
          className="t-tab"
        >
          {tab.icon}
          <span className="truncate">{tab.label}</span>
        </button>
      ))}
    </div>
  )
}
