'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { pickJoined, type JoinedRelation } from '@/lib/relations'

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
  1: 'bg-gray-100 text-gray-600',
  2: 'bg-yellow-100 text-yellow-700',
  3: 'bg-red-100 text-red-700',
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

      if (data?.classroom_id) {
        const res = await fetch('/api/classroom')
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
    else alert('Failed to generate document.')
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
    else alert('Failed to analyze PDF.')
    setAnalyzing(null)
  }

  if (loading) return <div className="text-sm text-gray-400">Loading...</div>
  if (!assignment) return <div className="text-sm text-gray-400">Assignment not found.</div>

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <Link href="/dashboard/assignments" className="text-xs text-gray-400 hover:text-gray-600 transition">
          Back to Assignments
        </Link>
        <button onClick={handleDelete} disabled={deleting} className="text-xs text-red-400 hover:text-red-600 transition disabled:opacity-40">
          {deleting ? 'Deleting...' : 'Delete'}
        </button>
      </div>

      <h1 className="text-2xl font-semibold mb-4">{assignment.title}</h1>

      <div className="flex flex-wrap items-center gap-2 mb-6">
        {assignment.subjects && (
          <span className="text-xs px-2 py-1 rounded-full text-white" style={{ backgroundColor: assignment.subjects.color }}>
            {assignment.subjects.name}
          </span>
        )}
        <span className={`text-xs px-2 py-1 rounded-full ${priorityColor[assignment.priority]}`}>
          {priorityLabel[assignment.priority]} priority
        </span>
        {assignment.max_points && (
          <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">
            {assignment.max_points} pts
          </span>
        )}
        {assignment.due_date && (
          <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
            Due {new Date(assignment.due_date).toLocaleDateString()}
          </span>
        )}
      </div>

      <div className="flex gap-2 mb-6">
        {['todo', 'in_progress', 'done'].map(s => (
          <button
            key={s}
            onClick={() => updateStatus(s)}
            className={`text-xs px-3 py-1.5 rounded-full border transition ${
              assignment.status === s ? 'bg-black text-white border-black' : 'hover:bg-gray-50'
            }`}
          >
            {s === 'todo' ? 'To Do' : s === 'in_progress' ? 'In Progress' : 'Done'}
          </button>
        ))}
      </div>

      {assignment.description ? (
        <div className="border rounded-xl p-4 mb-6">
          <p className="text-xs text-gray-400 mb-2">Description</p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{assignment.description}</p>
        </div>
      ) : (
        <div className="border border-dashed rounded-xl p-4 mb-6">
          <p className="text-sm text-gray-400">No description.</p>
        </div>
      )}

      {attachments.length > 0 && (
        <div className="border rounded-xl p-4 mb-6">
          <p className="text-xs text-gray-400 mb-3">Attachments</p>
          <div className="flex flex-col gap-3">
            {attachments.map(a => (
              <div key={a.id}>
                <div className="flex items-center justify-between">
                  <a href={a.link} target="_blank" rel="noopener noreferrer" className="text-sm font-medium hover:underline truncate flex-1">
                    {a.title}
                  </a>
                  <button
                    onClick={() => handleAnalyzePDF(a)}
                    disabled={analyzing === a.id}
                    className="ml-3 text-xs px-3 py-1 border rounded-lg hover:bg-gray-50 transition disabled:opacity-40 flex-shrink-0"
                  >
                    {analyzing === a.id ? 'Analyzing...' : 'Analyze with AI'}
                  </button>
                </div>
                {analysis[a.id] && (
                  <div className="mt-2 bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-400 mb-1">AI Analysis</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{analysis[a.id]}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {assignment.notes && (
        <div className="border rounded-xl p-4 mb-4">
          <p className="text-xs text-gray-400 mb-1">Linked Note</p>
          <Link href={`/dashboard/notes/${assignment.notes.id}`} className="text-sm font-medium hover:underline">
            {assignment.notes.title}
          </Link>
        </div>
      )}

      {docUrl && (
        <div className="border border-green-200 bg-green-50 rounded-xl p-4 mb-4">
          <p className="text-xs text-green-600 mb-1">Document ready</p>
          <a href={docUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-green-700 hover:underline">
            Open in Google {docType === 'slides' ? 'Slides' : 'Docs'}
          </a>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => setShowModal(true)}
          disabled={generating}
          className="px-4 py-2 border text-sm rounded-lg hover:bg-gray-50 transition disabled:opacity-40"
        >
          {generating ? 'Generating...' : 'Generate with AI'}
        </button>
        <Link href={`/dashboard/tutor?assignment=${assignment.id}`} className="px-4 py-2 border text-sm rounded-lg hover:bg-gray-50 transition">
          Ask AI Tutor
        </Link>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-80">
            <h2 className="text-lg font-semibold mb-4">Generate with AI</h2>

            <p className="text-sm text-gray-500 mb-3">Document type</p>
            <div className="flex gap-2 mb-5">
              <button
                onClick={() => setDocType('doc')}
                className={`flex-1 py-2.5 text-sm rounded-lg border transition ${docType === 'doc' ? 'bg-black text-white border-black' : 'hover:bg-gray-50'}`}
              >
                Google Docs
              </button>
              <button
                onClick={() => setDocType('slides')}
                className={`flex-1 py-2.5 text-sm rounded-lg border transition ${docType === 'slides' ? 'bg-black text-white border-black' : 'hover:bg-gray-50'}`}
              >
                Google Slides
              </button>
            </div>

            {docType === 'slides' && (
              <>
                <p className="text-sm text-gray-500 mb-3">Number of slides (including title)</p>
                <div className="flex items-center gap-3 mb-5">
                  <button
                    onClick={() => setSlideCount(prev => Math.max(3, prev - 1))}
                    className="w-8 h-8 border rounded-lg text-sm hover:bg-gray-50 transition"
                  >
                    -
                  </button>
                  <span className="text-lg font-medium w-8 text-center">{slideCount}</span>
                  <button
                    onClick={() => setSlideCount(prev => Math.min(20, prev + 1))}
                    className="w-8 h-8 border rounded-lg text-sm hover:bg-gray-50 transition"
                  >
                    +
                  </button>
                </div>
              </>
            )}

            <div className="flex gap-2">
              <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border text-sm rounded-lg hover:bg-gray-50 transition">
                Cancel
              </button>
              <button onClick={handleGenerate} className="flex-1 px-4 py-2 bg-black text-white text-sm rounded-lg hover:bg-gray-800 transition">
                Generate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
