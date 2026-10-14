'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Cards, ChatCircleText, ClipboardText, GoogleLogo, NotePencil, type Icon } from '@phosphor-icons/react'
import { signInWithGoogle } from '@/lib/google'
import OrbitScene from '@/components/orbit-scene'
import Brand from '@/components/brand'

const features: { icon: Icon; title: string; text: string }[] = [
  { icon: ClipboardText, title: 'Assignments', text: 'Deadlines in one list, overdue work first.' },
  { icon: NotePencil, title: 'Notes', text: 'Notes sorted by subject, searchable.' },
  { icon: Cards, title: 'Flashcards', text: 'Decks to review before a test.' },
  { icon: ChatCircleText, title: 'AI tutor', text: 'Questions answered with your work as context.' },
]

function SignInButton() {
  const params = useSearchParams()
  const [pending, setPending] = useState(false)
  const [startFailed, setStartFailed] = useState(false)
  const failed = params.get('error')

  // Coming back from Google with the browser's Back button restores this page from cache;
  // without this the button would stay stuck on "Opening Google…".
  useEffect(() => {
    const onShow = (event: PageTransitionEvent) => { if (event.persisted) setPending(false) }
    window.addEventListener('pageshow', onShow)
    return () => window.removeEventListener('pageshow', onShow)
  }, [])

  return (
    <>
      <button
        onClick={async () => {
          setPending(true)
          setStartFailed(false)
          const ok = await signInWithGoogle()
          if (!ok) { setPending(false); setStartFailed(true) }
        }}
        disabled={pending}
        className="primary-button w-full rounded-xl px-5 py-3 text-sm font-medium"
      >
        <GoogleLogo size={18} weight="bold" />
        {pending ? 'Opening Google…' : 'Continue with Google'}
      </button>
      {(failed || startFailed) && (
        <p role="alert" className="mt-3 text-sm text-[var(--danger)]">
          Sign-in didn&apos;t finish. Please try again.
        </p>
      )}
    </>
  )
}

export default function LoginPage() {
  return (
    <div className="grid min-h-[100dvh] lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <section className="order-2 flex flex-col justify-between px-6 py-8 sm:px-12 lg:order-1 lg:py-12">
        <Brand href="/login" />

        <div className="my-12 max-w-sm lg:my-16">
          <h1 className="text-4xl font-semibold leading-[1.08] tracking-tight text-[var(--text)] sm:text-[44px]">
            Your schoolwork, in one orbit.
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-[var(--text-muted)]">
            Assignments, notes, flashcards, and an AI tutor that knows what you&apos;re working on.
          </p>
          <div className="mt-8">
            <Suspense fallback={null}>
              <SignInButton />
            </Suspense>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-[var(--text-muted)]">
            Signing in only shares your name and email. Google Classroom is optional and can be connected later in Profile.
          </p>
        </div>

        <ul className="grid max-w-md grid-cols-2 gap-x-6 gap-y-5 lg:hidden">
          {features.map(({ icon: FeatureIcon, title, text }) => (
            <li key={title}>
              <FeatureIcon size={18} className="text-[var(--accent)]" />
              <p className="mt-2 text-sm font-medium text-[var(--text)]">{title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-[var(--text-muted)]">{text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-panel order-1 h-[300px] border-0 sm:h-[380px] lg:order-2 lg:h-auto lg:border-l">
        <div className="absolute inset-0">
          <OrbitScene particles={3200} planetScale={0.16} stars={220} />
        </div>
        <ul className="pointer-events-none absolute inset-x-0 bottom-0 hidden grid-cols-4 gap-3 p-8 lg:grid">
          {features.map(({ icon: FeatureIcon, title, text }) => (
            <li key={title} className="rounded-xl border bg-[var(--surface)] p-4 backdrop-blur-md">
              <FeatureIcon size={18} className="text-[var(--accent)]" />
              <p className="mt-3 text-sm font-medium">{title}</p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">{text}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
