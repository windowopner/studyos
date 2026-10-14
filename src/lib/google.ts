import { supabase } from '@/lib/supabase'

// Google Classroom, Docs, and Slides are optional. Signing in only asks for name and email;
// these scopes are requested when the user chooses "Connect Google" in Profile.
const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.me.readonly',
  'https://www.googleapis.com/auth/classroom.student-submissions.me.readonly',
  'https://www.googleapis.com/auth/classroom.courseworkmaterials.readonly',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/presentations',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.readonly',
]

export async function signInWithGoogle() {
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams: { prompt: 'select_account' },
    },
  })
}

export async function connectGoogle(next = '/dashboard/profile') {
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback?google=1&next=${encodeURIComponent(next)}`,
      scopes: GOOGLE_SCOPES.join(' '),
      queryParams: { access_type: 'offline', prompt: 'consent' },
    },
  })
}

export async function fetchGoogleStatus(): Promise<boolean> {
  try {
    const res = await fetch('/api/google', { cache: 'no-store' })
    const data = await res.json()
    return !!data.connected
  } catch {
    return false
  }
}

export async function disconnectGoogle() {
  await fetch('/api/google', { method: 'DELETE' })
}
