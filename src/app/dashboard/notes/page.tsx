'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

type Note = {
  id: string
  title: string
  ai_summary: string | null
  tags: string[]
  updated_at: string
  subjects: any
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

  if (loading) return <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading...</div>

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--text)' }}>Notes</h1>
        <Link
          href="/dashboard/notes/new"
          className="px-3 py-1.5 text-sm rounded-lg font-medium transition bg-[#4ECDC4] text-[#1c1d22] hover:bg-[#3dbdb5]"
        >
          New Note
        </Link>
      </div>

      {notes.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No notes yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {notes.map((note) => (
            <Link
              key={note.id}
              href={`/dashboard/notes/${note.id}`}
              className="rounded-xl p-4 border transition-colors hover:border-[#4ECDC4]/40 group"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <div className="flex items-center gap-2 mb-1.5">
                {note.subjects && (
                  <span
                    className="text-xs px-2 py-0.5 rounded-full text-white"
                    style={{ backgroundColor: note.subjects.color }}
                  >
                    {note.subjects.name}
                  </span>
                )}
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {new Date(note.updated_at).toLocaleDateString()}
                </span>
              </div>
              <h2 className="font-medium text-sm transition-colors group-hover:text-[#4ECDC4]" style={{ color: 'var(--text)' }}>
                {note.title}
              </h2>
              {note.ai_summary && (
                <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--text-muted)' }}>
                  {note.ai_summary}
                </p>
              )}
              {note.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {note.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: 'var(--border)', color: 'var(--text-muted)' }}
                    >
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
