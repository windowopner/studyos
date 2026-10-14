import { NextResponse } from 'next/server'
import { googleFailure, requireGoogleToken } from '@/lib/google-server'

type Material = { driveFile?: { driveFile: { id: string; title: string; alternateLink: string } } }
type CourseWork = {
  id: string
  title: string
  description?: string
  maxPoints?: number
  materials?: Material[]
  dueDate?: { year: number; month: number; day: number }
}

export async function GET() {
  const google = await requireGoogleToken()
  if (!google.ok) return google.response
  const headers = { Authorization: `Bearer ${google.token}` }

  const coursesRes = await fetch('https://classroom.googleapis.com/v1/courses?courseStates=ACTIVE&pageSize=100', { headers, cache: 'no-store' }).catch(() => null)
  if (!coursesRes) return NextResponse.json({ error: 'Could not reach Google Classroom.' }, { status: 502 })
  if (!coursesRes.ok) return googleFailure(coursesRes.status, 'Google Classroom did not answer. Try again.')
  const courses: { id: string; name: string }[] = (await coursesRes.json()).courses || []

  // One course failing (archived, permissions) shouldn't hide the others.
  const perCourse = await Promise.all(courses.map(async (course) => {
    const workRes = await fetch(
      `https://classroom.googleapis.com/v1/courses/${encodeURIComponent(course.id)}/courseWork?pageSize=100`,
      { headers, cache: 'no-store' }
    ).catch(() => null)
    if (!workRes?.ok) return []
    const works: CourseWork[] = (await workRes.json()).courseWork || []
    return works.map((work) => ({
      classroomId: work.id,
      courseId: course.id,
      title: work.title,
      description: work.description || null,
      courseName: course.name,
      max_points: work.maxPoints || null,
      attachments: (work.materials || [])
        .filter((m): m is Required<Material> => !!m.driveFile)
        .map((m) => ({ id: m.driveFile.driveFile.id, title: m.driveFile.driveFile.title, link: m.driveFile.driveFile.alternateLink })),
      due_date: work.dueDate
        ? `${work.dueDate.year}-${String(work.dueDate.month).padStart(2, '0')}-${String(work.dueDate.day).padStart(2, '0')}`
        : null,
    }))
  }))

  return NextResponse.json({ assignments: perCourse.flat() })
}
