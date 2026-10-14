'use client'

import { useEffect } from 'react'
import { ArrowClockwise, WarningCircle } from '@phosphor-icons/react'

// What an error boundary shows: a plain explanation and a way to try again.
export default function ErrorView({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-6 py-20 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--danger-soft)] text-[var(--danger)]">
        <WarningCircle size={24} />
      </span>
      <h1 className="mt-5 text-xl font-semibold text-[var(--text)]">Something went wrong</h1>
      <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
        This page hit an unexpected error. Your saved work is safe. Try again, and if it keeps happening, reload the page.
      </p>
      {error.digest && <p className="mt-3 font-mono text-xs text-[var(--text-muted)]">Reference {error.digest}</p>}
      <button onClick={retry} className="primary-button mt-6 rounded-xl px-4 py-2 text-sm font-medium">
        <ArrowClockwise size={16} />
        Try again
      </button>
    </div>
  )
}
