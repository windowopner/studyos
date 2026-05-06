'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type NoteResult = {
  id: string
  title: string
  content: string
  tags: string[]
  subjects: { name: string; color: string } | null
}

type AssignmentResult = {
  id: string
  title: string
  description: string | null
  status: string
  due_date: string | null
  subjects: { name: string; color: string } | null
}

type DeckResult = {
  id: string
  title: string
  subjects: { name: string; color: string } | null
  flashcards: { count: number }[]
}

const statusLabel: Record<string, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Done',
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

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const trimmed = query.trim()
    if (!trimmed) {
      setNotes([])
      setAssignments([])
      setDecks([])
      setSearched(false)
      return
    }

    const timer = setTimeout(async () => {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

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

      const noteData = (notesRes.data || []) as NoteResult[]
      const tagMatches = await (async () => {
        const { data } = await supabase
          .from('notes')
          .select('id, title, content, tags, subjects(name, color)')
          .eq('profile_id', user.id)
          .contains('tags', [trimmed.toLowerCase()])
          .limit(8)
        return (data || []) as NoteResult[]
      })()

      const merged = [...noteData]
      for (const n of tagMatches) {
        if (!merged.find(m => m.id === n.id)) merged.push(n)
      }

      setNotes(merged.slice(0, 8))
      setAssignments((assignmentsRes.data || []) as AssignmentResult[])
      setDecks((decksRes.data || []) as DeckResult[])
      setSearched(true)
      setLoading(false)
    }, 250)

    return () => clearTimeout(timer)
  }, [query])

  const total = notes.length + assignments.length + decks.length

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold mb-6">Search</h1>

      <div className="relative mb-8">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search notes, assignments, flashcards..."
          className="w-full border rounded-xl px-4 py-3 text-sm outline-none focus:border-gray-400 pr-10"
        />
        {loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
            Searching...
          </span>
        )}
        {!loading && query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm"
          >
            ✕
          </button>
        )}
      </div>

      {searched && !loading && total === 0 && (
        <p className="text-sm text-gray-400 text-center py-12">No results for &ldquo;{query}&rdquo;</p>
      )}

      {notes.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
            Notes <span className="text-gray-300 normal-case">({notes.length})</span>
          </h2>
          <div className="flex flex-col gap-1">
            {notes.map(n => (
              <button
                key={n.id}
                onClick={() => router.push(`/dashboard/notes/${n.id}`)}
                className="w-full text-left px-4 py-3 rounded-xl hover:bg-gray-50 transition group"
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-medium group-hover:text-black">{n.title}</span>
                  {n.subjects && (
                    <span
                      className="text-xs px-1.5 py-0.5 rounded-full text-white flex-shrink-0"
                      style={{ backgroundColor: n.subjects.color }}
                    >
                      {n.subjects.name}
                    </span>
                  )}
                </div>
                {n.content && (
                  <p className="text-xs text-gray-400 truncate">{n.content.slice(0, 120)}</p>
                )}
                {n.tags.length > 0 && (
                  <div className="flex gap-1 mt-1">
                    {n.tags.slice(0, 4).map(tag => (
                      <span key={tag} className="text-xs bg-gray-100 px-1.5 py-0.5 rounded-full">{tag}</span>
                    ))}
                  </div>
                )}
              </button>
            ))}
          </div>
        </section>
      )}

      {assignments.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
            Assignments <span className="text-gray-300 normal-case">({assignments.length})</span>
          </h2>
          <div className="flex flex-col gap-1">
            {assignments.map(a => (
              <button
                key={a.id}
                onClick={() => router.push(`/dashboard/assignments/${a.id}`)}
                className="w-full text-left px-4 py-3 rounded-xl hover:bg-gray-50 transition group"
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-medium group-hover:text-black">{a.title}</span>
                  {a.subjects && (
                    <span
                      className="text-xs px-1.5 py-0.5 rounded-full text-white flex-shrink-0"
                      style={{ backgroundColor: a.subjects.color }}
                    >
                      {a.subjects.name}
                    </span>
                  )}
                  <span className="text-xs text-gray-400 ml-auto flex-shrink-0">{statusLabel[a.status] ?? a.status}</span>
                </div>
                {a.description && (
                  <p className="text-xs text-gray-400 truncate">{a.description.slice(0, 120)}</p>
                )}
                {a.due_date && (
                  <p className="text-xs text-gray-300 mt-0.5">
                    Due {new Date(a.due_date).toLocaleDateString()}
                  </p>
                )}
              </button>
            ))}
          </div>
        </section>
      )}

      {decks.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
            Flashcards <span className="text-gray-300 normal-case">({decks.length})</span>
          </h2>
          <div className="flex flex-col gap-1">
            {decks.map(d => (
              <button
                key={d.id}
                onClick={() => router.push(`/dashboard/flashcards/${d.id}`)}
                className="w-full text-left px-4 py-3 rounded-xl hover:bg-gray-50 transition group"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium group-hover:text-black">{d.title}</span>
                  {d.subjects && (
                    <span
                      className="text-xs px-1.5 py-0.5 rounded-full text-white flex-shrink-0"
                      style={{ backgroundColor: d.subjects.color }}
                    >
                      {d.subjects.name}
                    </span>
                  )}
                  <span className="text-xs text-gray-400 ml-auto flex-shrink-0">
                    {d.flashcards?.[0]?.count ?? 0} cards
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
