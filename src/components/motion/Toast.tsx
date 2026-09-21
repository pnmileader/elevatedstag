'use client'

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2 } from 'lucide-react'

type ToastKind = 'success' | 'error'
type ToastItem = { id: number; kind: ToastKind; text: string; open: boolean }
type ToastApi = { success: (text: string) => void; error: (text: string) => void }

const ToastContext = createContext<ToastApi | null>(null)

const VISIBLE_MS = 3200
const CLOSE_MS = 250 // --toast-close

/** transitions.dev "Toast open/close": rises from the bottom with fade, scale and cross-blur. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  const push = useCallback((kind: ToastKind, text: string) => {
    const id = nextId.current++
    setToasts((prev) => [...prev.slice(-2), { id, kind, text, open: false }])
    const setOpen = (open: boolean) => setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, open } : t)))
    // mount closed, open on the next frame so the transition runs
    requestAnimationFrame(() => requestAnimationFrame(() => setOpen(true)))
    setTimeout(() => setOpen(false), VISIBLE_MS)
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), VISIBLE_MS + CLOSE_MS)
  }, [])

  const api = useMemo<ToastApi>(() => ({
    success: (text) => push('success', text),
    error: (text) => push('error', text),
  }), [push])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="es-toast-region" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => (
          <div key={t.id} role="status" data-testid="toast" data-kind={t.kind} className={`es-toast t-toast ${t.open ? 'is-open' : ''}`}>
            {t.kind === 'success' ? <CheckCircle2 className="w-5 h-5 es-toast-icon" /> : <AlertCircle className="w-5 h-5 es-toast-icon" />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

const NOOP: ToastApi = { success: () => {}, error: () => {} }

export function useToast(): ToastApi {
  return useContext(ToastContext) ?? NOOP
}
