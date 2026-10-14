'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { pickJoined, type JoinedRelation } from '@/lib/relations'
import { Cards, ClipboardText, MagnifyingGlass, NotePencil, X } from '@phosphor-icons/react'
import PageHeader from '@/components/page-header'

type SubjectData = {
  name: string
  color: string
}

type SubjectBadge = SubjectData | null

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

type RawNoteResult = Omit<NoteResult, 'subjects'> & {
  subjects: JoinedRelation<SubjectData>
}

type RawAssignmentResult = Omit<AssignmentResult, 'subjects'> & {
  subjects: JoinedRelation<SubjectData>
}

type RawDeckResult = Omit<DeckResult, 'subjects'> & {
  subjects: JoinedRelation<SubjectData>
}

const statusLabel: Record<string, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
}

// Wraps the parts of `text` that match `query` in <mark>.
function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim()
  if (!q) return <>{text}</>
  const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig'))
  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === q.toLowerCase()
          ? <mark key={index} className="rounded-sm bg-[rgb(var(--accent-rgb)/0.2)] px-0.5 text-[var(--text)]">{part}</mark>
          : <span key={index}>{part}</span>
      )}
    </>
  )
}

// A short excerpt of `text` around the first match, so the match is visible.
function excerpt(text: string, query: string, length = 140) {
  const index = text.toLowerCase().indexOf(query.trim().toLowerCase())
  if (index < 40) return text.slice(0, length)
  return '…' + text.slice(index - 40, index - 40 + length)
}

