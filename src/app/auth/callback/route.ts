import { createSupabaseServer } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=${error}`)
  }

  if (code) {
    const supabase = await createSupabaseServer()
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    if (!exchangeError && data.session?.provider_token) {
      const response = NextResponse.redirect(`${origin}/dashboard`)
      response.cookies.set('google_access_token', data.session.provider_token, {
        httpOnly: true,
        secure: false,
        maxAge: 3600,
      })
      return response
    }
  }

  return NextResponse.redirect(`${origin}/login`)
}
