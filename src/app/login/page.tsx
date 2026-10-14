'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Cards, ChatCircleText, ClipboardText, GoogleLogo, NotePencil, type Icon } from '@phosphor-icons/react'
import { signInWithGoogle } from '@/lib/google'

const features: { icon: Icon; title: string; text: string }[] = [
  { icon: ClipboardText, title: 'Assignments', text: 'Deadlines in one list, overdue work first.' },
  { icon: NotePencil, title: 'Notes', text: 'Notes sorted by subject, searchable.' },
  { icon: Cards, title: 'Flashcards', text: 'Decks to review before a test.' },
  { icon: ChatCircleText, title: 'AI tutor', text: 'Questions answered with your work as context.' },
]

function SignInButton() {
  const params = useSearchParams()
  const [pending, setPending] = useState(false)
  const failed = params.get('error')

  return (
    <>
      <button
        onClick={async () => {
          setPending(true)
          await signInWithGoogle()
        }}
        disabled={pending}
        className="primary-button w-full rounded-xl px-5 py-3 text-sm font-medium"
      >
        <GoogleLogo size={18} weight="bold" />
        {pending ? 'Opening Google…' : 'Continue with Google'}
      </button>
      {failed && (
        <p role="alert" className="mt-3 text-sm text-[var(--danger)]">
          Sign-in didn&apos;t finish. Please try again.
        </p>
      )}
    </>
  )
}

export default function LoginPage() {
  return (
    <div className="grid min-h-[100dvh] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <section className="flex flex-col justify-between px-6 py-8 sm:px-12 lg:py-12">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent)] text-sm font-semibold text-[var(--on-accent)]">
            S
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-[var(--text)]">StudyOS</span>
        </div>

        <div className="my-16 max-w-sm">
          <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight text-[var(--text)]">
            Your schoolwork, in one place.
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

        <span aria-hidden />
      </section>

      <section className="hidden border-l bg-[var(--surface)] lg:flex lg:items-center lg:justify-center lg:px-12">
        <ul className="grid w-full max-w-lg grid-cols-2 gap-x-8 gap-y-10">
          {features.map(({ icon: FeatureIcon, title, text }) => (
            <li key={title} className="group">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border bg-[var(--background)] text-[var(--accent)] transition-transform duration-300 group-hover:-translate-y-0.5">
                <FeatureIcon size={20} />
              </span>
              <p className="mt-4 text-sm font-medium text-[var(--text)]">{title}</p>
              <p className="mt-1 text-sm leading-relaxed text-[var(--text-muted)]">{text}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
