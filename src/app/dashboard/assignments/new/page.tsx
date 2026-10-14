'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from '@phosphor-icons/react'
import { toast } from '@/components/toaster'
import PageHeader from '@/components/page-header'
import Field, { inputClass } from '@/components/field'

type Subject = { id: string; name: string; color: string }
type Note = { id: string; title: string }

export default function NewAssignmentPage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [status, setStatus] = useState('todo')
  const [priority, setPriority] = useState(2)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [subjectId, setSubjectId] = useState('')
  const [noteId, setNoteId] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('subjects').select('*').then(({ data }) => setSubjects(data || []))
    supabase.from('notes').select('id, title').then(({ data }) => setNotes(data || []))
  }, [])

  const handleSave = async () => {
    if (!title.trim()) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const { data, error } = await supabase.from('assignments').insert({
      profile_id: user.id,
      title: title.trim(),
      description: description.trim() || null,
      due_date: dueDate || null,
      status,
      priority,
      subject_id: subjectId || null,
      note_id: noteId || null,
    }).select().single()

    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    router.push(`/dashboard/assignments/${data.id}`)
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        back={
          <Link href="/dashboard/assignments" className="group inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)]">
            <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-0.5" />
            Assignments
          </Link>
        }
        title="New assignment"
      />

      <form
        onSubmit={(event) => { event.preventDefault(); handleSave() }}
        className="glass-panel flex flex-col gap-5 rounded-2xl p-5 sm:p-6"
      >
        <Field label="Title" htmlFor="title">
          <input id="title" required autoFocus value={title} onChange={(event) => setTitle(event.target.value)} className={inputClass} />
        </Field>

        <Field label="Description" htmlFor="description" hint="Optional. The tutor reads this when you ask about the assignment.">
          <textarea id="description" rows={4} value={description} onChange={(event) => setDescription(event.target.value)} className={`${inputClass} resize-y leading-relaxed`} />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Due date" htmlFor="due">
            <input id="due" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className={inputClass} />
          </Field>
          <Field
            label="Subject"
            htmlFor="subject"
            hint={subjects.length === 0 ? <Link href="/dashboard/subjects" className="text-[var(--accent)] hover:underline">Add subjects</Link> : undefined}
          >
            <select id="subject" value={subjectId} onChange={(event) => setSubjectId(event.target.value)} className={inputClass}>
              <option value="">No subject</option>
              {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
            </select>
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-[var(--text)]">Priority</span>
            <div role="radiogroup" aria-label="Priority" className="grid grid-cols-3 rounded-xl border bg-[var(--surface)] p-1">
              {[1, 2, 3].map((level) => (
                <button
                  key={level}
                  type="button"
                  role="radio"
                  aria-checked={priority === level}
                  onClick={() => setPriority(level)}
                  className={`rounded-lg py-1.5 text-sm ${
                    priority === level ? 'bg-[var(--surface-soft)] font-medium text-[var(--text)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                  }`}
                >
                  {level === 1 ? 'Low' : level === 2 ? 'Medium' : 'High'}
                </button>
              ))}
            </div>
          </div>
          <Field label="Status" htmlFor="status">
            <select id="status" value={status} onChange={(event) => setStatus(event.target.value)} className={inputClass}>
              <option value="todo">To do</option>
              <option value="in_progress">In progress</option>
              <option value="done">Done</option>
            </select>
          </Field>
        </div>

        <Field label="Linked note" htmlFor="note">
          <select id="note" value={noteId} onChange={(event) => setNoteId(event.target.value)} className={inputClass}>
            <option value="">None</option>
            {notes.map((note) => <option key={note.id} value={note.id}>{note.title}</option>)}
          </select>
        </Field>

        <div className="flex justify-end gap-2 border-t pt-5">
          <Link href="/dashboard/assignments" className="secondary-button rounded-xl px-4 py-2 text-sm font-medium">Cancel</Link>
          <button type="submit" disabled={saving || !title.trim()} className="primary-button rounded-xl px-4 py-2 text-sm font-medium">
            {saving ? 'Saving…' : 'Save assignment'}
          </button>
        </div>
      </form>
    </div>
  )
}
