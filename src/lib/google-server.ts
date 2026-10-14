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
