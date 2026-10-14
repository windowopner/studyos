'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { pickJoined, type JoinedRelation } from '@/lib/relations'
import { spotlightProps } from '@/lib/spotlight'
import { toast } from '@/components/toaster'
import PageHeader from '@/components/page-header'
import { dueLabel } from '@/lib/dates'
import { useGoogleConnected } from '@/lib/use-google'
import { requestJSON } from '@/lib/http'
import LoadError from '@/components/load-error'
import { CaretRight, DownloadSimple, Plus, Trash } from '@phosphor-icons/react'
import Modal from '@/components/modal'
import OrbitGlyph from '@/components/orbit-glyph'

type SubjectData = {
  name: string
  color: string
}

type SubjectBadge = SubjectData | null

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

type RawAssignment = Omit<Assignment, 'subjects'> & {
  subjects: JoinedRelation<SubjectData>
}

type ClassroomAssignment = {
  classroomId: string
  courseId: string
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
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
}

const priorityLabel: Record<number, string> = {
  1: 'Low',
  2: 'Medium',
  3: 'High',
}

type Filter = 'all' | 'todo' | 'in_progress' | 'done'

const filterLabel: Record<Filter, string> = {
  all: 'All',
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
}

const priorityDot: Record<number, string> = {
  1: 'bg-[var(--border-strong)]',
  2: 'bg-[var(--warn)]',
  3: 'bg-[var(--danger)]',
}

