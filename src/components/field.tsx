import type { ReactNode } from 'react'

// Label above the control, optional hint below. Shared by every form.
export default function Field({
  label,
  htmlFor,
  hint,
  children,
  className = '',
}: {
  label: string
  htmlFor: string
  hint?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-[var(--text)]">{label}</label>
      {children}
      {hint && <p className="text-xs text-[var(--text-muted)]">{hint}</p>}
    </div>
  )
}

export const inputClass = 'field-input w-full rounded-xl px-3.5 py-2.5 text-sm'
