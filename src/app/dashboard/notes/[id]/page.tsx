'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { pickJoined, type JoinedRelation } from '@/lib/relations'
import { ArrowLeft, Cards, ChatCircleText, Minus, PencilSimple, Plus, Trash } from '@phosphor-icons/react'
import PageHeader from '@/components/page-header'
import { toast } from '@/components/toaster'
import { plainText } from '@/lib/text'
import { requestJSON } from '@/lib/http'
import { useUnsavedWarning } from '@/lib/use-unsaved-warning'
import Modal from '@/components/modal'
import LoadError from '@/components/load-error'

type SubjectData = {
  name: string
  color: string
}

type Note = {
  id: string
  title: string
  content: string
  ai_summary: string | null
  tags: string[]
  updated_at: string
  subject_id: string | null
  subjects: SubjectData | null
}

type RawNote = Omit<Note, 'subjects'> & {
  subjects: JoinedRelation<SubjectData>
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
  const [editSubject, setEditSubject] = useState('')
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  const dirty = editing && !!note && (
    editTitle !== note.title || editContent !== (note.content || '') || editTags !== note.tags.join(', ') || editSubject !== (note.subject_id || '')
  )
  useUnsavedWarning(dirty)

  useEffect(() => {
    let alive = true
    supabase
      .from('notes')
      .select('*, subjects(name, color)')
      .eq('id', id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!alive) return
        if (error && error.code !== '22P02') { setFailed(true); setLoading(false); return }
        setFailed(false)
        setNote(data ? {
          ...(data as RawNote),
          subjects: pickJoined((data as RawNote).subjects),
        } : null)
        setLoading(false)
      })
    return () => { alive = false }
  }, [id, attempt])

  const handleEdit = () => {
    if (!note) return
    setEditTitle(note.title)
    setEditContent(note.content || '')
    setEditTags(note.tags.join(', '))
    setEditSubject(note.subject_id || '')
    setEditing(true)
    supabase.from('subjects').select('id, name').order('name').then(({ data }) => setSubjects(data || []))
  }

  const handleCancel = () => {
    if (dirty && !confirm('Discard your changes?')) return
    setEditing(false)
  }

  const handleSave = async () => {
    if (!note || !editTitle.trim()) return
    setSaving(true)
    const tags = [...new Set(editTags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean))].slice(0, 20)
    const { data, error } = await supabase
      .from('notes')
      .update({ title: editTitle.trim(), content: editContent, tags, subject_id: editSubject || null, updated_at: new Date().toISOString() })
      .eq('id', note.id)
      .select('*, subjects(name, color)')
      .single()
    setSaving(false)
    if (error || !data) { toast(error?.message || 'Could not save the note.', 'error'); return }
    setNote({
      ...(data as RawNote),
      subjects: pickJoined((data as RawNote).subjects),
    })
    setEditing(false)
    toast('Note saved.', 'success')
  }

  const handleDelete = async () => {
    if (!note || !confirm('Delete this note? Flashcard decks made from it are deleted too. This cannot be undone.')) return
    setDeleting(true)
    const { error } = await supabase.from('notes').delete().eq('id', note.id)
    if (error) { toast(error.message, 'error'); setDeleting(false); return }
    toast('Note deleted.', 'success')
    router.push('/dashboard/notes')
  }

  const handleGenerateFlashcards = async () => {
    if (!note?.content) return
    setShowModal(false)
    setGenerating(true)

    const result = await requestJSON<{ cards: { front: string; back: string }[] }>('/api/flashcards', {
      body: { content: note.content, title: note.title, count: cardCount },
    })
    if (!result.ok || !Array.isArray(result.data.cards) || result.data.cards.length === 0) {
      toast(result.ok ? 'Could not make flashcards.' : result.error, 'error')
      setGenerating(false)
      return
    }
    const cards = result.data.cards
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setGenerating(false); toast('Your session ended. Sign in again.', 'error'); return }

    const { data: deck, error: deckError } = await supabase.from('flashcard_decks').insert({
      profile_id: user.id,
      note_id: note.id,
      subject_id: note.subject_id || null,
      title: note.title,
    }).select('id').single()
    if (deckError || !deck) {
      toast(deckError?.message || 'Could not save the deck.', 'error')
      setGenerating(false)
      return
    }

    const { error: cardsError } = await supabase.from('flashcards').insert(
      cards.map((c) => ({ deck_id: deck.id, front: c.front, back: c.back }))
    )
    if (cardsError) {
      // Don't leave an empty deck behind.
      await supabase.from('flashcard_decks').delete().eq('id', deck.id)
      toast(cardsError.message, 'error')
      setGenerating(false)
      return
    }
    router.push(`/dashboard/flashcards/${deck.id}`)
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="skeleton h-4 w-24" />
        <div className="skeleton h-9 w-1/2" />
        <div className="skeleton h-64 rounded-2xl" />
      </div>
    )
  }
  if (failed) {
    return (
      <div className="mx-auto max-w-3xl">
        <LoadError message="This note couldn’t load. Check your connection and try again." onRetry={() => { setLoading(true); setAttempt((value) => value + 1) }} />
      </div>
    )
  }
  if (!note) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="empty-card rounded-2xl px-6 py-14 text-center">
          <p className="text-sm font-medium text-[var(--text)]">Note not found</p>
          <Link href="/dashboard/notes" className="mt-3 inline-block text-sm text-[var(--accent)] hover:underline">Back to notes</Link>
        </div>
      </div>
    )
  }

  const back = (
    <Link href="/dashboard/notes" className="group inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)]">
      <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-0.5" />
      Notes
    </Link>
  )

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        back={back}
        title={editing ? 'Edit note' : note.title}
        actions={
          editing ? (
            <>
              <button onClick={handleCancel} disabled={saving} className="secondary-button rounded-xl px-4 py-2 text-sm font-medium">Cancel</button>
              <button onClick={handleSave} disabled={saving || !editTitle.trim()} className="primary-button rounded-xl px-4 py-2 text-sm font-medium">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </>
          ) : (
            <>
              <button onClick={handleEdit} className="secondary-button rounded-xl px-4 py-2 text-sm font-medium">
                <PencilSimple size={16} />
                Edit
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                aria-label="Delete note"
                className="rounded-xl p-2 text-[var(--text-muted)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] disabled:opacity-40"
              >
                <Trash size={18} />
              </button>
            </>
          )
        }
      />

      {!editing && (
        <div className="-mt-4 mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[var(--text-muted)]">
          {note.subjects && (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: note.subjects.color }} />
              {note.subjects.name}
            </span>
          )}
          <span className="font-mono text-xs">
            Edited {new Date(note.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
          {note.tags.map((tag) => (
            <span key={tag} className="rounded-lg bg-[var(--surface-soft)] px-2 py-0.5 text-xs">{tag}</span>
          ))}
        </div>
      )}

      {editing ? (
        <div className="glass-panel rounded-2xl focus-within:border-[var(--border-strong)]">
          <div className="border-b px-5 pb-4 pt-5 sm:px-6">
            <label htmlFor="edit-title" className="sr-only">Title</label>
            <input
              id="edit-title"
              maxLength={300}
              value={editTitle}
              onChange={(event) => setEditTitle(event.target.value)}
              className="w-full bg-transparent text-xl font-semibold text-[var(--text)] outline-none"
            />
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="edit-subject" className="text-xs font-medium text-[var(--text-muted)]">Subject</label>
                <select id="edit-subject" value={editSubject} onChange={(event) => setEditSubject(event.target.value)} className="field-input rounded-lg px-3 py-2 text-sm">
                  <option value="">No subject</option>
                  {/* Keep the current subject listed even before the list loads. */}
                  {note.subject_id && !subjects.some((subject) => subject.id === note.subject_id) && note.subjects && (
                    <option value={note.subject_id}>{note.subjects.name}</option>
                  )}
                  {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="edit-tags" className="text-xs font-medium text-[var(--text-muted)]">Tags, separated by commas</label>
                <input id="edit-tags" value={editTags} onChange={(event) => setEditTags(event.target.value)} className="field-input rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
          </div>
          <label htmlFor="edit-content" className="sr-only">Note</label>
          <textarea
            id="edit-content"
            value={editContent}
            onChange={(event) => setEditContent(event.target.value)}
            rows={18}
            className="block w-full resize-y bg-transparent px-5 py-5 text-[15px] leading-relaxed text-[var(--text)] outline-none sm:px-6"
          />
        </div>
      ) : (
        <>
          {note.ai_summary && (
            <div className="mb-6 rounded-2xl border-l-2 border-[var(--accent)] bg-[var(--surface-soft)] px-5 py-4">
              <p className="text-xs font-medium text-[var(--text-muted)]">Summary</p>
              <p className="mt-1 text-sm leading-relaxed text-[var(--text)]">{plainText(note.ai_summary)}</p>
            </div>
          )}
          <article className="max-w-[68ch] whitespace-pre-wrap text-[15px] leading-[1.75] text-[var(--text)]">
            {note.content || <span className="text-[var(--text-muted)]">This note is empty.</span>}
          </article>

          <div className="mt-10 flex flex-wrap gap-2 border-t pt-6">
            <Link href={`/dashboard/tutor?note=${note.id}`} className="secondary-button rounded-xl px-4 py-2 text-sm font-medium">
              <ChatCircleText size={16} />
              Ask the tutor about this
            </Link>
            <button
              onClick={() => setShowModal(true)}
              disabled={generating || !note.content}
              className="secondary-button rounded-xl px-4 py-2 text-sm font-medium"
            >
              <Cards size={16} />
              {generating ? 'Making cards…' : 'Make flashcards'}
            </button>
          </div>
        </>
      )}

      {showModal && (
        <Modal title="Make flashcards" description="The AI turns this note into a new deck." onClose={() => setShowModal(false)}>
          <p className="text-sm text-[var(--text-muted)]">Number of cards</p>
          <div className="mt-2 flex items-center gap-3">
            <button onClick={() => setCardCount((previous) => Math.max(1, previous - 1))} aria-label="Fewer cards" className="secondary-button h-9 w-9 rounded-lg">
              <Minus size={14} />
            </button>
            <span className="w-8 text-center font-mono text-lg text-[var(--text)]" aria-live="polite">{cardCount}</span>
            <button onClick={() => setCardCount((previous) => Math.min(20, previous + 1))} aria-label="More cards" className="secondary-button h-9 w-9 rounded-lg">
              <Plus size={14} />
            </button>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-2">
            <button onClick={() => setShowModal(false)} className="secondary-button rounded-xl px-4 py-2 text-sm font-medium">Cancel</button>
            <button onClick={handleGenerateFlashcards} className="primary-button rounded-xl px-4 py-2 text-sm font-medium">Make deck</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
