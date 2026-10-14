// "Due today", "Due tomorrow", "Due in 3 days", "2 days overdue" for a YYYY-MM-DD date.
export function dueLabel(dueDate: string | null): { text: string; overdue: boolean; soon: boolean } {
  if (!dueDate) return { text: 'No due date', overdue: false, soon: false }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(`${dueDate}T00:00:00`)
  const days = Math.round((due.getTime() - today.getTime()) / 86400000)
  if (days < 0) return { text: `${-days} day${days === -1 ? '' : 's'} overdue`, overdue: true, soon: false }
  if (days === 0) return { text: 'Due today', overdue: false, soon: true }
  if (days === 1) return { text: 'Due tomorrow', overdue: false, soon: true }
  if (days < 7) return { text: `Due in ${days} days`, overdue: false, soon: days <= 3 }
  return { text: `Due ${due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`, overdue: false, soon: false }
}
