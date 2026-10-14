'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import {
  BookOpen,
  Cards,
  CaretUpDown,
  ChatCircleText,
  CheckSquare,
  ClipboardText,
  House,
  List,
  MagnifyingGlass,
  Moon,
  NotePencil,
  SignOut,
  Sun,
  UserCircle,
  UsersThree,
  X,
  type Icon,
} from '@phosphor-icons/react'
import { supabase } from '@/lib/supabase'
import { disconnectGoogle } from '@/lib/google'
import Toaster from '@/components/toaster'
import Avatar from '@/components/avatar'

type Profile = {
  name: string | null
  avatar_url: string | null
}

type NavItem = { href: string; label: string; icon: Icon }

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Home', icon: House },
  { href: '/dashboard/search', label: 'Search', icon: MagnifyingGlass },
  { href: '/dashboard/assignments', label: 'Assignments', icon: ClipboardText },
  { href: '/dashboard/todo', label: 'To-do', icon: CheckSquare },
  { href: '/dashboard/notes', label: 'Notes', icon: NotePencil },
  { href: '/dashboard/flashcards', label: 'Flashcards', icon: Cards },
  { href: '/dashboard/tutor', label: 'AI Tutor', icon: ChatCircleText },
  { href: '/dashboard/subjects', label: 'Subjects', icon: BookOpen },
  { href: '/dashboard/community', label: 'Community', icon: UsersThree },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { resolvedTheme, setTheme } = useTheme()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [showMenu, setShowMenu] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
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


  // Escape closes the mobile drawer.
  useEffect(() => {
    if (!mobileNav) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setMobileNav(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mobileNav])

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  const handleLogout = async () => {
    await disconnectGoogle()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const isDark = mounted && resolvedTheme === 'dark'

  const sidebar = (
    <>
      <Link href="/dashboard" className="flex items-center gap-2.5 px-2 py-1">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent)] text-sm font-semibold text-[var(--on-accent)]">
          S
        </span>
        <span className="text-[15px] font-semibold tracking-tight text-[var(--text)]">StudyOS</span>
      </Link>

      <nav className="mt-6 flex-1 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: NavIcon }) => {
          const active = isActive(href)
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              onClick={() => setMobileNav(false)}
              className={`group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm ${
                active
                  ? 'bg-[var(--surface-soft)] font-medium text-[var(--text)]'
                  : 'text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]'
              }`}
            >
              {active && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-[var(--accent)]" />}
              <NavIcon
                size={18}
                weight={active ? 'fill' : 'regular'}
                className={`shrink-0 transition-transform duration-200 group-hover:scale-110 ${active ? 'text-[var(--accent)]' : ''}`}
              />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="mt-4 space-y-1 border-t pt-4">
        <button
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
          {mounted ? (isDark ? 'Light mode' : 'Dark mode') : 'Theme'}
        </button>

        <div ref={menuRef} className="relative">
          <button
            onClick={() => setShowMenu((value) => !value)}
            aria-expanded={showMenu}
            className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-[var(--surface-hover)]"
          >
            <Avatar src={profile?.avatar_url} name={profile?.name} className="h-8 w-8 shrink-0 rounded-lg text-sm" />
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--text)]">
              {profile?.name || 'Profile'}
            </span>
            <CaretUpDown size={14} className="text-[var(--text-muted)]" />
          </button>

          {showMenu && (
            <div className="glass-panel absolute inset-x-0 bottom-[calc(100%+0.5rem)] z-20 rounded-xl p-1 shadow-[var(--shadow-pop)]">
              <Link
                href="/dashboard/profile"
                onClick={() => { setShowMenu(false); setMobileNav(false) }}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-hover)]"
              >
                <UserCircle size={16} />
                Profile
              </Link>
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-[var(--danger)] hover:bg-[var(--surface-hover)]"
              >
                <SignOut size={16} />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )

  return (
    <div className="min-h-[100dvh] lg:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-[100dvh] w-60 shrink-0 flex-col border-r bg-[var(--surface)] px-3 py-5 lg:flex">
        {sidebar}
      </aside>

      {/* Mobile top bar and drawer */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b bg-[var(--surface-strong)] px-4 py-3 backdrop-blur lg:hidden">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--accent)] text-xs font-semibold text-[var(--on-accent)]">S</span>
          <span className="text-sm font-semibold text-[var(--text)]">StudyOS</span>
        </Link>
        <button
          onClick={() => setMobileNav(true)}
          aria-label="Open menu"
          className="rounded-lg p-2 text-[var(--text)] hover:bg-[var(--surface-hover)]"
        >
          <List size={20} />
        </button>
      </div>
      {mobileNav && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button aria-label="Close menu" className="absolute inset-0 bg-black/30" onClick={() => setMobileNav(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-[var(--surface)] px-3 py-5 shadow-[var(--shadow-pop)]">
            <button
              onClick={() => setMobileNav(false)}
              aria-label="Close menu"
              className="absolute right-3 top-4 rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
            >
              <X size={18} />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <main className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-8 lg:pt-10">
          {children}
        </main>
      </div>
      <Toaster />
    </div>
  )
}
