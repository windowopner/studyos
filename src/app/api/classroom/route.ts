import { NextResponse } from 'next/server'
import { requireGoogleToken } from '@/lib/google-server'

type Material = { driveFile?: { driveFile: { id: string; title: string; alternateLink: string } } }

export async function GET() {
  const google = await requireGoogleToken()
  if (!google.ok) return google.response
  const accessToken = google.token

  const coursesRes = await fetch(
    'https://classroom.googleapis.com/v1/courses?courseStates=ACTIVE',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  if (!coursesRes.ok) {
    // 401: the hour-long token expired. 403: Google or the school's admin refused access.
    const message = coursesRes.status === 401
      ? 'Your Google connection expired. Connect Google again in Profile.'
      : 'Google Classroom refused access. Your school may block third-party apps.'
    return NextResponse.json({ error: message, code: 'google_refused' }, { status: coursesRes.status === 401 ? 401 : 403 })
  }
  const coursesData = await coursesRes.json()
  const courses = coursesData.courses || []

  const assignments: object[] = []

  await Promise.all(
    courses.map(async (course: { id: string; name: string }) => {
      const workRes = await fetch(
        `https://classroom.googleapis.com/v1/courses/${course.id}/courseWork`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      const workData = await workRes.json()
      const works = workData.courseWork || []

      works.forEach((work: {
        id: string
        title: string
        description?: string
        maxPoints?: number
        materials?: Material[]
        dueDate?: { year: number; month: number; day: number }
      }) => {
        const attachments = (work.materials || [])
          .filter((m): m is Required<Material> => !!m.driveFile)
          .map((m) => ({
            id: m.driveFile.driveFile.id,
            title: m.driveFile.driveFile.title,
            link: m.driveFile.driveFile.alternateLink,
          }))

        assignments.push({
          classroomId: work.id,
          courseId: course.id,
          title: work.title,
          description: work.description || null,
          courseName: course.name,
          max_points: work.maxPoints || null,
          attachments,
          due_date: work.dueDate
            ? `${work.dueDate.year}-${String(work.dueDate.month).padStart(2, '0')}-${String(work.dueDate.day).padStart(2, '0')}`
            : null,
        })
      })
    })
  )

  return NextResponse.json({ assignments })
}
