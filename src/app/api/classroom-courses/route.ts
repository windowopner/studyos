import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET() {
  const cookieStore = await cookies()
  const accessToken = cookieStore.get('google_access_token')?.value

  if (!accessToken) {
    return NextResponse.json({ error: 'No access token' }, { status: 401 })
  }

  const res = await fetch(
    'https://classroom.googleapis.com/v1/courses?courseStates=ACTIVE',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  const data = await res.json()
  
  data.courses?.filter((c: any) => c.name === '9B').forEach((c: any) => {
    console.log('9B course:', JSON.stringify(c, null, 2))
  })

  const courses = (data.courses || []).map((c: any) => ({
    id: c.id,
    name: c.name,
    section: c.section || null,
    subject: c.subject || null,
    description: c.description || null,
  }))

  return NextResponse.json({ courses })
}
