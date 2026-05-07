'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { spotlightProps } from '@/lib/spotlight'

type SubjectBadge = {
  name: string
  color: string
} | null

type Assignment = {
  id: string
  title: string
  description: string | null
  due_date: string | null
  status: string
  priority: number
  max_points: number | null
  subjects: SubjectBadge
}

type ClassroomAssignment = {
  classroomId: string
  title: string
  description: string | null
  courseName: string
  due_date: string | null
  max_points: number | null
  selected: boolean
  isPast: boolean
  hasDate: boolean
}

const statusLabel: Record<string, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Done',
}

const priorityLabel: Record<number, string> = {
  1: 'Low',
  2: 'Medium',
  3: 'High',
}

const statusStyle: Record<string, string> = {
  done: 'bg-emerald-500/10 text-emerald-400',
  in_progress: 'bg-blue-500/10 text-blue-400',
  todo: 'bg-white/5 text-[var(--text-muted)]',
}

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)
  const [importing, setImporting] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [classroomList, setClassroomList] = useState<ClassroomAssignment[]>([])
  const [showModal, setShowModal] = useState(false)

  const fetchAssignments = () => {
    supabase
      .from('assignments')
      .select('*, subjects(name, color)')
      .order('due_date', { ascending: true })
      .then(({ data }) => {
        setAssignments((data || []) as Assignment[])
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchAssignments()
  }, [])

  const handleClearAll = async () => {
    if (!confirm('Delete all assignments? This cannot be undone.')) return

    setClearing(true)
    const ids = assignments.map((assignment) => assignment.id)
    if (ids.length > 0) await supabase.from('assignments').delete().in('id', ids)
    fetchAssignments()
    setClearing(false)
  }

  const handleFetchClassroom = async () => {
    setFetching(true)
    const response = await fetch('/api/classroom')
    if (response.status === 401) {
      alert('Google Classroom access not available. Please sign out and sign in again.')
      setFetching(false)
      return
    }

    const { assignments: raw } = await response.json()
    const today = new Date().toISOString().split('T')[0]
    const list: ClassroomAssignment[] = raw.map((assignment: Omit<ClassroomAssignment, 'selected' | 'isPast' | 'hasDate'>) => {
      const hasDate = !!assignment.due_date
      const isPast = hasDate && assignment.due_date! < today
      return { ...assignment, isPast, hasDate, selected: hasDate && !isPast }
    })

    setClassroomList(list)
    setShowModal(true)
    setFetching(false)
  }

  const selectGroup = (type: 'upcoming' | 'past' | 'nodate' | 'all' | 'none') => {
    setClassroomList((previous) => previous.map((assignment) => {
      if (type === 'all') return { ...assignment, selected: true }
      if (type === 'none') return { ...assignment, selected: false }
      if (type === 'upcoming') return { ...assignment, selected: assignment.hasDate && !assignment.isPast }
      if (type === 'past') return { ...assignment, selected: assignment.isPast }
      if (type === 'nodate') return { ...assignment, selected: !assignment.hasDate }
      return assignment
    }))
  }

  const handleImport = async () => {
    const selected = classroomList.filter((assignment) => assignment.selected)
    if (selected.length === 0) return

    setImporting(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setImporting(false)
      return
    }

    const courseNames = [...new Set(selected.map((assignment) => assignment.courseName))]
    const subjectMap: Record<string, string> = {}
    const colors = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899']

    for (let index = 0; index < courseNames.length; index++) {
      const name = courseNames[index]
      const { data: existing } = await supabase
        .from('subjects')
        .select('id')
        .eq('name', name)
        .eq('profile_id', user.id)
        .single()

      if (existing) {
        subjectMap[name] = existing.id
      } else {
        const { data: created } = await supabase
          .from('subjects')
          .insert({ profile_id: user.id, name, color: colors[index % colors.length] })
          .select()
          .single()

        if (created) subjectMap[name] = created.id
      }
    }

    const today = new Date().toISOString().split('T')[0]
    let imported = 0

    for (const assignment of selected) {
      let priority = 2

      if (assignment.due_date) {
        const daysLeft = Math.ceil(
          (new Date(assignment.due_date).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24)
        )

        if (daysLeft <= 3) priority = 3
        else if (daysLeft <= 7) priority = 2
        else priority = 1
      }

      const { error } = await supabase.from('assignments').insert({
        profile_id: user.id,
        title: assignment.title,
        description: assignment.description,
        due_date: assignment.due_date,
        status: 'todo',
        priority,
        max_points: assignment.max_points,
        subject_id: subjectMap[assignment.courseName] || null,
        classroom_id: assignment.classroomId,
      })

      if (!error) imported++
    }

    setImporting(false)
    setShowModal(false)
    alert(`Imported ${imported} assignments.`)
    fetchAssignments()
  }

  const upcoming = classroomList.filter((assignment) => assignment.hasDate && !assignment.isPast)
  const past = classroomList.filter((assignment) => assignment.isPast)
  const noDate = classroomList.filter((assignment) => !assignment.hasDate)

  if (loading) {
    return <div className="text-sm text-[var(--text-muted)]">Loading...</div>
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="page-kicker">Assignments</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text)]">Deadlines with more clarity</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {assignments.length > 0 && (
            <button
              onClick={handleClearAll}
              disabled={clearing}
              className="ghost-button text-sm font-medium text-red-400 hover:text-red-300 disabled:opacity-40"
            >
              {clearing ? 'Clearing...' : 'Clear all'}
            </button>
          )}
          <button
            onClick={handleFetchClassroom}
            disabled={fetching}
            className="secondary-button rounded-2xl px-4 py-3 text-sm font-medium disabled:opacity-40"
          >
            {fetching ? 'Fetching...' : 'Import from Classroom'}
          </button>
          <Link href="/dashboard/assignments/new" className="primary-button rounded-2xl px-5 py-3 text-sm font-semibold">
            New Assignment
          </Link>
        </div>
      </div>

      {assignments.length === 0 ? (
        <div className="empty-card rounded-[28px] px-6 py-12 text-center">
          <p className="text-sm text-[var(--text-muted)]">No assignments yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {assignments.map((assignment) => (
            <Link
              key={assignment.id}
              href={`/dashboard/assignments/${assignment.id}`}
              className="interactive-card block rounded-[26px] px-5 py-5"
              {...spotlightProps}
            >
              <div className="relative z-10">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {assignment.subjects && (
                      <span
                        className="rounded-full px-2.5 py-1 text-[11px] font-medium text-white"
                        style={{ backgroundColor: assignment.subjects.color }}
                      >
                        {assignment.subjects.name}
                      </span>
                    )}
                    <span className="text-[11px] text-[var(--text-muted)]">
                      {priorityLabel[assignment.priority]} priority
                    </span>
                    {assignment.max_points && (
                      <span className="text-[11px] text-[var(--text-muted)]">{assignment.max_points} pts</span>
                    )}
                  </div>

                  <span className="text-[11px] text-[var(--text-muted)]">
                    {assignment.due_date ? `Due ${new Date(assignment.due_date).toLocaleDateString()}` : 'No due date'}
                  </span>
                </div>

                <h2 className="mt-3 text-base font-semibold text-[var(--text)]">{assignment.title}</h2>

                {assignment.description && (
                  <p className="mt-3 line-clamp-2 text-sm leading-6 text-[var(--text-muted)]">{assignment.description}</p>
                )}

                <div className="mt-4">
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${statusStyle[assignment.status]}`}>
                    {statusLabel[assignment.status]}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="glass-panel flex max-h-[82vh] w-full max-w-3xl flex-col rounded-[30px] p-6">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="page-kicker">Classroom import</p>
                <h2 className="mt-2 text-xl font-semibold text-[var(--text)]">Choose what to bring in</h2>
              </div>
              <button onClick={() => setShowModal(false)} className="ghost-button text-xl leading-none">×</button>
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              <button onClick={() => selectGroup('upcoming')} className="secondary-button rounded-full px-3 py-1.5 text-xs font-medium">Upcoming ({upcoming.length})</button>
              <button onClick={() => selectGroup('past')} className="secondary-button rounded-full px-3 py-1.5 text-xs font-medium">Past due ({past.length})</button>
              <button onClick={() => selectGroup('nodate')} className="secondary-button rounded-full px-3 py-1.5 text-xs font-medium">No date ({noDate.length})</button>
              <button onClick={() => selectGroup('all')} className="secondary-button rounded-full px-3 py-1.5 text-xs font-medium">All</button>
              <button onClick={() => selectGroup('none')} className="secondary-button rounded-full px-3 py-1.5 text-xs font-medium">None</button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto pr-1">
              <SelectionGroup
                title="Upcoming"
                items={upcoming}
                onToggle={setClassroomList}
              />
              <SelectionGroup
                title="Past due"
                items={past}
                onToggle={setClassroomList}
                danger
              />
              <SelectionGroup
                title="No due date"
                items={noDate}
                onToggle={setClassroomList}
              />
            </div>

            <div className="mt-5 flex flex-col gap-3 border-t border-[var(--border)] pt-4 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs text-[var(--text-muted)]">
                {classroomList.filter((assignment) => assignment.selected).length} selected
              </span>

              <div className="flex gap-2">
                <button onClick={() => setShowModal(false)} className="secondary-button rounded-2xl px-4 py-3 text-sm font-medium">
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  disabled={importing || classroomList.filter((assignment) => assignment.selected).length === 0}
                  className="primary-button rounded-2xl px-4 py-3 text-sm font-semibold disabled:opacity-40"
                >
                  {importing ? 'Importing...' : 'Import'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SelectionGroup({
  title,
  items,
  onToggle,
  danger = false,
}: {
  title: string
  items: ClassroomAssignment[]
  onToggle: React.Dispatch<React.SetStateAction<ClassroomAssignment[]>>
  danger?: boolean
}) {
  if (items.length === 0) return null

  return (
    <div>
      <p className={`section-label ${danger ? 'text-red-400' : ''}`}>{title}</p>
      <div className="mt-3 space-y-3">
        {items.map((assignment) => (
          <label
            key={assignment.classroomId}
            className="interactive-card flex cursor-pointer items-start gap-3 rounded-[24px] px-4 py-4"
            {...spotlightProps}
          >
            <input
              type="checkbox"
              checked={assignment.selected}
              onChange={(event) => onToggle((previous) => previous.map((item) =>
                item.classroomId === assignment.classroomId ? { ...item, selected: event.target.checked } : item
              ))}
              className="relative z-10 mt-0.5"
              style={{ accentColor: 'var(--accent)' }}
            />

            <div className="relative z-10 min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[var(--text)]">{assignment.title}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-muted)]">
                <span>{assignment.courseName}</span>
                {assignment.due_date && (
                  <span className={danger ? 'text-red-400' : ''}>
                    {danger ? 'Past due · ' : 'Due '}
                    {new Date(assignment.due_date).toLocaleDateString()}
                  </span>
                )}
                {assignment.max_points && <span>{assignment.max_points} pts</span>}
              </div>
            </div>
          </label>
        ))}
      </div>
    </div>
  )
}
