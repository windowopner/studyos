import { NextResponse } from 'next/server'
import { requireGoogleToken } from '@/lib/google-server'

export async function GET() {
  const google = await requireGoogleToken()
  if (!google.ok) return google.response
  const accessToken = google.token

  const res = await fetch(
    'https://classroom.googleapis.com/v1/courses?courseStates=ACTIVE',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  if (!res.ok) {
    // 401: the hour-long token expired. 403: Google or the school's admin refused access.
    const message = res.status === 401
      ? 'Your Google connection expired. Connect Google again in Profile.'
      : 'Google Classroom refused access. Your school may block third-party apps.'
    return NextResponse.json({ error: message, code: 'google_refused' }, { status: res.status === 401 ? 401 : 403 })
  }
  const data = await res.json()

  const courses = (data.courses || []).map((c: { id: string; name: string; section?: string; subject?: string; description?: string }) => ({
    id: c.id,
    name: c.name,
    section: c.section || null,
    subject: c.subject || null,
    description: c.description || null,
  }))

  return NextResponse.json({ courses })
}
