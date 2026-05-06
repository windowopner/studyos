'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

type Note = {
  id: string
  title: string
  content: string
  ai_summary: string | null
  tags: string[]
  updated_at: string
  subject_id: string | null
  subjects: { name: string; color: string } | null
}

export default function NotePage() {
  const { id } = useParams()
  const router = useRouter()
  const [note, setNote] = useState<Note | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [cardCount, setCardCount] = useState(5)

  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editTags, setEditTags] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase
      .from('notes')
      .select('*, subjects(name, color)')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        setNote(data)
        setLoading(false)
      })
  }, [id])

  const handleEdit = () => {
    if (!note) return
    setEditTitle(note.title)
    setEditContent(note.content)
    setEditTags(note.tags.join(', '))
    setEditing(true)
  }

  const handleCancel = () => {
    setEditing(false)
  }

  const handleSave = async () => {
    if (!note || !editTitle.trim()) return
    setSaving(true)
    const tags = editTags.split(',').map(t => t.trim()).filter(Boolean)
    const { data, error } = await supabase
      .from('notes')
      .update({ title: editTitle.trim(), content: editContent, tags })
      .eq('id', note.id)
      .select('*, subjects(name, color)')
      .single()
    if (!error && data) {
      setNote(data)
      setEditing(false)
    }
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!confirm('Delete this note? This cannot be undone.')) return
    setDeleting(true)
    await supabase.from('notes').delete().eq('id', id)
    router.push('/dashboard/notes')
  }

  const handleGenerateFlashcards = async () => {
    if (!note?.content) return
    setShowModal(false)
    setGenerating(true)

    const res = await fetch('/api/flashcards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: note.content, title: note.title, count: cardCount }),
    })

    const { cards } = await res.json()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setGenerating(false); return }

    const { data: deck } = await supabase.from('flashcard_decks').insert({
      profile_id: user.id,
      note_id: note.id,
      subject_id: note.subject_id || null,
      title: note.title,
    }).select().single()

    if (deck) {
      await supabase.from('flashcards').insert(
        cards.map((c: { front: string; back: string }) => ({
          deck_id: deck.id,
          front: c.front,
          back: c.back,
        }))
      )
      router.push(`/dashboard/flashcards/${deck.id}`)
    }

    setGenerating(false)
  }

  if (loading) return <div className="text-sm text-gray-400">Loading...</div>
  if (!note) return <div className="text-sm text-gray-400">Note not found.</div>

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {note.subjects && (
            <span className="text-xs px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: note.subjects.color }}>
              {note.subjects.name}
            </span>
          )}
          <span className="text-xs text-gray-400">
            {new Date(note.updated_at).toLocaleDateString()}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {editing ? (
            <>
              <button
                onClick={handleCancel}
                disabled={saving}
                className="text-xs px-3 py-1.5 border rounded-lg hover:bg-gray-50 transition disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !editTitle.trim()}
                className="text-xs px-3 py-1.5 bg-black text-white rounded-lg hover:bg-gray-800 transition disabled:opacity-40"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleEdit}
                className="text-xs px-3 py-1.5 border rounded-lg hover:bg-gray-50 transition"
              >
                Edit
              </button>
              <button
                onClick={() => setShowModal(true)}
                disabled={generating || !note.content}
                className="text-xs px-3 py-1.5 border rounded-lg hover:bg-gray-50 transition disabled:opacity-40"
              >
                {generating ? 'Generating...' : 'Generate Flashcards'}
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="text-xs text-red-400 hover:text-red-600 transition disabled:opacity-40"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </>
          )}
        </div>
      </div>

      {editing ? (
        <input
          value={editTitle}
          onChange={e => setEditTitle(e.target.value)}
          className="text-2xl font-semibold w-full mb-4 border-b outline-none pb-1 focus:border-black"
          placeholder="Title"
        />
      ) : (
        <h1 className="text-2xl font-semibold mb-4">{note.title}</h1>
      )}

      {note.ai_summary && !editing && (
        <div className="bg-gray-50 border rounded-xl p-4 mb-6">
          <p className="text-xs text-gray-400 mb-1">AI Summary</p>
          <p className="text-sm text-gray-700">{note.ai_summary}</p>
        </div>
      )}

      {editing ? (
        <textarea
          value={editContent}
          onChange={e => setEditContent(e.target.value)}
          rows={16}
          className="w-full text-sm border rounded-xl px-4 py-3 outline-none resize-none leading-relaxed focus:border-gray-400"
          placeholder="Content"
        />
      ) : (
        <div className="text-sm whitespace-pre-wrap leading-relaxed">{note.content}</div>
      )}

      {editing ? (
        <div className="mt-4">
          <label className="text-xs text-gray-400 mb-1 block">Tags (comma-separated)</label>
          <input
            value={editTags}
            onChange={e => setEditTags(e.target.value)}
            className="w-full text-sm border rounded-lg px-3 py-2 outline-none focus:border-gray-400"
            placeholder="e.g. math, calculus, exam"
          />
        </div>
      ) : (
        note.tags.length > 0 && (
          <div className="flex gap-1 mt-6">
            {note.tags.map((tag) => (
              <span key={tag} className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">{tag}</span>
            ))}
          </div>
        )
      )}

      {!editing && (
        <div className="mt-8 pt-6 border-t">
          <Link
            href={`/dashboard/tutor?note=${note.id}`}
            className="text-xs px-3 py-1.5 border rounded-lg hover:bg-gray-50 transition"
          >
            Ask AI Tutor about this note
          </Link>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-80">
            <h2 className="text-lg font-semibold mb-4">Generate Flashcards</h2>
            <p className="text-sm text-gray-500 mb-4">How many cards do you want?</p>
            <div className="flex items-center gap-3 mb-6">
              <button
                onClick={() => setCardCount(prev => Math.max(1, prev - 1))}
                className="w-8 h-8 border rounded-lg text-sm hover:bg-gray-50 transition"
              >
                -
              </button>
              <span className="text-lg font-medium w-8 text-center">{cardCount}</span>
              <button
                onClick={() => setCardCount(prev => Math.min(20, prev + 1))}
                className="w-8 h-8 border rounded-lg text-sm hover:bg-gray-50 transition"
              >
                +
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 border text-sm rounded-lg hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateFlashcards}
                className="flex-1 px-4 py-2 bg-black text-white text-sm rounded-lg hover:bg-gray-800 transition"
              >
                Generate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
