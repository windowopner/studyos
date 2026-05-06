import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET() {
  const cookieStore = await cookies()
  const accessToken = cookieStore.get('google_access_token')?.value

  if (!accessToken) {
    return NextResponse.json({ error: 'No access token' }, { status: 401 })
  }

  const coursesRes = await fetch(
    'https://classroom.googleapis.com/v1/courses?courseStates=ACTIVE',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
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
        materials?: any[]
        dueDate?: { year: number; month: number; day: number }
      }) => {
        const attachments = (work.materials || [])
          .filter((m: any) => m.driveFile)
          .map((m: any) => ({
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
