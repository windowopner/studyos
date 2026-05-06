'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Subject = { id: string; name: string; color: string }

export default function NewNotePage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [subjectId, setSubjectId] = useState('')
  const [tags, setTags] = useState('')
  const [saving, setSaving] = useState(false)
  const [summarizing, setSummarizing] = useState(false)
  const [summary, setSummary] = useState('')

  useEffect(() => {
    supabase.from('subjects').select('*').then(({ data }) => setSubjects(data || []))
  }, [])

  const handleSummarize = async () => {
    if (!content) return
    setSummarizing(true)
    const res = await fetch('/api/summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })
    const data = await res.json()
    setSummary(data.summary)
    setSummarizing(false)
  }

  const handleSave = async () => {
    if (!title) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const { data, error } = await supabase.from('notes').insert({
      profile_id: user.id,
      title,
      content,
      ai_summary: summary || null,
      subject_id: subjectId || null,
      tags: tags ? tags.split(',').map(t => t.trim()) : [],
    }).select().single()

    setSaving(false)

    if (error) {
      alert(error.message)
      return
    }

    router.push(`/dashboard/notes/${data.id}`)
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">New Note</h1>
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

        <select
          value={subjectId}
          onChange={e => setSubjectId(e.target.value)}
          className="text-sm border rounded-lg px-3 py-2 outline-none w-48"
        >
          <option value="">No subject</option>
          {subjects.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        <textarea
          placeholder="Write your notes here..."
          value={content}
          onChange={e => setContent(e.target.value)}
          rows={16}
          className="text-sm outline-none border rounded-xl p-4 resize-none"
        />

        <input
          type="text"
          placeholder="Tags (comma separated)"
          value={tags}
          onChange={e => setTags(e.target.value)}
          className="text-sm border rounded-lg px-3 py-2 outline-none"
        />

        <div className="flex items-center gap-3">
          <button
            onClick={handleSummarize}
            disabled={summarizing || !content}
            className="px-4 py-2 border text-sm rounded-lg hover:bg-gray-50 transition disabled:opacity-40"
          >
            {summarizing ? 'Summarizing...' : 'AI Summarize'}
          </button>
          {summary && (
            <p className="text-sm text-gray-500 flex-1">{summary}</p>
          )}
        </div>
      </div>
    </div>
  )
}
