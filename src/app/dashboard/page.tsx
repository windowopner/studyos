'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { spotlightProps } from '@/lib/spotlight'

type SubjectBadge = {
  name: string
  color: string
} | null

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

export default function DashboardPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', user.id)
        .single()

      if (profile) setName(profile.name || '')

      const today = new Date().toISOString().split('T')[0]

      const { data: upcoming } = await supabase
        .from('assignments')
        .select('id, title, due_date, status, subjects(name, color)')
        .neq('status', 'done')
        .or(`due_date.gte.${today},due_date.is.null`)
        .order('due_date', { ascending: true })
        .limit(5)

      const { data: recentNotes } = await supabase
        .from('notes')
        .select('id, title, updated_at, subjects(name, color)')
        .order('updated_at', { ascending: false })
        .limit(5)

      setAssignments((upcoming || []) as Assignment[])
      setNotes((recentNotes || []) as Note[])
      setLoading(false)
    }

    load()
  }, [])

  const greeting = name ? `Welcome back, ${name.split(' ')[0]}` : 'Welcome back'

  const overviewStats = useMemo(() => {
    const nextDue = assignments.find((assignment) => assignment.due_date)?.due_date

    return [
      {
        label: 'Open assignments',
        value: `${assignments.length}`,
        detail: assignments.length > 0 ? 'Ready to tackle' : 'All clear right now',
      },
      {
        label: 'Fresh notes',
        value: `${notes.length}`,
        detail: notes.length > 0 ? 'Recently updated' : 'Nothing new yet',
      },
      {
        label: 'Next deadline',
        value: nextDue ? new Date(nextDue).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Flexible',
        detail: nextDue ? 'Closest due date' : 'No dated task yet',
      },
    ]
  }, [assignments, notes])

  if (loading) {
    return <div className="text-sm text-[var(--text-muted)]">Loading...</div>
  }

  return (
    <div className="mx-auto max-w-6xl">
      <section className="glass-panel rounded-[32px] px-6 py-6 sm:px-8 sm:py-8">
        <div className="flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="page-kicker">Dashboard</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl">
              {greeting}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--text-muted)] sm:text-[15px]">
              Your workspace now responds with more motion, better hierarchy, and cleaner focus — without changing how you work.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/dashboard/search"
                className="primary-button rounded-2xl px-5 py-3 text-sm font-semibold"
              >
                Explore workspace
              </Link>
              <Link
                href="/dashboard/tutor"
                className="secondary-button rounded-2xl px-5 py-3 text-sm font-medium"
              >
                Open AI Tutor
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:w-[34rem]">
            {overviewStats.map((stat) => (
              <div
                key={stat.label}
                className="interactive-card rounded-[28px] px-4 py-4"
                {...spotlightProps}
              >
                <p className="relative z-10 text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
                  {stat.label}
                </p>
                <p className="relative z-10 mt-3 text-2xl font-semibold text-[var(--text)]">
                  {stat.value}
                </p>
                <p className="relative z-10 mt-2 text-sm text-[var(--text-muted)]">
                  {stat.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="glass-panel rounded-[30px] px-5 py-5 sm:px-6 sm:py-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="section-label">Upcoming</p>
              <h2 className="mt-2 text-xl font-semibold text-[var(--text)]">Assignments on deck</h2>
            </div>
            <Link href="/dashboard/assignments" className="ghost-button text-sm font-medium">
              View all
            </Link>
          </div>

          {assignments.length === 0 ? (
            <div className="empty-card rounded-[24px] px-5 py-8 text-center">
              <p className="text-sm text-[var(--text-muted)]">No upcoming assignments right now.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {assignments.map((assignment) => (
                <Link
                  key={assignment.id}
                  href={`/dashboard/assignments/${assignment.id}`}
                  className="interactive-card block rounded-[24px] px-4 py-4"
                  {...spotlightProps}
                >
                  <div className="relative z-10 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      {assignment.subjects && (
                        <span
                          className="mb-3 inline-block rounded-full px-2.5 py-1 text-xs font-medium text-white"
                          style={{ backgroundColor: assignment.subjects.color }}
                        >
                          {assignment.subjects.name}
                        </span>
                      )}
                      <p className="text-sm font-semibold text-[var(--text)]">
                        {assignment.title}
                      </p>
                      <p className="mt-2 text-xs text-[var(--text-muted)]">
                        {assignment.due_date
                          ? `Due ${new Date(assignment.due_date).toLocaleDateString()}`
                          : 'No due date'}
                      </p>
                    </div>

                    <span className="rounded-full border border-white/10 bg-white/6 px-2.5 py-1 text-[11px] font-medium text-[var(--text-muted)]">
                      {assignment.status === 'in_progress' ? 'In progress' : 'To do'}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}

          <Link
            href="/dashboard/assignments/new"
            className="secondary-button mt-4 block rounded-[20px] px-4 py-3 text-center text-sm font-medium"
          >
            + New Assignment
          </Link>
        </section>

        <section className="glass-panel rounded-[30px] px-5 py-5 sm:px-6 sm:py-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="section-label">Recent</p>
              <h2 className="mt-2 text-xl font-semibold text-[var(--text)]">Notes you touched lately</h2>
            </div>
            <Link href="/dashboard/notes" className="ghost-button text-sm font-medium">
              View all
            </Link>
          </div>

          {notes.length === 0 ? (
            <div className="empty-card rounded-[24px] px-5 py-8 text-center">
              <p className="text-sm text-[var(--text-muted)]">No notes yet — let’s start something new.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notes.map((note) => (
                <Link
                  key={note.id}
                  href={`/dashboard/notes/${note.id}`}
                  className="interactive-card block rounded-[24px] px-4 py-4"
                  {...spotlightProps}
                >
                  <div className="relative z-10">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        {note.subjects && (
                          <span
                            className="mb-3 inline-block rounded-full px-2.5 py-1 text-xs font-medium text-white"
                            style={{ backgroundColor: note.subjects.color }}
                          >
                            {note.subjects.name}
                          </span>
                        )}
                        <p className="text-sm font-semibold text-[var(--text)]">
                          {note.title}
                        </p>
                      </div>
                      <span className="text-[11px] text-[var(--text-muted)]">
                        {new Date(note.updated_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          <Link
            href="/dashboard/notes/new"
            className="secondary-button mt-4 block rounded-[20px] px-4 py-3 text-center text-sm font-medium"
          >
            + New Note
          </Link>
        </section>
      </div>

      <Link
        href="/dashboard/tutor"
        className="interactive-card mt-6 block rounded-[30px] px-6 py-6 sm:px-8 sm:py-7"
        {...spotlightProps}
      >
        <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="page-kicker">AI Tutor</p>
            <h2 className="mt-3 text-2xl font-semibold text-[var(--text)]">Need help untangling a concept?</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
              Jump straight into the tutor with a layout that feels more focused, more conversational, and easier to scan.
            </p>
          </div>

          <div className="secondary-button rounded-2xl px-4 py-3 text-sm font-medium text-center">
            Open study chat
          </div>
        </div>
      </Link>
    </div>
  )
}
