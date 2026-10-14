import type { ReactNode } from 'react'

// Title row every dashboard page starts with: title, optional one-line description, actions on the right.
export default function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  back?: ReactNode
}) {
  return (
    <div className="mb-8">
      {back && <div className="mb-4">{back}</div>}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)] sm:text-[28px]">{title}</h1>
          {description && <p className="mt-1.5 max-w-[65ch] text-sm text-[var(--text-muted)]">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}
