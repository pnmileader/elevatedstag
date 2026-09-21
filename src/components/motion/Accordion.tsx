'use client'

import { useId, useState } from 'react'

type Props = {
  title: React.ReactNode
  children: React.ReactNode
  defaultOpen?: boolean
  /** 'mobile' = collapsible on phones only; from tablet width up it is always open. */
  collapse?: 'always' | 'mobile'
  className?: string
  testId?: string
}

/** transitions.dev "Accordion": grid-rows height animation with a chevron flip. */
export default function Accordion({ title, children, defaultOpen = false, collapse = 'always', className, testId }: Props) {
  const [open, setOpen] = useState(defaultOpen)
  const panelId = useId()
  return (
    <div className={`t-acc ${className || ''}`} data-open={open} data-collapse={collapse} data-testid={testId}>
      <button type="button" className="t-acc-head" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((o) => !o)}>
        {title}
        <span className="t-acc-chevron text-gray-dark" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 6.5L8 10.5L12 6.5" />
          </svg>
        </span>
      </button>
      <div className="t-acc-panel" id={panelId}>
        <div className="t-acc-panel-inner">{children}</div>
      </div>
    </div>
  )
}
