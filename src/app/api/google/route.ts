import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { GOOGLE_COOKIE } from '@/lib/google-server'

// Whether this browser has a Google Classroom/Docs connection (an access token from Connect Google).
export async function GET() {
  const cookieStore = await cookies()
  return NextResponse.json({ connected: !!cookieStore.get(GOOGLE_COOKIE)?.value })
}

export async function DELETE() {
  const response = NextResponse.json({ connected: false })
  response.cookies.delete(GOOGLE_COOKIE)
  return response
}
