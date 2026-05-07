'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { spotlightProps } from '@/lib/spotlight'

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
      .then((response) => response.json())
      .then(({ courses }) => {
        setCourses(courses || [])
        setLoading(false)
      })
  }, [])

  if (loading) {
    return <div className="text-sm text-[var(--text-muted)]">Loading...</div>
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <p className="page-kicker">Subjects</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text)]">Course spaces, cleaned up</h1>
      </div>

      {courses.length === 0 ? (
        <div className="empty-card rounded-[28px] px-6 py-12 text-center">
          <p className="text-sm text-[var(--text-muted)]">No active courses found in Google Classroom.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {courses.map((course) => (
            <button
              key={course.id}
              onClick={() => router.push(`/dashboard/subjects/${course.id}`)}
              className="interactive-card rounded-[26px] px-5 py-5 text-left"
              {...spotlightProps}
            >
              <div className="relative z-10">
                <p className="text-base font-semibold text-[var(--text)]">{course.name}</p>
                {course.section && (
                  <p className="mt-2 text-sm text-[var(--text-muted)]">{course.section}</p>
                )}
                {course.subject && (
                  <p className="mt-1 text-sm text-[var(--text-muted)]">{course.subject.trim()}</p>
                )}
                {course.description && (
                  <p className="mt-3 line-clamp-2 text-sm leading-6 text-[var(--text-muted)]">{course.description}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
