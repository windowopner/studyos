'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { ArrowLeft, Plus } from '@phosphor-icons/react'
import { supabase } from '@/lib/supabase'
import { spotlightProps } from '@/lib/spotlight'
import PageHeader from '@/components/page-header'
import AssignmentRow, { type AssignmentRowData } from '@/components/assignment-row'

type Subject = { id: string; name: string; color: string }
type Note = { id: string; title: string; updated_at: string }

export default function SubjectPage() {
  const { id } = useParams<{ id: string }>()
  const [subject, setSubject] = useState<Subject | null>(null)
  const [assignments, setAssignments] = useState<AssignmentRowData[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const [{ data: subjectData }, { data: assignmentData }, { data: noteData }] = await Promise.all([
        supabase.from('subjects').select('id, name, color').eq('id', id).maybeSingle(),
        supabase.from('assignments').select('id, title, due_date, status').eq('subject_id', id).order('due_date', { ascending: true, nullsFirst: false }),
        supabase.from('notes').select('id, title, updated_at').eq('subject_id', id).order('updated_at', { ascending: false }),
      ])
      setSubject(subjectData)
      setAssignments(assignmentData || [])
      setNotes(noteData || [])
      setLoading(false)
    }
    load()
  }, [id])

  const back = (
    <Link href="/dashboard/subjects" className="group inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)]">
      <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-0.5" />
      Subjects
    </Link>
  )

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="skeleton h-4 w-24" />
        <div className="skeleton h-9 w-1/3" />
        <div className="skeleton h-40 rounded-2xl" />
      </div>
    )
  }

  if (!subject) {
    return (
      <div className="mx-auto max-w-4xl">
        <PageHeader back={back} title="Subject not found" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        back={back}
        title={
          <span className="inline-flex items-center gap-3">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: subject.color }} />
            {subject.name}
          </span>
        }
      />

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--text)]">Assignments</h2>
          <Link href="/dashboard/assignments/new" className="ghost-button inline-flex items-center gap-1 text-sm"><Plus size={14} /> New</Link>
        </div>
        {assignments.length === 0 ? (
          <p className="rounded-2xl border border-dashed px-5 py-6 text-sm text-[var(--text-muted)]">No assignments in this subject.</p>
        ) : (
          <ul className="glass-panel divide-y overflow-hidden rounded-2xl">
            {assignments.map((assignment) => <li key={assignment.id}><AssignmentRow assignment={assignment} /></li>)}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--text)]">Notes</h2>
          <Link href="/dashboard/notes/new" className="ghost-button inline-flex items-center gap-1 text-sm"><Plus size={14} /> New</Link>
        </div>
        {notes.length === 0 ? (
          <p className="rounded-2xl border border-dashed px-5 py-6 text-sm text-[var(--text-muted)]">No notes in this subject.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {notes.map((note) => (
              <Link key={note.id} href={`/dashboard/notes/${note.id}`} className="interactive-card rounded-2xl p-4" {...spotlightProps}>
                <span className="block truncate text-sm font-medium text-[var(--text)]">{note.title}</span>
                <span className="mt-1 block font-mono text-xs text-[var(--text-muted)]">
                  {new Date(note.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
