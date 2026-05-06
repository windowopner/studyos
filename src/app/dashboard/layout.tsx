'use client'

import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import { useTheme } from 'next-themes'

type Profile = {
  name: string | null
  avatar_url: string | null
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { resolvedTheme, setTheme } = useTheme()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [showMenu, setShowMenu] = useState(false)
  const [mounted, setMounted] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('profiles').select('name, avatar_url').eq('id', user.id).single()
      setProfile(data)
    }
    load()
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const navItems = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/dashboard/search', label: 'Search' },
    { href: '/dashboard/assignments', label: 'Assignments' },
    { href: '/dashboard/todo', label: 'To-do' },
    { href: '/dashboard/notes', label: 'Notes' },
    { href: '/dashboard/flashcards', label: 'Flashcards' },
    { href: '/dashboard/tutor', label: 'AI Tutor' },
    { href: '/dashboard/subjects', label: 'Subjects' },
    { href: '/dashboard/community', label: 'Community' },
  ]

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 border-r border-[#2c2d32] bg-[#1c1d22] flex flex-col">

        {/* 로고 */}
        <div className="px-6 py-5 border-b border-[#2c2d32]">
          <span className="font-semibold text-base tracking-tight text-white">StudyOS</span>
        </div>

        {/* 내비게이션 */}
        <nav className="flex flex-col gap-0.5 p-3 flex-1">
          {navItems.map(({ href, label }) => {
            const active = isActive(href)
            return (
              <Link
                key={href}
                href={href}
                className={`px-3 py-2 rounded-md text-sm transition-colors ${
                  active
                    ? 'text-[#4ECDC4] bg-[#4ECDC4]/10 font-medium'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {label}
              </Link>
            )
          })}
        </nav>

        {/* 테마 전환 버튼 */}
        <div className="px-3 pb-2">
          <button
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <span className="text-base leading-none">
              {mounted ? (resolvedTheme === 'dark' ? '☀️' : '🌙') : '☀️'}
            </span>
            <span>{mounted ? (resolvedTheme === 'dark' ? 'Light mode' : 'Dark mode') : 'Light mode'}</span>
          </button>
        </div>

        {/* 프로필 */}
        <div className="p-3 border-t border-[#2c2d32]" ref={menuRef}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-white/5 transition-colors"
          >
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="avatar" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-[#2c2d32] flex items-center justify-center flex-shrink-0">
                <span className="text-xs text-gray-300">{profile?.name?.[0] || '?'}</span>
              </div>
            )}
            <span className="text-sm text-gray-300 truncate flex-1 text-left">
              {profile?.name?.split(' ')[0] || 'Profile'}
            </span>
            <span className="text-gray-600 text-xs">{showMenu ? '▲' : '▼'}</span>
          </button>

          {showMenu && (
            <div className="mt-1 bg-[#25262b] border border-[#2c2d32] rounded-lg overflow-hidden">
              <Link
                href="/dashboard/profile"
                onClick={() => setShowMenu(false)}
                className="block px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 transition-colors"
              >
                Profile Settings
              </Link>
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-white/5 transition-colors"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </aside>

      <main className="flex-1 p-8 bg-[#1c1d22]">
        {children}
      </main>
    </div>
  )
}
