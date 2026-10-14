'use client'

import { useEffect, useState } from 'react'
import { CheckCircle, WarningCircle, X } from '@phosphor-icons/react'

type ToastKind = 'error' | 'success' | 'info'
type ToastItem = { id: number; message: string; kind: ToastKind }

const EVENT = 'studyos:toast'

// Short-lived message in the corner, used instead of alert(). Call from anywhere on the client.
export function toast(message: string, kind: ToastKind = 'info') {
  window.dispatchEvent(new CustomEvent<Omit<ToastItem, 'id'>>(EVENT, { detail: { message, kind } }))
}

export default function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([])

  useEffect(() => {
    let next = 0
    const onToast = (event: Event) => {
      const { message, kind } = (event as CustomEvent<Omit<ToastItem, 'id'>>).detail
      const id = ++next
      setItems((list) => [...list.slice(-2), { id, message, kind }])
      setTimeout(() => setItems((list) => list.filter((item) => item.id !== id)), kind === 'error' ? 6000 : 3500)
    }
    window.addEventListener(EVENT, onToast)
    return () => window.removeEventListener(EVENT, onToast)
  }, [])

  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">
      {items.map((item) => (
        <div
          key={item.id}
          role={item.kind === 'error' ? 'alert' : 'status'}
          className="glass-panel pointer-events-auto flex items-start gap-3 rounded-xl px-4 py-3 shadow-[var(--shadow-pop)] [animation:toast-in_240ms_var(--ease-out)]"
        >
          {item.kind === 'error' ? (
            <WarningCircle size={18} weight="fill" className="mt-0.5 shrink-0 text-[var(--danger)]" />
          ) : (
            <CheckCircle size={18} weight="fill" className="mt-0.5 shrink-0 text-[var(--success)]" />
          )}
          <p className="flex-1 text-sm text-[var(--text)]">{item.message}</p>
          <button
            onClick={() => setItems((list) => list.filter((entry) => entry.id !== item.id))}
            aria-label="Dismiss"
            className="text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
