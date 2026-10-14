'use client'

import { ArrowClockwise, WifiSlash } from '@phosphor-icons/react'

// Shown in place of a list when loading it failed, so a failure never looks like "you have nothing".
export default function LoadError({
  message = 'This couldn’t load. Check your connection and try again.',
  onRetry,
  className = '',
}: {
  message?: string
  onRetry?: () => void
  className?: string
}) {
  return (
    <div role="alert" className={`flex flex-col items-center rounded-2xl border border-dashed border-[var(--border-strong)] px-6 py-12 text-center ${className}`}>
      <WifiSlash size={22} className="text-[var(--text-muted)]" />
      <p className="mt-3 max-w-sm text-sm text-[var(--text-muted)]">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="secondary-button mt-4 rounded-xl px-3.5 py-1.5 text-sm font-medium">
          <ArrowClockwise size={14} />
          Try again
        </button>
      )}
    </div>
  )
}
