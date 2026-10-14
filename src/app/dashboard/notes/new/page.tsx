'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Sparkle } from '@phosphor-icons/react'
import { toast } from '@/components/toaster'
import PageHeader from '@/components/page-header'

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
    setSummarizing(false)
    if (!res.ok) { toast(data.error || 'Could not summarize.', 'error'); return }
    setSummary(data.summary)
  }

  const handleSave = async () => {
    if (!title.trim()) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const { data, error } = await supabase.from('notes').insert({
      profile_id: user.id,
      title: title.trim(),
      content,
      ai_summary: summary || null,
      subject_id: subjectId || null,
      tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
    }).select().single()

    setSaving(false)

    if (error) {
      toast(error.message, 'error')
      return
    }

    router.push(`/dashboard/notes/${data.id}`)
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        back={
          <Link href="/dashboard/notes" className="group inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)]">
            <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-0.5" />
            Notes
          </Link>
        }
        title="New note"
        actions={
          <button onClick={handleSave} disabled={saving || !title.trim()} className="primary-button rounded-xl px-4 py-2 text-sm font-medium">
            {saving ? 'Saving…' : 'Save note'}
          </button>
        }
      />

      <div className="glass-panel rounded-2xl focus-within:border-[var(--border-strong)]">
        <div className="border-b px-5 pb-4 pt-5 sm:px-6">
          <label htmlFor="title" className="sr-only">Title</label>
          <input
            id="title"
            autoFocus
            placeholder="Untitled"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="w-full bg-transparent text-xl font-semibold text-[var(--text)] outline-none placeholder:text-[var(--text-muted)]"
          />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="subject" className="text-xs font-medium text-[var(--text-muted)]">Subject</label>
              <select id="subject" value={subjectId} onChange={(event) => setSubjectId(event.target.value)} className="field-input rounded-lg px-3 py-2 text-sm">
                <option value="">No subject</option>
                {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="tags" className="text-xs font-medium text-[var(--text-muted)]">Tags, separated by commas</label>
              <input id="tags" value={tags} onChange={(event) => setTags(event.target.value)} className="field-input rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
        </div>

        <label htmlFor="content" className="sr-only">Note</label>
        <textarea
          id="content"
          placeholder="Start writing…"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          rows={18}
          className="block w-full resize-y bg-transparent px-5 py-5 text-[15px] leading-relaxed text-[var(--text)] outline-none placeholder:text-[var(--text-muted)] sm:px-6"
        />
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start">
        <button onClick={handleSummarize} disabled={summarizing || !content.trim()} className="secondary-button shrink-0 rounded-xl px-4 py-2 text-sm font-medium">
          <Sparkle size={16} />
          {summarizing ? 'Summarizing…' : 'Summarize with AI'}
        </button>
        {summary && (
          <p className="flex-1 rounded-xl bg-[var(--surface-soft)] px-4 py-3 text-sm leading-relaxed text-[var(--text)]">{summary}</p>
        )}
      </div>
    </div>
  )
}
