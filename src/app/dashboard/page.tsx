'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, ChatCircleText, CheckSquare, NotePencil, Plus } from '@phosphor-icons/react'
import { supabase } from '@/lib/supabase'
import { pickJoined, type JoinedRelation } from '@/lib/relations'
import { spotlightProps } from '@/lib/spotlight'
import { dueLabel } from '@/lib/dates'
import OrbitScene from '@/components/orbit-scene'
import LoadError from '@/components/load-error'

type SubjectData = {
  name: string
  color: string
}

type SubjectBadge = SubjectData | null

type Assignment = {
  id: string
  title: string
  due_date: string | null
  status: string
  subjects: SubjectBadge
}

type Note = {
  id: string
  title: string
  updated_at: string
  subjects: SubjectBadge
}

type Todo = { id: string; title: string }

type RawAssignment = Omit<Assignment, 'subjects'> & {
  subjects: JoinedRelation<SubjectData>
}

type RawNote = Omit<Note, 'subjects'> & {
  subjects: JoinedRelation<SubjectData>
}

function greetingFor(hour: number) {
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function SubjectTag({ subject }: { subject: SubjectBadge }) {
  if (!subject) return null
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: subject.color }} />
      {subject.name}
    </span>
  )
}

export default function DashboardPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [todos, setTodos] = useState<Todo[]>([])
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!alive) return
      if (!user) { setLoading(false); return }

      const [profileRes, upcomingRes, notesRes, todosRes] = await Promise.all([
        supabase.from('profiles').select('name').eq('id', user.id).maybeSingle(),
        // Everything not done, overdue first, then by due date; undated work at the end.
        supabase
          .from('assignments')
          .select('id, title, due_date, status, subjects(name, color)')
          .neq('status', 'done')
          .order('due_date', { ascending: true, nullsFirst: false }),
        supabase
          .from('notes')
          .select('id, title, updated_at, subjects(name, color)')
          .order('updated_at', { ascending: false })
          .limit(4),
        supabase.from('todos').select('id, title').eq('done', false).order('created_at', { ascending: true }).limit(5),
      ])
      if (!alive) return

      if (upcomingRes.error || notesRes.error) {
        setFailed(true)
        setLoading(false)
        return
      }
      setName(profileRes.data?.name || (user.user_metadata?.full_name as string | undefined) || '')
      setAssignments(((upcomingRes.data || []) as RawAssignment[]).map((assignment) => ({
        ...assignment,
        subjects: pickJoined(assignment.subjects),
      })))
      setNotes(((notesRes.data || []) as RawNote[]).map((note) => ({
        ...note,
        subjects: pickJoined(note.subjects),
      })))
      setTodos(todosRes.data || [])
      setFailed(false)
      setLoading(false)
    }

    load()
    return () => { alive = false }
  }, [attempt])

  const retry = () => {
    setLoading(true)
    setFailed(false)
    setAttempt((value) => value + 1)
  }

  const firstName = name.split(' ')[0]
  const now = useMemo(() => new Date(), [])
  const today = useMemo(
    () => new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(now),
    [now]
  )

  const stats = useMemo(() => {
    const labels = assignments.map((assignment) => dueLabel(assignment.due_date))
    return {
      open: assignments.length,
      soon: labels.filter((label) => label.soon).length,
      overdue: labels.filter((label) => label.overdue).length,
    }
  }, [assignments])

  const summary = loading
    ? ' '
    : stats.open === 0
      ? 'Nothing open. A clear sky.'
      : [
          `${stats.open} assignment${stats.open === 1 ? '' : 's'} open`,
          stats.overdue > 0 ? `${stats.overdue} overdue` : null,
          stats.soon > 0 ? `${stats.soon} due in the next 3 days` : null,
        ].filter(Boolean).join(', ') + '.'

  return (
    <div>
      <section className="space-panel mb-8 grid overflow-hidden rounded-2xl md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        <div className="relative z-10 flex flex-col justify-between gap-8 p-6 sm:p-8">
          <div>
            <p className="font-mono text-xs text-[var(--text-muted)]">{today}</p>
            <h1 className="mt-3 text-[28px] font-semibold leading-tight tracking-tight sm:text-[34px]">
              {greetingFor(now.getHours())}{firstName ? `, ${firstName}` : ''}
            </h1>
            <p className="mt-2 min-h-[1.5em] text-[15px] text-[var(--text-muted)]">{summary}</p>
          </div>

          <dl className="grid max-w-sm grid-cols-3 gap-3">
            {[
              { label: 'Open', value: stats.open, tone: '' },
              { label: 'Due soon', value: stats.soon, tone: '' },
              { label: 'Overdue', value: stats.overdue, tone: stats.overdue > 0 ? 'text-[var(--danger)]' : '' },
            ].map((stat) => (
              <div key={stat.label} className="min-w-0 rounded-xl border bg-[var(--surface)] px-3 py-2.5 backdrop-blur-sm">
                <dt className="truncate text-[11px] text-[var(--text-muted)]">{stat.label}</dt>
                <dd className={`mt-0.5 font-mono text-xl font-medium ${stat.tone}`}>
                  {loading ? <span className="inline-block h-6 w-6 animate-pulse rounded bg-[var(--surface-soft)] align-middle" /> : stat.value}
                </dd>
              </div>
            ))}
          </dl>

          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/assignments/new" className="primary-button rounded-xl px-4 py-2 text-sm font-medium">
              <Plus size={16} weight="bold" />
              New assignment
            </Link>
            <Link href="/dashboard/notes/new" className="secondary-button rounded-xl px-4 py-2 text-sm font-medium">
              <NotePencil size={16} />
              New note
            </Link>
          </div>
        </div>
        <div className="relative h-[240px] md:h-auto md:min-h-[320px]">
          <OrbitScene particles={2400} planetScale={0.19} stars={90} />
        </div>
      </section>

      {failed ? (
        <LoadError message="Your dashboard couldn’t load. Check your connection and try again." onRetry={retry} />
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <section className="glass-panel rounded-2xl p-5 sm:p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold text-[var(--text)]">Up next</h2>
                <Link href="/dashboard/assignments" className="ghost-button group inline-flex items-center gap-1 text-sm">
                  All assignments
                  <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>

              {loading ? (
                <div className="space-y-2">
                  {[0, 1, 2].map((row) => <div key={row} className="skeleton h-[60px]" />)}
                </div>
              ) : assignments.length === 0 ? (
                <div className="empty-card rounded-xl px-5 py-10 text-center">
                  <p className="text-sm font-medium text-[var(--text)]">Nothing due</p>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">Add an assignment and it will show up here.</p>
                </div>
              ) : (
                <ul className="-mx-2">
                  {assignments.slice(0, 6).map((assignment) => {
                    const due = dueLabel(assignment.due_date)
                    return (
                      <li key={assignment.id}>
                        <Link
                          href={`/dashboard/assignments/${assignment.id}`}
                          className="group flex items-center justify-between gap-4 rounded-xl px-2 py-3 hover:bg-[var(--surface-hover)]"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-[var(--text)]">{assignment.title}</p>
                            <div className="mt-1 flex items-center gap-3">
                              <SubjectTag subject={assignment.subjects} />
                              {assignment.status === 'in_progress' && (
                                <span className="text-xs text-[var(--accent)]">In progress</span>
                              )}
                            </div>
                          </div>
                          <span
                            className={`shrink-0 font-mono text-xs ${
                              due.overdue ? 'text-[var(--danger)]' : due.soon ? 'text-[var(--text)]' : 'text-[var(--text-muted)]'
                            }`}
                          >
                            {due.text}
                          </span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            <div className="flex flex-col gap-6">
              <section className="glass-panel rounded-2xl p-5 sm:p-6">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-base font-semibold text-[var(--text)]">To-dos</h2>
                  <Link href="/dashboard/todo" className="ghost-button group inline-flex items-center gap-1 text-sm">
                    Open
                    <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </div>
                {loading ? (
                  <div className="space-y-2">{[0, 1].map((row) => <div key={row} className="skeleton h-5" />)}</div>
                ) : todos.length === 0 ? (
                  <p className="text-sm text-[var(--text-muted)]">Nothing on your list.</p>
                ) : (
                  <ul className="space-y-2">
                    {todos.map((todo) => (
                      <li key={todo.id} className="flex items-center gap-2.5 text-sm text-[var(--text)]">
                        <CheckSquare size={16} className="shrink-0 text-[var(--text-muted)]" />
                        <span className="truncate">{todo.title}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <Link
                href="/dashboard/tutor"
                className="interactive-card group flex items-center gap-4 rounded-2xl p-5"
                {...spotlightProps}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[rgb(var(--accent-rgb)/0.12)] text-[var(--accent)]">
                  <ChatCircleText size={20} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-[var(--text)]">Stuck on something?</span>
                  <span className="block text-sm text-[var(--text-muted)]">Ask the AI tutor about your work.</span>
                </span>
                <ArrowRight size={16} className="text-[var(--text-muted)] transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>

          <section className="mt-10">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-[var(--text)]">Recent notes</h2>
              <Link href="/dashboard/notes" className="ghost-button group inline-flex items-center gap-1 text-sm">
                All notes
                <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>

            {loading ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[0, 1, 2, 3].map((card) => <div key={card} className="skeleton h-[104px] rounded-2xl" />)}
              </div>
            ) : notes.length === 0 ? (
              <Link href="/dashboard/notes/new" className="empty-card block rounded-2xl px-5 py-8 text-center hover:border-[var(--accent)]">
                <p className="text-sm font-medium text-[var(--text)]">No notes yet</p>
                <p className="mt-1 text-sm text-[var(--text-muted)]">Write your first one.</p>
              </Link>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {notes.map((note) => (
                  <Link
                    key={note.id}
                    href={`/dashboard/notes/${note.id}`}
                    className="interactive-card flex min-h-[104px] flex-col justify-between rounded-2xl p-4"
                    {...spotlightProps}
                  >
                    <p className="line-clamp-2 text-sm font-medium text-[var(--text)]">{note.title}</p>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <SubjectTag subject={note.subjects} />
                      <span className="font-mono text-[11px] text-[var(--text-muted)]">
                        {new Date(note.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
