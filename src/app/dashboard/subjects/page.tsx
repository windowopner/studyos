'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowSquareOut, Plus, Trash } from '@phosphor-icons/react'
import { supabase } from '@/lib/supabase'
import { spotlightProps } from '@/lib/spotlight'
import { useGoogleConnected } from '@/lib/use-google'
import { SUBJECT_COLORS } from '@/lib/subjects'
import PageHeader from '@/components/page-header'
import { toast } from '@/components/toaster'

type Subject = {
  id: string
  name: string
  color: string
  assignments: { count: number }[]
  notes: { count: number }[]
}

type Course = {
  id: string
  name: string
  section: string | null
}

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [color, setColor] = useState(SUBJECT_COLORS[0])
  const [adding, setAdding] = useState(false)
  const [courses, setCourses] = useState<Course[] | null>(null)
  const googleConnected = useGoogleConnected()

  const fetchSubjects = async () => {
    const { data } = await supabase
      .from('subjects')
      .select('id, name, color, assignments(count), notes(count)')
      .order('name')
    return (data || []) as Subject[]
  }

  const load = () => fetchSubjects().then((list) => { setSubjects(list); setLoading(false) })

  useEffect(() => {
    let alive = true
    fetchSubjects().then((list) => {
      if (!alive) return
      setSubjects(list)
      setLoading(false)
    })
    return () => { alive = false }
  }, [])

  // Classroom courses are an extra section, only when Google is connected.
  useEffect(() => {
    if (!googleConnected) return
    fetch('/api/classroom-courses')
      .then(async (response) => {
        const body = await response.json()
        if (!response.ok) { toast(body.error || 'Could not load Classroom courses.', 'error'); return }
        setCourses(body.courses || [])
      })
  }, [googleConnected])

  const addSubject = async (event: React.FormEvent) => {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    setAdding(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setAdding(false); return }
    const { error } = await supabase.from('subjects').insert({ profile_id: user.id, name: trimmed, color })
    setAdding(false)
    if (error) { toast(error.message, 'error'); return }
    setName('')
    setColor(SUBJECT_COLORS[(SUBJECT_COLORS.indexOf(color) + 1) % SUBJECT_COLORS.length])
    load()
  }

  const deleteSubject = async (subject: Subject) => {
    if (!confirm(`Delete "${subject.name}"? Its notes and assignments stay, without a subject.`)) return
    const { error } = await supabase.from('subjects').delete().eq('id', subject.id)
    if (error) { toast(error.message, 'error'); return }
    setSubjects((list) => list.filter((item) => item.id !== subject.id))
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Subjects" description="Group your notes and assignments by class." />

      <form onSubmit={addSubject} className="glass-panel mb-6 flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center">
        <label htmlFor="subject-name" className="sr-only">New subject name</label>
        <input
          id="subject-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="New subject, e.g. Chemistry"
          className="field-input min-w-0 flex-1 rounded-xl px-3.5 py-2.5 text-sm"
        />
        <div role="radiogroup" aria-label="Color" className="flex items-center gap-1.5">
          {SUBJECT_COLORS.map((swatch) => (
            <button
              key={swatch}
              type="button"
              role="radio"
              aria-checked={color === swatch}
              aria-label={`Color ${swatch}`}
              onClick={() => setColor(swatch)}
              className={`h-6 w-6 rounded-full transition-transform hover:scale-110 ${color === swatch ? 'ring-2 ring-[var(--text)] ring-offset-2 ring-offset-[var(--surface)]' : ''}`}
              style={{ backgroundColor: swatch }}
            />
          ))}
        </div>
        <button type="submit" disabled={adding || !name.trim()} className="primary-button rounded-xl px-4 py-2.5 text-sm font-medium">
          <Plus size={16} weight="bold" />
          Add
        </button>
      </form>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((card) => <div key={card} className="skeleton h-[96px] rounded-2xl" />)}
        </div>
      ) : subjects.length === 0 ? (
        <div className="empty-card rounded-2xl px-6 py-14 text-center">
          <p className="text-sm font-medium text-[var(--text)]">No subjects yet</p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Add your classes above, then pick one when you write a note or an assignment.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {subjects.map((subject) => (
            <div key={subject.id} className="group relative">
              <Link
                href={`/dashboard/subjects/${subject.id}`}
                className="interactive-card flex h-full items-stretch gap-4 rounded-2xl p-4"
                {...spotlightProps}
              >
                <span className="w-1 shrink-0 rounded-full" style={{ backgroundColor: subject.color }} />
                <span className="min-w-0 flex-1 py-0.5">
                  <span className="block truncate pr-8 text-base font-semibold text-[var(--text)]">{subject.name}</span>
                  <span className="mt-2 block font-mono text-xs text-[var(--text-muted)]">
                    {subject.assignments[0]?.count || 0} assignments, {subject.notes[0]?.count || 0} notes
                  </span>
                </span>
              </Link>
              <button
                onClick={() => deleteSubject(subject)}
                aria-label={`Delete ${subject.name}`}
                className="absolute right-3 top-3 rounded-lg p-1.5 text-[var(--text-muted)] opacity-0 hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] focus-visible:opacity-100 group-hover:opacity-100"
              >
                <Trash size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {googleConnected && courses && courses.length > 0 && (
        <section className="mt-12">
          <h2 className="text-base font-semibold text-[var(--text)]">Google Classroom</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Your active courses. Imported assignments are filed under them.</p>
          <ul className="glass-panel mt-4 divide-y overflow-hidden rounded-2xl">
            {courses.map((course) => (
              <li key={course.id}>
                <Link href={`/dashboard/subjects/classroom/${course.id}`} className="group flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-[var(--surface-hover)]">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-[var(--text)]">{course.name}</span>
                    {course.section && <span className="block truncate text-xs text-[var(--text-muted)]">{course.section}</span>}
                  </span>
                  <ArrowSquareOut size={14} className="shrink-0 text-[var(--text-muted)] transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
