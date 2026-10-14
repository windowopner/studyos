import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { requireUser } from '@/lib/ai'

export const GOOGLE_COOKIE = 'google_access_token'

type TokenResult = { ok: true; token: string } | { ok: false; response: NextResponse }

// Google routes need a signed-in user and a token from Connect Google (it lasts an hour).
export async function requireGoogleToken(): Promise<TokenResult> {
  if (!(await requireUser())) {
    return { ok: false, response: NextResponse.json({ error: 'Sign in first.' }, { status: 401 }) }
  }
  const cookieStore = await cookies()
  const token = cookieStore.get(GOOGLE_COOKIE)?.value
  if (!token) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Connect Google in Profile first.', code: 'google_not_connected' }, { status: 401 }),
    }
  }
  return { ok: true, token }
}

// The same two failures every Google call can hit, explained the same way.
export function googleFailure(status: number, fallback: string) {
  if (status === 401) {
    return NextResponse.json(
      { error: 'Your Google connection expired. Connect Google again in Profile.', code: 'google_refused' },
      { status: 401 }
    )
  }
  if (status === 403) {
    return NextResponse.json(
      { error: 'Google refused access. Your school may block third-party apps.', code: 'google_refused' },
      { status: 403 }
    )
  }
  return NextResponse.json({ error: fallback }, { status: 502 })
}
