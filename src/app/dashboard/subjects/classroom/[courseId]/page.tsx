'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { ArrowLeft } from '@phosphor-icons/react'
import { supabase } from '@/lib/supabase'
import PageHeader from '@/components/page-header'
import AssignmentRow, { type AssignmentRowData } from '@/components/assignment-row'

type Course = { id: string; name: string; section: string | null }

export default function ClassroomCoursePage() {
  const { courseId } = useParams<{ courseId: string }>()
  const [course, setCourse] = useState<Course | null>(null)
  const [error, setError] = useState('')
  const [assignments, setAssignments] = useState<AssignmentRowData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const [response, { data }] = await Promise.all([
        fetch('/api/classroom-courses'),
        supabase.from('assignments').select('id, title, due_date, status').eq('course_id', courseId).order('due_date', { ascending: true, nullsFirst: false }),
      ])
      const body = await response.json()
      if (!response.ok) setError(body.error || 'Could not load Google Classroom.')
      setCourse(body.courses?.find((item: Course) => item.id === courseId) || null)
      setAssignments(data || [])
      setLoading(false)
    }
    load()
  }, [courseId])

  const back = (
    <Link href="/dashboard/subjects" className="group inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)]">
      <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-0.5" />
      Subjects
    </Link>
  )

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="skeleton h-4 w-24" />
        <div className="skeleton h-9 w-1/3" />
        <div className="skeleton h-40 rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader back={back} title={course?.name || 'Classroom course'} description={course?.section || error || undefined} />

      <h2 className="mb-3 text-base font-semibold text-[var(--text)]">Imported assignments</h2>
      {assignments.length === 0 ? (
        <p className="rounded-2xl border border-dashed px-5 py-6 text-sm text-[var(--text-muted)]">
          None yet. Use Import from Classroom on the Assignments page.
        </p>
      ) : (
        <ul className="glass-panel divide-y overflow-hidden rounded-2xl">
          {assignments.map((assignment) => <li key={assignment.id}><AssignmentRow assignment={assignment} /></li>)}
        </ul>
      )}
    </div>
  )
}
