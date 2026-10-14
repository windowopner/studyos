'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { pickJoined, type JoinedRelation } from '@/lib/relations'
import { toast } from '@/components/toaster'
import PageHeader from '@/components/page-header'
import { dueLabel } from '@/lib/dates'
import { spotlightProps } from '@/lib/spotlight'
import { useGoogleConnected } from '@/lib/use-google'
import {
  ArrowLeft,
  ArrowSquareOut,
  CaretRight,
  ChatCircleText,
  FileText,
  Minus,
  NotePencil,
  Paperclip,
  Plus,
  Trash,
} from '@phosphor-icons/react'

type Attachment = {
  id: string
  title: string
  link: string
}

type SubjectData = {
  name: string
  color: string
}

type NoteData = {
  id: string
  title: string
}

type Assignment = {
  id: string
  title: string
  description: string | null
  due_date: string | null
  status: string
  priority: number
  max_points: number | null
  classroom_id: string | null
  subjects: SubjectData | null
  notes: NoteData | null
}

type RawAssignment = Omit<Assignment, 'subjects' | 'notes'> & {
  subjects: JoinedRelation<SubjectData>
  notes: JoinedRelation<NoteData>
}

const priorityLabel: Record<number, string> = { 1: 'Low', 2: 'Medium', 3: 'High' }
const priorityColor: Record<number, string> = {
  1: 'bg-[var(--surface-soft)] text-[var(--text-muted)]',
  2: 'bg-[var(--warn-soft)] text-[var(--warn)]',
  3: 'bg-[var(--danger-soft)] text-[var(--danger)]',
}

