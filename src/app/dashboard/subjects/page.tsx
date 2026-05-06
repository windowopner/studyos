'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type Course = {
  id: string
  name: string
  section: string | null
  subject: string | null
  description: string | null
}

export default function SubjectsPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/classroom-courses')
      .then(r => r.json())
      .then(({ courses }) => {
        setCourses(courses || [])
        setLoading(false)
      })
  }, [])

  if (loading) return <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading...</div>

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-6" style={{ color: 'var(--text)' }}>Subjects</h1>

      {courses.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          No active courses found in Google Classroom.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {courses.map(c => (
            <button
              key={c.id}
              onClick={() => router.push(`/dashboard/subjects/${c.id}`)}
              className="rounded-xl p-4 text-left border transition-colors hover:border-[#4ECDC4]/40 group"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <p
                className="font-medium text-sm transition-colors group-hover:text-[#4ECDC4]"
                style={{ color: 'var(--text)' }}
              >
                {c.name}
              </p>
              {c.section && (
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{c.section}</p>
              )}
              {c.subject && (
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{c.subject.trim()}</p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
