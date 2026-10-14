'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, ChatCircleText, NotePencil, Plus } from '@phosphor-icons/react'
import { supabase } from '@/lib/supabase'
import { pickJoined, type JoinedRelation } from '@/lib/relations'
import { spotlightProps } from '@/lib/spotlight'
import { dueLabel } from '@/lib/dates'

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
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [{ data: profile }, { data: upcoming }, { data: recentNotes }] = await Promise.all([
        supabase.from('profiles').select('name').eq('id', user.id).single(),
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
      ])

      if (profile) setName(profile.name || '')
      setAssignments(((upcoming || []) as RawAssignment[]).map((assignment) => ({
        ...assignment,
        subjects: pickJoined(assignment.subjects),
      })))
      setNotes(((recentNotes || []) as RawNote[]).map((note) => ({
        ...note,
        subjects: pickJoined(note.subjects),
      })))
      setLoading(false)
    }

    load()
  }, [])

  const firstName = name.split(' ')[0]
  const today = useMemo(
    () => new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date()),
    []
  )

  const stats = useMemo(() => {
    const labels = assignments.map((assignment) => dueLabel(assignment.due_date))
    return [
      { label: 'Open', value: assignments.length },
      { label: 'Due in 3 days', value: labels.filter((label) => label.soon).length },
      { label: 'Overdue', value: labels.filter((label) => label.overdue).length, alert: true },
    ]
  }, [assignments])

  return (
    <div>
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs text-[var(--text-muted)]">{today}</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text)] sm:text-[28px]">
            {greetingFor(new Date().getHours())}{firstName ? `, ${firstName}` : ''}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/notes/new" className="secondary-button rounded-xl px-4 py-2 text-sm font-medium">
            <NotePencil size={16} />
            New note
          </Link>
          <Link href="/dashboard/assignments/new" className="primary-button rounded-xl px-4 py-2 text-sm font-medium">
            <Plus size={16} weight="bold" />
            New assignment
          </Link>
        </div>
      </div>

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
            <h2 className="text-base font-semibold text-[var(--text)]">At a glance</h2>
            <dl className="mt-4 grid grid-cols-3 gap-4">
              {stats.map((stat) => (
                <div key={stat.label}>
                  <dt className="text-xs text-[var(--text-muted)]">{stat.label}</dt>
                  <dd
                    className={`mt-1 font-mono text-2xl font-medium ${
                      stat.alert && stat.value > 0 ? 'text-[var(--danger)]' : 'text-[var(--text)]'
                    }`}
                  >
                    {loading ? <span className="skeleton inline-block h-7 w-8 align-middle" /> : stat.value}
                  </dd>
                </div>
              ))}
            </dl>
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
    </div>
  )
}