export default function SearchPage() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [notes, setNotes] = useState<NoteResult[]>([])
  const [assignments, setAssignments] = useState<AssignmentResult[]>([])
  const [decks, setDecks] = useState<DeckResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [active, setActive] = useState(0)
  const hasQuery = query.trim().length > 0

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    // Commas, parentheses, and wildcards have meaning inside PostgREST filters, so they're stripped.
    const trimmed = query.replace(/[,()*%\\]/g, ' ').trim()

    if (!trimmed) {
      return
    }

    let stale = false
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

      const noteData = ((notesRes.data || []) as RawNoteResult[]).map((note) => ({
        ...note,
        subjects: pickJoined(note.subjects),
      }))
      const { data: tagData } = await supabase
        .from('notes')
        .select('id, title, content, tags, subjects(name, color)')
        .eq('profile_id', user.id)
        .contains('tags', [trimmed.toLowerCase()])
        .limit(8)

      const mergedNotes = [...noteData]
      for (const note of ((tagData || []) as RawNoteResult[]).map((item) => ({
        ...item,
        subjects: pickJoined(item.subjects),
      }))) {
        if (!mergedNotes.find((item) => item.id === note.id)) mergedNotes.push(note)
      }

      if (stale) return
      setActive(0)
      setNotes(mergedNotes.slice(0, 8))
      setAssignments(((assignmentsRes.data || []) as RawAssignmentResult[]).map((assignment) => ({
        ...assignment,
        subjects: pickJoined(assignment.subjects),
      })))
      setDecks(((decksRes.data || []) as RawDeckResult[]).map((deck) => ({
        ...deck,
        subjects: pickJoined(deck.subjects),
      })))
      setSearched(true)
      setLoading(false)
    }, 250)

    return () => { stale = true; clearTimeout(timer) }
  }, [query])

  const total = notes.length + assignments.length + decks.length

  // One flat list for keyboard navigation: arrow keys move, Enter opens.
  const flat = [
    ...notes.map((note) => `/dashboard/notes/${note.id}`),
    ...assignments.map((assignment) => `/dashboard/assignments/${assignment.id}`),
    ...decks.map((deck) => `/dashboard/flashcards/${deck.id}`),
  ]

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!flat.length) return
    if (event.key === 'ArrowDown') { event.preventDefault(); setActive((index) => (index + 1) % flat.length) }
    if (event.key === 'ArrowUp') { event.preventDefault(); setActive((index) => (index - 1 + flat.length) % flat.length) }
    if (event.key === 'Enter') { event.preventDefault(); router.push(flat[active]) }
  }

  const rowClass = (index: number) =>
    `flex w-full items-start gap-3 px-4 py-3 text-left ${index === active ? 'bg-[var(--surface-hover)]' : 'hover:bg-[var(--surface-hover)]'}`

  const subjectDot = (subject: SubjectBadge) => subject && (
    <span className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: subject.color }} />
      {subject.name}
    </span>
  )

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Search" />

      <div className="glass-panel flex items-center gap-3 rounded-2xl px-4 focus-within:border-[var(--accent)] focus-within:shadow-[0_0_0_3px_rgb(var(--accent-rgb)/0.14)]">
        <MagnifyingGlass size={18} className="shrink-0 text-[var(--text-muted)]" />
        <label htmlFor="search" className="sr-only">Search</label>
        <input
          id="search"
          ref={inputRef}
          type="text"
          value={query}
          onKeyDown={onKeyDown}
          onChange={(event) => {
            const nextValue = event.target.value
            setQuery(nextValue)
            if (!nextValue.trim()) {
              setLoading(false)
              setSearched(false)
            }
          }}
          placeholder="Notes, assignments, flashcards"
          className="min-w-0 flex-1 bg-transparent py-3.5 text-[15px] text-[var(--text)] outline-none placeholder:text-[var(--text-muted)]"
        />
        {loading && <span className="font-mono text-xs text-[var(--text-muted)]">Searching…</span>}
        {!loading && query && (
          <button onClick={() => { setQuery(''); setSearched(false); inputRef.current?.focus() }} aria-label="Clear search" className="rounded-md p-1 text-[var(--text-muted)] hover:text-[var(--text)]">
            <X size={16} />
          </button>
        )}
      </div>

      {!hasQuery && (
        <p className="mt-6 text-center text-sm text-[var(--text-muted)]">
          Searches titles, note text, assignment descriptions, and tags. Use the arrow keys and Enter to open a result.
        </p>
      )}

      {hasQuery && searched && !loading && total === 0 && (
        <div className="empty-card mt-6 rounded-2xl px-6 py-12 text-center">
          <p className="text-sm text-[var(--text-muted)]">No results for &ldquo;{query}&rdquo;</p>
        </div>
      )}

      {hasQuery && notes.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-medium text-[var(--text-muted)]">Notes</h2>
          <ul className="glass-panel divide-y overflow-hidden rounded-2xl">
            {notes.map((note, position) => {
              const row = position
              return (
                <li key={note.id}>
                  <button onClick={() => router.push(`/dashboard/notes/${note.id}`)} onMouseEnter={() => setActive(row)} className={rowClass(row)}>
                    <NotePencil size={16} className="mt-0.5 shrink-0 text-[var(--text-muted)]" />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="text-sm font-medium text-[var(--text)]"><Highlight text={note.title} query={query} /></span>
                        {subjectDot(note.subjects)}
                      </span>
                      {note.content && (
                        <span className="mt-1 block line-clamp-2 text-xs leading-relaxed text-[var(--text-muted)]">
                          <Highlight text={excerpt(note.content, query)} query={query} />
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {hasQuery && assignments.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-medium text-[var(--text-muted)]">Assignments</h2>
          <ul className="glass-panel divide-y overflow-hidden rounded-2xl">
            {assignments.map((assignment, position) => {
              const row = notes.length + position
              return (
                <li key={assignment.id}>
                  <button onClick={() => router.push(`/dashboard/assignments/${assignment.id}`)} onMouseEnter={() => setActive(row)} className={rowClass(row)}>
                    <ClipboardText size={16} className="mt-0.5 shrink-0 text-[var(--text-muted)]" />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="text-sm font-medium text-[var(--text)]"><Highlight text={assignment.title} query={query} /></span>
                        {subjectDot(assignment.subjects)}
                      </span>
                      {assignment.description && (
                        <span className="mt-1 block line-clamp-2 text-xs leading-relaxed text-[var(--text-muted)]">
                          <Highlight text={excerpt(assignment.description, query)} query={query} />
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-xs text-[var(--text-muted)]">{statusLabel[assignment.status] ?? assignment.status}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {hasQuery && decks.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-medium text-[var(--text-muted)]">Flashcards</h2>
          <ul className="glass-panel divide-y overflow-hidden rounded-2xl">
            {decks.map((deck, position) => {
              const row = notes.length + assignments.length + position
              return (
                <li key={deck.id}>
                  <button onClick={() => router.push(`/dashboard/flashcards/${deck.id}`)} onMouseEnter={() => setActive(row)} className={rowClass(row)}>
                    <Cards size={16} className="mt-0.5 shrink-0 text-[var(--text-muted)]" />
                    <span className="min-w-0 flex-1 text-sm font-medium text-[var(--text)]"><Highlight text={deck.title} query={query} /></span>
                    <span className="shrink-0 font-mono text-xs text-[var(--text-muted)]">{deck.flashcards?.[0]?.count ?? 0} cards</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}