const statusStyle: Record<string, string> = {
  done: 'bg-[var(--success-soft)] text-[var(--success)]',
  in_progress: 'bg-[rgb(var(--accent-rgb)/0.12)] text-[var(--accent)]',
  todo: 'bg-[var(--surface-soft)] text-[var(--text-muted)]',
}

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)
  const [importing, setImporting] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [classroomList, setClassroomList] = useState<ClassroomAssignment[]>([])
  const [showModal, setShowModal] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  const [failed, setFailed] = useState(false)
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set())
  const googleConnected = useGoogleConnected()

  const fetchAssignments = async () => {
    const { data, error } = await supabase
      .from('assignments')
      .select('*, subjects(name, color)')
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
    if (error) return null
    return ((data || []) as RawAssignment[]).map((assignment) => ({
      ...assignment,
      subjects: pickJoined(assignment.subjects),
    }))
  }

  const reload = async () => {
    const list = await fetchAssignments()
    if (list) { setAssignments(list); setFailed(false) } else setFailed(true)
    setLoading(false)
  }

  useEffect(() => {
    let alive = true
    fetchAssignments().then((list) => {
      if (!alive) return
      if (list) setAssignments(list)
      else setFailed(true)
      setLoading(false)
    })
    return () => { alive = false }
  }, [])

  const handleClearAll = async () => {
    if (!confirm(`Delete all ${assignments.length} assignments? This cannot be undone.`)) return

    setClearing(true)
    const ids = assignments.map((assignment) => assignment.id)
    const { error } = ids.length > 0 ? await supabase.from('assignments').delete().in('id', ids) : { error: null }
    if (error) toast(error.message, 'error')
    await reload()
    setClearing(false)
  }

  const handleFetchClassroom = async () => {
    setFetching(true)
    const result = await requestJSON<{ assignments: Omit<ClassroomAssignment, 'selected' | 'isPast' | 'hasDate'>[] }>('/api/classroom')
    if (!result.ok) {
      toast(result.error, 'error')
      setFetching(false)
      return
    }

    // Anything already imported is left out, so importing twice doesn't make duplicates.
    const { data: existing } = await supabase.from('assignments').select('classroom_id').not('classroom_id', 'is', null)
    const already = new Set((existing || []).map((row) => row.classroom_id as string))
    setImportedIds(already)
    const raw = (result.data.assignments || []).filter((assignment) => !already.has(assignment.classroomId))
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
      toast('Your session ended. Sign in again.', 'error')
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
        .limit(1)
        .maybeSingle()

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
    let failedCount = 0

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
        course_id: assignment.courseId,
      })

      if (error) failedCount++
      else imported++
    }

    setImporting(false)
    setShowModal(false)
    if (failedCount > 0) toast(`Imported ${imported}; ${failedCount} could not be saved.`, 'error')
    else toast(`Imported ${imported} assignment${imported === 1 ? '' : 's'}.`, 'success')
    reload()
  }

  const upcoming = classroomList.filter((assignment) => assignment.hasDate && !assignment.isPast)
  const past = classroomList.filter((assignment) => assignment.isPast)
  const noDate = classroomList.filter((assignment) => !assignment.hasDate)

  const counts: Record<Filter, number> = {
    all: assignments.length,
    todo: assignments.filter((assignment) => assignment.status === 'todo').length,
    in_progress: assignments.filter((assignment) => assignment.status === 'in_progress').length,
    done: assignments.filter((assignment) => assignment.status === 'done').length,
  }
  const visible = filter === 'all' ? assignments : assignments.filter((assignment) => assignment.status === filter)

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Assignments"
        description="Everything you have to hand in, by due date."
        actions={
          <>
            {googleConnected && (
              <button
                onClick={handleFetchClassroom}
                disabled={fetching}
                className="secondary-button rounded-xl px-4 py-2 text-sm font-medium"
              >
                <DownloadSimple size={16} />
                {fetching ? 'Fetching…' : 'Import from Classroom'}
              </button>
            )}
            <Link href="/dashboard/assignments/new" className="primary-button rounded-xl px-4 py-2 text-sm font-medium">
              <Plus size={16} weight="bold" />
              New assignment
            </Link>
          </>
        }
      />

      <div role="tablist" aria-label="Filter by status" className="mb-4 inline-flex max-w-full overflow-x-auto rounded-xl border bg-[var(--surface)] p-1">
        {(Object.keys(filterLabel) as Filter[]).map((key) => (
          <button
            key={key}
            role="tab"
            aria-selected={filter === key}
            onClick={() => setFilter(key)}
            className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm ${
              filter === key
                ? 'bg-[var(--surface-soft)] font-medium text-[var(--text)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            {filterLabel[key]}
            <span className="ml-1.5 font-mono text-xs text-[var(--text-muted)]">{counts[key]}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((row) => <div key={row} className="skeleton h-[72px] rounded-2xl" />)}
        </div>
      ) : failed ? (
        <LoadError message="Your assignments couldn’t load. Check your connection and try again." onRetry={() => { setLoading(true); reload() }} />
      ) : visible.length === 0 ? (
        <div className="empty-card rounded-2xl px-6 py-14 text-center">
          <OrbitGlyph />
          <p className="text-sm font-medium text-[var(--text)]">
            {assignments.length === 0 ? 'No assignments yet' : `Nothing ${filterLabel[filter].toLowerCase()}`}
          </p>
          {assignments.length === 0 && (
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Add one yourself{googleConnected ? ' or import them from Google Classroom' : ''}.
            </p>
          )}
        </div>
      ) : (
        <ul className="glass-panel divide-y overflow-hidden rounded-2xl">
          {visible.map((assignment) => {
            const due = dueLabel(assignment.due_date)
            const done = assignment.status === 'done'
            return (
              <li key={assignment.id}>
                <Link
                  href={`/dashboard/assignments/${assignment.id}`}
                  className="group flex items-center gap-4 px-5 py-4 hover:bg-[var(--surface-hover)]"
                >
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${priorityDot[assignment.priority] || priorityDot[1]}`} title={`${priorityLabel[assignment.priority]} priority`} />
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm font-medium ${done ? 'text-[var(--text-muted)] line-through' : 'text-[var(--text)]'}`}>
                      {assignment.title}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-muted)]">
                      {assignment.subjects && (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: assignment.subjects.color }} />
                          {assignment.subjects.name}
                        </span>
                      )}
                      {assignment.max_points && <span>{assignment.max_points} pts</span>}
                    </div>
                  </div>
                  {!done && (
                    <span className={`hidden shrink-0 font-mono text-xs sm:block ${due.overdue ? 'text-[var(--danger)]' : 'text-[var(--text-muted)]'}`}>
                      {due.text}
                    </span>
                  )}
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${statusStyle[assignment.status]}`}>
                    {statusLabel[assignment.status]}
                  </span>
                  <CaretRight size={14} className="shrink-0 text-[var(--text-muted)] transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      {!failed && assignments.length > 0 && (
        <div className="mt-6 flex justify-end">
          <button
            onClick={handleClearAll}
            disabled={clearing}
            className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--danger)] disabled:opacity-40"
          >
            <Trash size={14} />
            {clearing ? 'Deleting…' : 'Delete all assignments'}
          </button>
        </div>
      )}

      {showModal && (
        <Modal title="Import from Classroom" description="Already-imported assignments are left out." size="lg" busy={importing} onClose={() => setShowModal(false)}>
          <div className="flex h-full max-h-[calc(85dvh-8rem)] flex-col">

            <div className="mb-4 flex flex-wrap gap-2">
              <button onClick={() => selectGroup('upcoming')} className="secondary-button rounded-full px-3 py-1.5 text-xs font-medium">Upcoming ({upcoming.length})</button>
              <button onClick={() => selectGroup('past')} className="secondary-button rounded-full px-3 py-1.5 text-xs font-medium">Past due ({past.length})</button>
              <button onClick={() => selectGroup('nodate')} className="secondary-button rounded-full px-3 py-1.5 text-xs font-medium">No date ({noDate.length})</button>
              <button onClick={() => selectGroup('all')} className="secondary-button rounded-full px-3 py-1.5 text-xs font-medium">All</button>
              <button onClick={() => selectGroup('none')} className="secondary-button rounded-full px-3 py-1.5 text-xs font-medium">None</button>
            </div>

            {classroomList.length === 0 && (
              <p className="rounded-xl bg-[var(--surface-soft)] px-4 py-6 text-center text-sm text-[var(--text-muted)]">
                {importedIds.size > 0 ? 'Everything in Classroom is already imported.' : 'No assignments found in your Classroom courses.'}
              </p>
            )}
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
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

            <div className="mt-5 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs text-[var(--text-muted)]">
                {classroomList.filter((assignment) => assignment.selected).length} selected
              </span>

              <div className="flex gap-2">
                <button onClick={() => setShowModal(false)} disabled={importing} className="secondary-button rounded-xl px-4 py-3 text-sm font-medium">
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  disabled={importing || classroomList.filter((assignment) => assignment.selected).length === 0}
                  className="primary-button rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-40"
                >
                  {importing ? 'Importing…' : 'Import'}
                </button>
              </div>
            </div>
          </div>
        </Modal>
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
      <p className={`section-label ${danger ? 'text-[var(--danger)]' : ''}`}>{title}</p>
      <div className="mt-3 space-y-3">
        {items.map((assignment) => (
          <label
            key={assignment.classroomId}
            className="interactive-card flex cursor-pointer items-start gap-3 rounded-2xl px-4 py-4"
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
                  <span className={danger ? 'text-[var(--danger)]' : ''}>
                    {danger ? 'Past due ' : 'Due '}
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
