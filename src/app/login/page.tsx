'use client'

import { supabase } from '@/lib/supabase'
import { spotlightProps } from '@/lib/spotlight'

const features = [
  'Assignments, notes, flashcards, and AI tutor in one flow',
  'A calmer dashboard with hover-reactive panels',
  'Google Classroom-friendly setup for daily study work',
]

export default function LoginPage() {
  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: [
          'https://www.googleapis.com/auth/classroom.courses.readonly',
          'https://www.googleapis.com/auth/classroom.coursework.me.readonly',
          'https://www.googleapis.com/auth/classroom.student-submissions.me.readonly',
          'https://www.googleapis.com/auth/classroom.courseworkmaterials.readonly',
          'https://www.googleapis.com/auth/documents',
          'https://www.googleapis.com/auth/presentations',
          'https://www.googleapis.com/auth/drive.file',
          'https://www.googleapis.com/auth/drive.readonly',
        ].join(' '),
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    })
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-10">
      <div className="floating-orb floating-orb--teal left-0 top-16 h-64 w-64" />
      <div className="floating-orb floating-orb--violet right-0 top-24 h-72 w-72" />

      <div className="glass-panel relative z-10 grid w-full max-w-6xl gap-8 rounded-[36px] p-6 sm:p-8 lg:grid-cols-[1.1fr_0.9fr] lg:p-10">
        <section className="flex flex-col justify-between gap-8">
          <div>
            <span className="soft-badge rounded-full px-3 py-1.5 text-xs font-medium">
              Welcome back to StudyOS
            </span>
            <h1 className="mt-6 max-w-xl text-4xl font-semibold tracking-tight text-[var(--text)] sm:text-5xl">
              Study tools that feel a lot more alive.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--text-muted)]">
              We kept your workflow intact and gave the interface more presence — richer depth, cleaner focus, and interactions that respond as you move.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: 'Unified', value: 'Workspace' },
              { label: 'Interactive', value: 'Hover UI' },
              { label: 'Built for', value: 'Daily study' },
            ].map((item) => (
              <div
                key={item.label}
                className="interactive-card rounded-3xl px-4 py-4"
                {...spotlightProps}
              >
                <p className="relative z-10 text-xs uppercase tracking-[0.22em] text-[var(--text-muted)]">
                  {item.label}
                </p>
                <p className="relative z-10 mt-2 text-lg font-semibold text-[var(--text)]">
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <div className="interactive-card rounded-[32px] p-6 sm:p-7" {...spotlightProps}>
            <div className="relative z-10">
              <p className="page-kicker">Get started</p>
              <h2 className="mt-3 text-2xl font-semibold text-[var(--text)]">Sign in with Google</h2>
              <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
                Classroom sync, docs access, and the full StudyOS workspace unlock after one sign-in.
              </p>
            </div>

            <button
              onClick={handleGoogleLogin}
              className="primary-button relative z-10 mt-6 flex w-full items-center justify-center rounded-2xl px-5 py-3.5 text-sm font-semibold"
            >
              Continue with Google
            </button>

            <div className="relative z-10 mt-5 space-y-3">
              {features.map((feature) => (
                <div key={feature} className="flex items-start gap-3 rounded-2xl border border-white/8 bg-white/3 px-4 py-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-[var(--accent)]" />
                  <p className="text-sm leading-6 text-[var(--text-muted)]">{feature}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="interactive-card rounded-3xl px-5 py-5" {...spotlightProps}>
              <p className="relative z-10 text-sm font-medium text-[var(--text)]">Assignments</p>
              <p className="relative z-10 mt-2 text-sm leading-6 text-[var(--text-muted)]">
                Deadlines, priorities, and imports feel clearer at a glance.
              </p>
            </div>
            <div className="interactive-card rounded-3xl px-5 py-5" {...spotlightProps}>
              <p className="relative z-10 text-sm font-medium text-[var(--text)]">AI Tutor</p>
              <p className="relative z-10 mt-2 text-sm leading-6 text-[var(--text-muted)]">
                Ask with context and keep chats in a more focused workspace.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
