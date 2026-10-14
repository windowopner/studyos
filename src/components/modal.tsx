'use client'

import { useEffect, useRef, type ReactNode } from 'react'

// A centered dialog over a dimmed backdrop. Escape or a click outside closes it (unless `busy`),
// focus moves inside when it opens and back to where it was when it closes, and the page
// behind doesn't scroll.
export default function Modal({
  title,
  description,
  onClose,
  busy = false,
  size = 'sm',
  children,
}: {
  title: ReactNode
  description?: ReactNode
  onClose: () => void
  busy?: boolean
  size?: 'sm' | 'md' | 'lg'
  children: ReactNode
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  const busyRef = useRef(busy)
  useEffect(() => {
    closeRef.current = onClose
    busyRef.current = busy
  })

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    const focusable = panel?.querySelector<HTMLElement>('[autofocus], input, textarea, select, button:not([disabled])')
    focusable?.focus()

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busyRef.current) closeRef.current()
    }
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      previous?.focus?.()
    }
  }, [])

  const width = size === 'lg' ? 'max-w-3xl' : size === 'md' ? 'max-w-md' : 'max-w-sm'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 backdrop-blur-[3px] [animation:fade-in_160ms_ease]"
      onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose() }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        className={`dialog-panel flex max-h-[85dvh] w-full ${width} flex-col rounded-2xl p-6 [animation:toast-in_220ms_var(--ease-out)]`}
      >
        <h2 className="text-lg font-semibold text-[var(--text)]">{title}</h2>
        {description && <p className="mt-1 text-sm text-[var(--text-muted)]">{description}</p>}
        <div className="mt-5 min-h-0 flex-1">{children}</div>
      </div>
    </div>
  )
}
