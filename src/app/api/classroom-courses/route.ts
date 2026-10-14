import { NextResponse } from 'next/server'
import { googleFailure, requireGoogleToken } from '@/lib/google-server'

export async function GET() {
  const google = await requireGoogleToken()
  if (!google.ok) return google.response

  const res = await fetch('https://classroom.googleapis.com/v1/courses?courseStates=ACTIVE&pageSize=100', {
    headers: { Authorization: `Bearer ${google.token}` },
    cache: 'no-store',
  }).catch(() => null)
  if (!res) return NextResponse.json({ error: 'Could not reach Google Classroom.' }, { status: 502 })
  if (!res.ok) return googleFailure(res.status, 'Google Classroom did not answer. Try again.')
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
