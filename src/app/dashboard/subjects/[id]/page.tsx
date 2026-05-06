'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams } from 'next/navigation'
import Link from 'next/link'

type Course = { id: string; name: string; section: string | null }
type Assignment = { id: string; title: string; due_date: string | null; status: string; priority: number }

const statusLabel: Record<string, string> = { todo: 'To Do', in_progress: 'In Progress', done: 'Done' }
const priorityLabel: Record<number, string> = { 1: 'Low', 2: 'Medium', 3: 'High' }

export default function SubjectPage() {
  const { id } = useParams()
  const [course, setCourse] = useState<Course | null>(null)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const res = await fetch('/api/classroom-courses')
      const { courses } = await res.json()
      const found = courses?.find((c: Course) => c.id === id)
      setCourse(found || null)

      const { data } = await supabase
        .from('assignments')
        .select('*')
        .eq('course_id', id)
        .order('due_date', { ascending: true })
      setAssignments(data || [])

      setLoading(false)
    }
    load()
  }, [id])

  if (loading) return <div className="text-sm text-gray-400">Loading...</div>
  if (!course) return <div className="text-sm text-gray-400">Course not found.</div>

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <Link href="/dashboard/subjects" className="text-xs text-gray-400 hover:text-gray-600">
          Back to Subjects
        </Link>
      </div>

      <h1 className="text-2xl font-semibold">{course.name}</h1>
      {course.section && <p className="text-sm text-gray-400 mt-1 mb-6">{course.section}</p>}

      <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
        Assignments ({assignments.length})
      </h2>

      {assignments.length === 0 ? (
        <p className="text-sm text-gray-400">No assignments imported for this course yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {assignments.map(a => (
            <Link key={a.id} href={`/dashboard/assignments/${a.id}`} className="border rounded-xl p-4 hover:bg-gray-50 transition">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-400">{priorityLabel[a.priority]} priority</span>
                <span className="text-xs text-gray-400">
                  {a.due_date ? `Due ${new Date(a.due_date).toLocaleDateString()}` : 'No due date'}
                </span>
              </div>
              <p className="font-medium text-sm">{a.title}</p>
              <div className="mt-2">
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  a.status === 'done' ? 'bg-green-100 text-green-700' :
                  a.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {statusLabel[a.status]}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
