import { createSupabaseServer } from '@/lib/supabase-server'
import { GOOGLE_COOKIE } from '@/lib/google-server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  const connectingGoogle = searchParams.get('google') === '1'
  // Only same-site paths, so the redirect can't be pointed at another site.
  const nextParam = searchParams.get('next') || ''
  const next = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/dashboard'

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error)}`)
  }

  if (code) {
    const supabase = await createSupabaseServer()
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    if (!exchangeError && data.session) {
      const response = NextResponse.redirect(`${origin}${next}`)
      // Keep the Google token only when the user asked to connect Classroom/Docs.
      if (connectingGoogle && data.session.provider_token) {
        response.cookies.set(GOOGLE_COOKIE, data.session.provider_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: 3600,
        })
      }
      return response
    }
  }

  return NextResponse.redirect(`${origin}/login?error=sign_in_failed`)
}
