'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { supabase } from '@/lib/supabase'
import { spotlightProps } from '@/lib/spotlight'

type Profile = {
  name: string | null
  avatar_url: string | null
}

const navItems = [
  { href: '/dashboard', label: 'Dashboard', description: 'At-a-glance overview' },
  { href: '/dashboard/search', label: 'Search', description: 'Find anything instantly' },
  { href: '/dashboard/assignments', label: 'Assignments', description: 'Track deadlines cleanly' },
  { href: '/dashboard/todo', label: 'To-do', description: 'Focus on what matters next' },
  { href: '/dashboard/notes', label: 'Notes', description: 'Capture and review ideas' },
  { href: '/dashboard/flashcards', label: 'Flashcards', description: 'Reinforce key concepts' },
  { href: '/dashboard/tutor', label: 'AI Tutor', description: 'Study with instant help' },
  { href: '/dashboard/subjects', label: 'Subjects', description: 'Browse course spaces' },
  { href: '/dashboard/community', label: 'Community', description: 'Jump into shared rooms' },
]

const sectionMeta = [
  { href: '/dashboard/search', title: 'Search your study universe', description: 'Notes, assignments, and flashcards now sit in one cleaner, faster flow.' },
  { href: '/dashboard/assignments', title: 'Deadlines with more signal', description: 'Scan priorities quickly, then dive into the work that needs you most.' },
  { href: '/dashboard/todo', title: 'A calmer task board', description: 'Progress stays visible while each action feels lighter and easier to check off.' },
  { href: '/dashboard/notes', title: 'Notes that feel alive', description: 'Recent work, summaries, and tags now sit inside a more tactile workspace.' },
  { href: '/dashboard/flashcards', title: 'Active recall, polished', description: 'Decks stand out faster, with more depth and clearer hierarchy.' },
  { href: '/dashboard/tutor', title: 'An AI study desk', description: 'Context, chat history, and prompts now share a more focused, conversational layout.' },
  { href: '/dashboard/subjects', title: 'Course spaces with breathing room', description: 'Subjects are easier to scan, compare, and jump into.' },
  { href: '/dashboard/community', title: 'Rooms with presence', description: 'Shared spaces feel more welcoming, private, and interactive.' },
  { href: '/dashboard/profile', title: 'Your setup, refined', description: 'Profile details sit in a softer editor with clearer emphasis and feedback.' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { resolvedTheme, setTheme } = useTheme()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )

  useEffect(() => {
    const loadProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('profiles')
        .select('name, avatar_url')
        .eq('id', user.id)
        .single()

      setProfile(data)
    }

    loadProfile()
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const currentMeta = useMemo(() => {
    if (pathname === '/dashboard') {
      return {
        title: 'Your study cockpit',
        description: 'The workspace now feels more responsive, layered, and ready for quick action.',
      }
    }

    return sectionMeta.find((item) => pathname.startsWith(item.href)) ?? {
      title: 'StudyOS workspace',
      description: 'A more interactive shell for the work you already do every day.',
    }
  }, [pathname])

  const currentDate = useMemo(
    () => new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    }).format(new Date()),
    []
  )

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-4 lg:px-6 lg:py-6">
      <div className="floating-orb floating-orb--teal left-[-6rem] top-12 h-56 w-56" />
      <div className="floating-orb floating-orb--violet right-[-5rem] top-20 h-64 w-64" />
      <div className="floating-orb floating-orb--teal bottom-0 left-1/3 h-60 w-60" />

      <div className="relative z-10 mx-auto flex w-full max-w-[1600px] flex-col gap-6 lg:flex-row">
        <aside className="glass-panel flex w-full flex-col rounded-[30px] p-4 lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)] lg:w-80 lg:p-5">
          <div
            className="rounded-[26px] border border-white/10 px-5 py-5"
            style={{ background: 'linear-gradient(135deg, rgb(var(--accent-rgb) / 0.18), transparent 62%)' }}
          >
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[rgb(var(--accent-rgb)_/_0.18)] text-base font-semibold text-[var(--text)]">
                S
              </div>
              <div>
                <p className="page-kicker">StudyOS</p>
                <h1 className="mt-1 text-lg font-semibold tracking-tight text-[var(--text)]">Interactive workspace</h1>
              </div>
            </div>
            <p className="text-sm leading-6 text-[var(--text-muted)]">
              Hover around — cards, menus, and actions now respond with more depth and motion.
            </p>
          </div>

          <nav className="mt-4 flex-1 space-y-2 overflow-y-auto pr-1">
            {navItems.map(({ href, label, description }) => {
              const active = isActive(href)

              return (
                <Link
                  key={href}
                  href={href}
                  {...spotlightProps}
                  className="interactive-card block rounded-2xl px-4 py-3"
                  style={active ? {
                    background: 'linear-gradient(135deg, rgb(var(--accent-rgb) / 0.18), var(--surface))',
                    borderColor: 'var(--border-strong)',
                  } : undefined}
                >
                  <div className="relative z-10 flex items-start justify-between gap-3">
                    <div>
                      <p className={`text-sm font-semibold ${active ? 'text-[var(--text)]' : 'text-[var(--text)] opacity-90'}`}>
                        {label}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                        {description}
                      </p>
                    </div>
                    <span
                      className={`mt-1 h-2.5 w-2.5 rounded-full ${
                        active ? 'bg-[var(--accent)] shadow-[0_0_18px_rgb(var(--accent-rgb)_/_0.55)]' : 'bg-white/20'
                      }`}
                    />
                  </div>
                </Link>
              )
            })}
          </nav>

          <div className="mt-4 space-y-3">
            <button
              onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
              className="secondary-button flex w-full items-center justify-between rounded-2xl px-4 py-3 text-sm"
            >
              <span className="font-medium text-[var(--text)]">
                {mounted ? (resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode') : 'Switch theme'}
              </span>
              <span className="text-base leading-none">
                {mounted ? (resolvedTheme === 'dark' ? '☀️' : '🌙') : '✨'}
              </span>
            </button>

            <div ref={menuRef} className="relative">
              <button
                onClick={() => setShowMenu((value) => !value)}
                className="interactive-card flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left"
                {...spotlightProps}
              >
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt="avatar"
                    className="relative z-10 h-10 w-10 rounded-2xl object-cover"
                  />
                ) : (
                  <div className="relative z-10 flex h-10 w-10 items-center justify-center rounded-2xl bg-[rgb(var(--accent-rgb)_/_0.18)] text-sm font-semibold text-[var(--text)]">
                    {profile?.name?.[0] || '?'}
                  </div>
                )}

                <div className="relative z-10 min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--text)]">
                    {profile?.name || 'Profile'}
                  </p>
                  <p className="truncate text-xs text-[var(--text-muted)]">
                    Personal settings and sign out
                  </p>
                </div>

                <span className="relative z-10 text-xs text-[var(--text-muted)]">
                  {showMenu ? '▲' : '▼'}
                </span>
              </button>

              {showMenu && (
                <div className="glass-panel absolute inset-x-0 bottom-[calc(100%+0.75rem)] rounded-2xl p-2">
                  <Link
                    href="/dashboard/profile"
                    onClick={() => setShowMenu(false)}
                    className="block rounded-xl px-3 py-2.5 text-sm text-[var(--text)] hover:bg-white/5"
                  >
                    Profile Settings
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="block w-full rounded-xl px-3 py-2.5 text-left text-sm text-red-400 hover:bg-white/5"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="glass-panel rounded-[30px] px-6 py-6 lg:px-8">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
              <div className="max-w-3xl">
                <p className="page-kicker">Workspace refresh</p>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--text)] sm:text-3xl">
                  {currentMeta.title}
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-muted)] sm:text-[15px]">
                  {currentMeta.description}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="soft-badge rounded-full px-3 py-1.5 text-xs font-medium">
                  Cursor-reactive cards
                </span>
                <span className="soft-badge rounded-full px-3 py-1.5 text-xs font-medium">
                  {currentDate}
                </span>
              </div>
            </div>
          </header>

          <main className="relative pt-6 pb-10">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
