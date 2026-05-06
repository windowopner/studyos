'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

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
    if (!title) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const { data, error } = await supabase.from('assignments').insert({
      profile_id: user.id,
      title,
      description: description || null,
      due_date: dueDate || null,
      status,
      priority,
      subject_id: subjectId || null,
      note_id: noteId || null,
    }).select().single()

    setSaving(false)
    if (error) { alert(error.message); return }
    router.push(`/dashboard/assignments/${data.id}`)
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">New Assignment</h1>
        <button
          onClick={handleSave}
          disabled={saving || !title}
          className="px-4 py-2 bg-black text-white text-sm rounded-lg hover:bg-gray-800 transition disabled:opacity-40"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      <div className="flex flex-col gap-4">
        <input
          type="text"
          placeholder="Title"
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="text-xl font-medium outline-none border-b pb-2"
        />

        <textarea
          placeholder="Description (optional)"
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={4}
          className="text-sm outline-none border rounded-xl p-4 resize-none"
        />

        <div className="flex gap-3">
          <select
            value={subjectId}
            onChange={e => setSubjectId(e.target.value)}
            className="text-sm border rounded-lg px-3 py-2 outline-none flex-1"
          >
            <option value="">No subject</option>
            {subjects.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          <select
            value={noteId}
            onChange={e => setNoteId(e.target.value)}
            className="text-sm border rounded-lg px-3 py-2 outline-none flex-1"
          >
            <option value="">No linked note</option>
            {notes.map(n => (
              <option key={n.id} value={n.id}>{n.title}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-3">
          <input
            type="date"
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
            className="text-sm border rounded-lg px-3 py-2 outline-none flex-1"
          />

          <select
            value={priority}
            onChange={e => setPriority(Number(e.target.value))}
            className="text-sm border rounded-lg px-3 py-2 outline-none flex-1"
          >
            <option value={1}>Low priority</option>
            <option value={2}>Medium priority</option>
            <option value={3}>High priority</option>
          </select>

          <select
            value={status}
            onChange={e => setStatus(e.target.value)}
            className="text-sm border rounded-lg px-3 py-2 outline-none flex-1"
          >
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="done">Done</option>
          </select>
        </div>
      </div>
    </div>
  )
}
