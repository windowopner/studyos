'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { spotlightProps } from '@/lib/spotlight'

type SubjectBadge = {
  name: string
  color: string
} | null

type NoteResult = {
  id: string
  title: string
  content: string
  tags: string[]
  subjects: SubjectBadge
}

type AssignmentResult = {
  id: string
  title: string
  description: string | null
  status: string
  due_date: string | null
  subjects: SubjectBadge
}

type DeckResult = {
  id: string
  title: string
  subjects: SubjectBadge
  flashcards: { count: number }[]
}

const statusLabel: Record<string, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Done',
}

const quickQueries = ['lecture', 'quiz', 'summary', 'flashcards']

export default function SearchPage() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [notes, setNotes] = useState<NoteResult[]>([])
  const [assignments, setAssignments] = useState<AssignmentResult[]>([])
  const [decks, setDecks] = useState<DeckResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const hasQuery = query.trim().length > 0

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const trimmed = query.trim()

    if (!trimmed) {
      return
    }

    const timer = setTimeout(async () => {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      const [notesRes, assignmentsRes, decksRes] = await Promise.all([
        supabase
          .from('notes')
          .select('id, title, content, tags, subjects(name, color)')
          .eq('profile_id', user.id)
          .or(`title.ilike.%${trimmed}%,content.ilike.%${trimmed}%`)
          .limit(8),
        supabase
          .from('assignments')
          .select('id, title, description, status, due_date, subjects(name, color)')
          .eq('profile_id', user.id)
          .or(`title.ilike.%${trimmed}%,description.ilike.%${trimmed}%`)
          .limit(8),
        supabase
          .from('flashcard_decks')
          .select('id, title, subjects(name, color), flashcards(count)')
          .eq('profile_id', user.id)
          .ilike('title', `%${trimmed}%`)
          .limit(8),
      ])

      const noteData = (notesRes.data || []) as unknown as NoteResult[]
      const { data: tagData } = await supabase
        .from('notes')
        .select('id, title, content, tags, subjects(name, color)')
        .eq('profile_id', user.id)
        .contains('tags', [trimmed.toLowerCase()])
        .limit(8)

      const mergedNotes = [...noteData]
      for (const note of (tagData || []) as unknown as NoteResult[]) {
        if (!mergedNotes.find((item) => item.id === note.id)) mergedNotes.push(note)
      }

      setNotes(mergedNotes.slice(0, 8))
      setAssignments((assignmentsRes.data || []) as unknown as AssignmentResult[])
      setDecks((decksRes.data || []) as unknown as DeckResult[])
      setSearched(true)
      setLoading(false)
    }, 250)

    return () => clearTimeout(timer)
  }, [query])

  const total = notes.length + assignments.length + decks.length

  return (
    <div className="mx-auto max-w-5xl">
      <section className="glass-panel rounded-[32px] px-6 py-6 sm:px-8 sm:py-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="page-kicker">Search</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text)]">Find it fast</h1>
            <p className="mt-3 text-sm leading-7 text-[var(--text-muted)]">
              Search across notes, assignments, and flashcards from one calmer command bar.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {quickQueries.map((item) => (
              <button
                key={item}
                onClick={() => setQuery(item)}
                className="secondary-button rounded-full px-3 py-1.5 text-xs font-medium"
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6">
          <div className="interactive-card rounded-[26px] px-4 py-3 sm:px-5" {...spotlightProps}>
            <div className="relative z-10 flex items-center gap-3">
              <span className="text-lg text-[var(--text-muted)]">⌕</span>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(event) => {
                  const nextValue = event.target.value
                  setQuery(nextValue)
                  if (!nextValue.trim()) {
                    setLoading(false)
                    setSearched(false)
                  }
                }}
                placeholder="Search notes, assignments, flashcards..."
                className="field-input w-full border-0 bg-transparent px-0 py-2 text-sm shadow-none focus-visible:shadow-none"
              />

              {loading && (
                <span className="text-xs text-[var(--text-muted)]">Searching...</span>
              )}

              {!loading && query && (
                <button
                  onClick={() => setQuery('')}
                  className="ghost-button text-sm font-medium"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="soft-badge rounded-full px-3 py-1.5 text-xs font-medium">
              {hasQuery && searched ? `${total} result${total === 1 ? '' : 's'}` : 'Type to search'}
            </span>
            <span className="soft-badge rounded-full px-3 py-1.5 text-xs font-medium">
              Notes · Assignments · Flashcards
            </span>
          </div>
        </div>
      </section>

      {hasQuery && searched && !loading && total === 0 && (
        <div className="empty-card mt-6 rounded-[28px] px-6 py-12 text-center">
          <p className="text-sm text-[var(--text-muted)]">
            No results for &ldquo;{query}&rdquo;
          </p>
        </div>
      )}

      {hasQuery && notes.length > 0 && (
        <section className="mt-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="section-label">Notes · {notes.length}</h2>
          </div>

          <div className="space-y-3">
            {notes.map((note) => (
              <button
                key={note.id}
                onClick={() => router.push(`/dashboard/notes/${note.id}`)}
                className="interactive-card w-full rounded-[24px] px-4 py-4 text-left"
                {...spotlightProps}
              >
                <div className="relative z-10">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[var(--text)]">{note.title}</span>
                    {note.subjects && (
                      <span
                        className="rounded-full px-2 py-1 text-[11px] font-medium text-white"
                        style={{ backgroundColor: note.subjects.color }}
                      >
                        {note.subjects.name}
                      </span>
                    )}
                  </div>

                  {note.content && (
                    <p className="mt-2 text-xs leading-6 text-[var(--text-muted)]">
                      {note.content.slice(0, 140)}
                    </p>
                  )}

                  {note.tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {note.tags.slice(0, 4).map((tag) => (
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
              </button>
            ))}
          </div>
        </section>
      )}

      {hasQuery && assignments.length > 0 && (
        <section className="mt-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="section-label">Assignments · {assignments.length}</h2>
          </div>

          <div className="space-y-3">
            {assignments.map((assignment) => (
              <button
                key={assignment.id}
                onClick={() => router.push(`/dashboard/assignments/${assignment.id}`)}
                className="interactive-card w-full rounded-[24px] px-4 py-4 text-left"
                {...spotlightProps}
              >
                <div className="relative z-10 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[var(--text)]">{assignment.title}</span>
                      {assignment.subjects && (
                        <span
                          className="rounded-full px-2 py-1 text-[11px] font-medium text-white"
                          style={{ backgroundColor: assignment.subjects.color }}
                        >
                          {assignment.subjects.name}
                        </span>
                      )}
                    </div>

                    {assignment.description && (
                      <p className="mt-2 text-xs leading-6 text-[var(--text-muted)]">
                        {assignment.description.slice(0, 140)}
                      </p>
                    )}

                    {assignment.due_date && (
                      <p className="mt-2 text-[11px] text-[var(--text-muted)]">
                        Due {new Date(assignment.due_date).toLocaleDateString()}
                      </p>
                    )}
                  </div>

                  <span className="rounded-full border border-white/8 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-[var(--text-muted)]">
                    {statusLabel[assignment.status] ?? assignment.status}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {hasQuery && decks.length > 0 && (
        <section className="mt-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="section-label">Flashcards · {decks.length}</h2>
          </div>

          <div className="space-y-3">
            {decks.map((deck) => (
              <button
                key={deck.id}
                onClick={() => router.push(`/dashboard/flashcards/${deck.id}`)}
                className="interactive-card w-full rounded-[24px] px-4 py-4 text-left"
                {...spotlightProps}
              >
                <div className="relative z-10 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[var(--text)]">{deck.title}</span>
                      {deck.subjects && (
                        <span
                          className="rounded-full px-2 py-1 text-[11px] font-medium text-white"
                          style={{ backgroundColor: deck.subjects.color }}
                        >
                          {deck.subjects.name}
                        </span>
                      )}
                    </div>
                  </div>

                  <span className="rounded-full border border-white/8 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-[var(--text-muted)]">
                    {deck.flashcards?.[0]?.count ?? 0} cards
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
