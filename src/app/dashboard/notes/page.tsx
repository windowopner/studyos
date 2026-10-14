'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { pickJoined, type JoinedRelation } from '@/lib/relations'
import { spotlightProps } from '@/lib/spotlight'
import { Plus } from '@phosphor-icons/react'
import PageHeader from '@/components/page-header'
import { plainText } from '@/lib/text'

type SubjectData = {
  name: string
  color: string
}

type SubjectBadge = SubjectData | null

type Note = {
  id: string
  title: string
  ai_summary: string | null
  tags: string[]
  updated_at: string
  subjects: SubjectBadge
}

type RawNote = Omit<Note, 'subjects'> & {
  subjects: JoinedRelation<SubjectData>
}

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [subjectFilter, setSubjectFilter] = useState<string | null>(null)

  useEffect(() => {
    const fetchNotes = async () => {
      const { data } = await supabase
        .from('notes')
        .select('id, title, ai_summary, tags, updated_at, subjects(name, color)')
        .order('updated_at', { ascending: false })

      setNotes(((data || []) as RawNote[]).map((note) => ({
        ...note,
        subjects: pickJoined(note.subjects),
      })))
      setLoading(false)
    }

    fetchNotes()
  }, [])

  const subjectNames = Array.from(new Set(notes.map((note) => note.subjects?.name).filter(Boolean))) as string[]
  const visible = subjectFilter ? notes.filter((note) => note.subjects?.name === subjectFilter) : notes

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Notes"
        description="Newest first. Open one to edit, summarize, or turn it into flashcards."
        actions={
          <Link href="/dashboard/notes/new" className="primary-button rounded-xl px-4 py-2 text-sm font-medium">
            <Plus size={16} weight="bold" />
            New note
          </Link>
        }
      />

      {subjectNames.length > 1 && (
        <div className="mb-5 flex flex-wrap gap-2">
          {[null, ...subjectNames].map((name) => (
            <button
              key={name ?? 'all'}
              onClick={() => setSubjectFilter(name)}
              className={`rounded-full border px-3 py-1 text-sm ${
                subjectFilter === name
                  ? 'border-[var(--text)] bg-[var(--text)] text-[var(--background)]'
                  : 'text-[var(--text-muted)] hover:border-[var(--border-strong)] hover:text-[var(--text)]'
              }`}
            >
              {name ?? 'All'}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {[0, 1, 2, 3].map((card) => <div key={card} className="skeleton h-[132px] rounded-2xl" />)}
        </div>
      ) : notes.length === 0 ? (
        <div className="empty-card rounded-2xl px-6 py-14 text-center">
          <p className="text-sm font-medium text-[var(--text)]">No notes yet</p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Notes you write show up here, newest first.</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {visible.map((note) => (
            <Link
              key={note.id}
              href={`/dashboard/notes/${note.id}`}
              className="interactive-card flex flex-col rounded-2xl p-5"
              {...spotlightProps}
            >
              <div className="flex items-center justify-between gap-3 text-xs text-[var(--text-muted)]">
                {note.subjects ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: note.subjects.color }} />
                    {note.subjects.name}
                  </span>
                ) : <span />}
                <span className="font-mono">
                  {new Date(note.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
              </div>

              <h2 className="mt-3 text-base font-semibold text-[var(--text)]">{note.title}</h2>

              {note.ai_summary && (
                <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[var(--text-muted)]">{plainText(note.ai_summary)}</p>
              )}

              {note.tags.length > 0 && (
                <div className="mt-auto flex flex-wrap gap-1.5 pt-4">
                  {note.tags.map((tag) => (
                    <span key={tag} className="rounded-lg bg-[var(--surface-soft)] px-2 py-0.5 text-xs text-[var(--text-muted)]">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
