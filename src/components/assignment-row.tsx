import Link from 'next/link'
import { CaretRight } from '@phosphor-icons/react'
import { dueLabel } from '@/lib/dates'

export type AssignmentRowData = { id: string; title: string; due_date: string | null; status: string }

const statusLabel: Record<string, string> = { todo: 'To do', in_progress: 'In progress', done: 'Done' }
const statusStyle: Record<string, string> = {
  done: 'bg-[var(--success-soft)] text-[var(--success)]',
  in_progress: 'bg-[rgb(var(--accent-rgb)/0.12)] text-[var(--accent)]',
  todo: 'bg-[var(--surface-soft)] text-[var(--text-muted)]',
}

// One line in an assignment list: title, due date, status. Used inside a divide-y list.
export default function AssignmentRow({ assignment }: { assignment: AssignmentRowData }) {
  const due = dueLabel(assignment.due_date)
  const done = assignment.status === 'done'
  return (
    <Link href={`/dashboard/assignments/${assignment.id}`} className="group flex items-center gap-4 px-5 py-3.5 hover:bg-[var(--surface-hover)]">
      <span className={`min-w-0 flex-1 truncate text-sm font-medium ${done ? 'text-[var(--text-muted)] line-through' : 'text-[var(--text)]'}`}>
        {assignment.title}
      </span>
      {!done && (
        <span className={`hidden shrink-0 font-mono text-xs sm:block ${due.overdue ? 'text-[var(--danger)]' : 'text-[var(--text-muted)]'}`}>{due.text}</span>
      )}
      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${statusStyle[assignment.status] || statusStyle.todo}`}>
        {statusLabel[assignment.status] || assignment.status}
      </span>
      <CaretRight size={14} className="shrink-0 text-[var(--text-muted)] transition-transform group-hover:translate-x-0.5" />
    </Link>
  )
}
