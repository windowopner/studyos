'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { spotlightProps } from '@/lib/spotlight'

type SubjectBadge = {
  name: string
  color: string
} | null

type Note = {
  id: string
  title: string
  ai_summary: string | null
  tags: string[]
  updated_at: string
  subjects: SubjectBadge
}

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchNotes = async () => {
      const { data } = await supabase
        .from('notes')
        .select('id, title, ai_summary, tags, updated_at, subjects(name, color)')
        .order('updated_at', { ascending: false })

      setNotes(data || [])
      setLoading(false)
    }

    fetchNotes()
  }, [])

  if (loading) {
    return <div className="text-sm text-[var(--text-muted)]">Loading...</div>
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="page-kicker">Notes</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text)]">Your recent thinking</h1>
        </div>

        <Link href="/dashboard/notes/new" className="primary-button rounded-2xl px-5 py-3 text-sm font-semibold">
          New Note
        </Link>
      </div>

      {notes.length === 0 ? (
        <div className="empty-card rounded-[28px] px-6 py-12 text-center">
          <p className="text-sm text-[var(--text-muted)]">No notes yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <Link
              key={note.id}
              href={`/dashboard/notes/${note.id}`}
              className="interactive-card block rounded-[26px] px-5 py-5"
              {...spotlightProps}
            >
              <div className="relative z-10">
                <div className="flex flex-wrap items-center gap-2">
                  {note.subjects && (
                    <span
                      className="rounded-full px-2.5 py-1 text-[11px] font-medium text-white"
                      style={{ backgroundColor: note.subjects.color }}
                    >
                      {note.subjects.name}
                    </span>
                  )}
                  <span className="text-[11px] text-[var(--text-muted)]">
                    {new Date(note.updated_at).toLocaleDateString()}
                  </span>
                </div>

                <h2 className="mt-3 text-base font-semibold text-[var(--text)]">{note.title}</h2>

                {note.ai_summary && (
                  <p className="mt-3 line-clamp-2 text-sm leading-6 text-[var(--text-muted)]">
                    {note.ai_summary}
                  </p>
                )}

                {note.tags.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {note.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-white/8 bg-white/5 px-2.5 py-1 text-[11px] text-[var(--text-muted)]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