export default function AssignmentPage() {
  const { id } = useParams()
  const router = useRouter()
  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [docUrl, setDocUrl] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [docType, setDocType] = useState<'doc' | 'slides'>('doc')
  const googleConnected = useGoogleConnected()
  const [slideCount, setSlideCount] = useState(6)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [analyzing, setAnalyzing] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<Record<string, string>>({})

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('assignments')
        .select('*, subjects(name, color), notes(id, title)')
        .eq('id', id)
        .single()
      setAssignment(data ? {
        ...(data as RawAssignment),
        subjects: pickJoined((data as RawAssignment).subjects),
        notes: pickJoined((data as RawAssignment).notes),
      } : null)
      setLoading(false)

      // Attachments come from Classroom, so they only load while Google is connected.
      if (data?.classroom_id) {
        const res = await fetch('/api/classroom')
        if (!res.ok) return
        const { assignments: list } = await res.json()
        const found = list?.find((a: { classroomId: string; attachments: Attachment[] }) =>
          a.classroomId === data.classroom_id
        )
        setAttachments(found?.attachments || [])
      }
    }
    load()
  }, [id])

  const updateStatus = async (status: string) => {
    await supabase.from('assignments').update({ status }).eq('id', id)
    setAssignment(prev => prev ? { ...prev, status } : prev)
  }

  const handleDelete = async () => {
    if (!confirm('Delete this assignment? This cannot be undone.')) return
    setDeleting(true)
    await supabase.from('assignments').delete().eq('id', id)
    router.push('/dashboard/assignments')
  }

  const handleGenerate = async () => {
    if (!assignment) return
    setShowModal(false)
    setGenerating(true)
    setDocUrl(null)

    const res = await fetch('/api/generate-doc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: assignment.title,
        description: assignment.description,
        type: docType,
        slideCount,
      }),
    })

    const data = await res.json()
    if (data.url) setDocUrl(data.url)
    else toast(data.error || 'Could not create the document.', 'error')
    setGenerating(false)
  }

  const handleAnalyzePDF = async (attachment: Attachment) => {
    if (!assignment) return
    setAnalyzing(attachment.id)

    const res = await fetch('/api/read-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileId: attachment.id,
        assignmentTitle: assignment.title,
        assignmentDescription: assignment.description,
      }),
    })

    const data = await res.json()
    if (data.summary) setAnalysis(prev => ({ ...prev, [attachment.id]: data.summary }))
    else toast(data.error || 'Could not read the PDF.', 'error')
    setAnalyzing(null)
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="skeleton h-4 w-32" />
        <div className="skeleton h-9 w-2/3" />
        <div className="skeleton h-40 rounded-2xl" />
      </div>
    )
  }
  if (!assignment) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="empty-card rounded-2xl px-6 py-14 text-center">
          <p className="text-sm font-medium text-[var(--text)]">Assignment not found</p>
          <Link href="/dashboard/assignments" className="mt-3 inline-block text-sm text-[var(--accent)] hover:underline">Back to assignments</Link>
        </div>
      </div>
    )
  }

  const due = dueLabel(assignment.due_date)

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        back={
          <Link href="/dashboard/assignments" className="group inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)]">
            <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-0.5" />
            Assignments
          </Link>
        }
        title={assignment.title}
        actions={
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-[var(--text-muted)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] disabled:opacity-40"
          >
            <Trash size={16} />
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        }
      />

      <div className="-mt-4 mb-8 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[var(--text-muted)]">
        {assignment.subjects && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: assignment.subjects.color }} />
            {assignment.subjects.name}
          </span>
        )}
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${priorityColor[assignment.priority]}`}>
          {priorityLabel[assignment.priority]} priority
        </span>
        {assignment.max_points && <span>{assignment.max_points} pts</span>}
        <span className={`font-mono text-xs ${due.overdue && assignment.status !== 'done' ? 'text-[var(--danger)]' : ''}`}>
          {due.text}
        </span>
      </div>

      <div role="radiogroup" aria-label="Status" className="mb-6 inline-flex rounded-xl border bg-[var(--surface)] p-1">
        {(['todo', 'in_progress', 'done'] as const).map((status) => (
          <button
            key={status}
            role="radio"
            aria-checked={assignment.status === status}
            onClick={() => updateStatus(status)}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              assignment.status === status
                ? status === 'done'
                  ? 'bg-[var(--success-soft)] font-medium text-[var(--success)]'
                  : 'bg-[var(--surface-soft)] font-medium text-[var(--text)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            {status === 'todo' ? 'To do' : status === 'in_progress' ? 'In progress' : 'Done'}
          </button>
        ))}
      </div>

      <section className="glass-panel rounded-2xl p-5 sm:p-6">
        <h2 className="text-sm font-medium text-[var(--text-muted)]">Description</h2>
        {assignment.description ? (
          <p className="mt-3 max-w-[65ch] whitespace-pre-wrap text-[15px] leading-relaxed text-[var(--text)]">{assignment.description}</p>
        ) : (
          <p className="mt-3 text-sm text-[var(--text-muted)]">No description.</p>
        )}
      </section>

      {attachments.length > 0 && (
        <section className="glass-panel mt-4 rounded-2xl p-5 sm:p-6">
          <h2 className="text-sm font-medium text-[var(--text-muted)]">Attachments</h2>
          <ul className="mt-3 space-y-3">
            {attachments.map((attachment) => (
              <li key={attachment.id}>
                <div className="flex items-center justify-between gap-3">
                  <a href={attachment.link} target="_blank" rel="noopener noreferrer" className="inline-flex min-w-0 flex-1 items-center gap-2 text-sm font-medium text-[var(--text)] hover:text-[var(--accent)]">
                    <Paperclip size={16} className="shrink-0 text-[var(--text-muted)]" />
                    <span className="truncate">{attachment.title}</span>
                  </a>
                  <button
                    onClick={() => handleAnalyzePDF(attachment)}
                    disabled={analyzing === attachment.id}
                    className="secondary-button shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium"
                  >
                    {analyzing === attachment.id ? 'Reading…' : 'Summarize with AI'}
                  </button>
                </div>
                {analysis[attachment.id] && (
                  <p className="mt-2 whitespace-pre-wrap rounded-xl bg-[var(--surface-soft)] p-3 text-sm leading-relaxed text-[var(--text)]">
                    {analysis[attachment.id]}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {assignment.notes && (
        <Link
          href={`/dashboard/notes/${assignment.notes.id}`}
          className="interactive-card group mt-4 flex items-center gap-3 rounded-2xl p-4"
          {...spotlightProps}
        >
          <NotePencil size={18} className="text-[var(--text-muted)]" />
          <span className="min-w-0 flex-1">
            <span className="block text-xs text-[var(--text-muted)]">Linked note</span>
            <span className="block truncate text-sm font-medium text-[var(--text)]">{assignment.notes.title}</span>
          </span>
          <CaretRight size={14} className="text-[var(--text-muted)] transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}

      {docUrl && (
        <a
          href={docUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 flex items-center justify-between rounded-2xl bg-[var(--success-soft)] p-4 text-sm font-medium text-[var(--success)] hover:opacity-90"
        >
          Your Google {docType === 'slides' ? 'Slides' : 'Doc'} is ready
          <ArrowSquareOut size={16} />
        </a>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        <Link href={`/dashboard/tutor?assignment=${assignment.id}`} className="secondary-button rounded-xl px-4 py-2 text-sm font-medium">
          <ChatCircleText size={16} />
          Ask the tutor
        </Link>
        {googleConnected && (
          <button
            onClick={() => setShowModal(true)}
            disabled={generating}
            className="secondary-button rounded-xl px-4 py-2 text-sm font-medium"
          >
            <FileText size={16} />
            {generating ? 'Creating…' : 'Draft in Google Docs'}
          </button>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-[2px]" onClick={() => setShowModal(false)}>
          <div className="glass-panel w-full max-w-sm rounded-2xl p-6 shadow-[var(--shadow-pop)]" onClick={(event) => event.stopPropagation()}>
            <h2 className="text-lg font-semibold text-[var(--text)]">Draft with AI</h2>

            <p className="mt-4 text-sm text-[var(--text-muted)]">Create a</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(['doc', 'slides'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setDocType(type)}
                  className={`rounded-xl border px-3 py-2.5 text-sm ${
                    docType === type
                      ? 'border-[var(--accent)] bg-[rgb(var(--accent-rgb)/0.1)] font-medium text-[var(--text)]'
                      : 'text-[var(--text-muted)] hover:border-[var(--border-strong)] hover:text-[var(--text)]'
                  }`}
                >
                  {type === 'doc' ? 'Google Doc' : 'Google Slides'}
                </button>
              ))}
            </div>

            {docType === 'slides' && (
              <>
                <p className="mt-5 text-sm text-[var(--text-muted)]">Slides, including the title slide</p>
                <div className="mt-2 flex items-center gap-3">
                  <button
                    onClick={() => setSlideCount((previous) => Math.max(3, previous - 1))}
                    aria-label="Fewer slides"
                    className="secondary-button h-9 w-9 rounded-lg"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="w-8 text-center font-mono text-lg text-[var(--text)]">{slideCount}</span>
                  <button
                    onClick={() => setSlideCount((previous) => Math.min(20, previous + 1))}
                    aria-label="More slides"
                    className="secondary-button h-9 w-9 rounded-lg"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </>
            )}

            <div className="mt-6 grid grid-cols-2 gap-2">
              <button onClick={() => setShowModal(false)} className="secondary-button rounded-xl px-4 py-2 text-sm font-medium">
                Cancel
              </button>
              <button onClick={handleGenerate} className="primary-button rounded-xl px-4 py-2 text-sm font-medium">
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
