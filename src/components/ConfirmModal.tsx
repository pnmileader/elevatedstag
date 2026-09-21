'use client'

import { useEffect, useRef } from 'react'
import { Loader2 } from 'lucide-react'
import { useOpenClose } from '@/components/motion/useOpenClose'

type Props = {
  open: boolean
  title: string
  message: React.ReactNode
  confirmLabel: string
  cancelLabel?: string
  destructive?: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** Shared confirmation dialog (replaces window.confirm, which iOS PWAs can suppress). */
export default function ConfirmModal({ open, title, message, confirmLabel, cancelLabel = 'Cancel', destructive, busy, onConfirm, onCancel }: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const motion = useOpenClose(open, 150)

  useEffect(() => {
    if (!open) return
    cancelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onCancel() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, busy, onCancel])

  return (
    <div className="es-modal-root" data-open={motion.mounted} aria-hidden={!open}>
      <div className={`es-modal-backdrop t-modal-backdrop ${motion.stateClass === 'is-open' ? 'is-open' : ''}`} onClick={() => !busy && onCancel()} />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        data-testid="confirm-modal"
        className={`es-modal-card t-modal ${motion.stateClass}`}
      >
        <h2 id="confirm-modal-title" className="font-serif text-[17px] font-bold text-ink mb-2">{title}</h2>
        <div className="text-[14px] text-ink-secondary mb-5">{message}</div>
        <div className="flex gap-3 justify-end">
          <button ref={cancelRef} type="button" onClick={onCancel} disabled={busy} className="es-btn es-btn-secondary" data-testid="confirm-cancel">
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            data-testid="confirm-accept"
            className={`es-btn ${destructive ? 'es-btn-danger' : 'es-btn-primary'}`}
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
