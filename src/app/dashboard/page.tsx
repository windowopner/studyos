'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

type Assignment = {
  id: string
  title: string
  due_date: string | null
  status: string
  subjects: { name: string; color: string } | null
}

type Note = {
  id: string
  title: string
  updated_at: string
  subjects: { name: string; color: string } | null
}

export default function DashboardPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles').select('name').eq('id', user.id).single()
      if (profile) setName(profile.name || '')

      const today = new Date().toISOString().split('T')[0]

      const { data: upcoming } = await supabase
        .from('assignments')
        .select('id, title, due_date, status, subjects(name, color)')
        .neq('status', 'done')
        .or(`due_date.gte.${today},due_date.is.null`)
        .order('due_date', { ascending: true })
        .limit(5)
      setAssignments(upcoming || [])

      const { data: recentNotes } = await supabase
        .from('notes')
        .select('id, title, updated_at, subjects(name, color)')
        .order('updated_at', { ascending: false })
        .limit(5)
      setNotes(recentNotes || [])

      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading...</div>

  return (
    <div className="max-w-3xl mx-auto">

      {/* 인사말 */}
      <h1 className="text-2xl font-semibold mb-8" style={{ color: 'var(--text)' }}>
        {name ? `Welcome back, ${name.split(' ')[0]}` : 'Dashboard'}
      </h1>

      <div className="grid grid-cols-2 gap-6">

        {/* Upcoming Assignments */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Upcoming
            </h2>
            <Link
              href="/dashboard/assignments"
              className="text-xs transition-colors hover:text-[#4ECDC4]"
              style={{ color: 'var(--text-muted)' }}
            >
              View all
            </Link>
          </div>

          {assignments.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No upcoming assignments.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {assignments.map(a => (
                <Link
                  key={a.id}
                  href={`/dashboard/assignments/${a.id}`}
                  className="rounded-xl p-3 border transition-colors hover:border-[#4ECDC4]/40 group"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                >
                  {a.subjects && (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full text-white mb-1.5 inline-block"
                      style={{ backgroundColor: a.subjects.color }}
                    >
                      {a.subjects.name}
                    </span>
                  )}
                  <p className="text-sm font-medium transition-colors group-hover:text-[#4ECDC4]"
                    style={{ color: 'var(--text)' }}>
                    {a.title}
                  </p>
                  {a.due_date && (
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                      Due {new Date(a.due_date).toLocaleDateString()}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          )}

          <Link
            href="/dashboard/assignments/new"
            className="mt-3 block text-xs text-center border border-dashed rounded-xl py-2 transition-colors hover:text-[#4ECDC4] hover:border-[#4ECDC4]/50"
            style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}
          >
            + New Assignment
          </Link>
        </div>

        {/* Recent Notes */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Recent Notes
            </h2>
            <Link
              href="/dashboard/notes"
              className="text-xs transition-colors hover:text-[#4ECDC4]"
              style={{ color: 'var(--text-muted)' }}
            >
              View all
            </Link>
          </div>

          {notes.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No notes yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {notes.map(n => (
                <Link
                  key={n.id}
                  href={`/dashboard/notes/${n.id}`}
                  className="rounded-xl p-3 border transition-colors hover:border-[#4ECDC4]/40 group"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                >
                  {n.subjects && (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full text-white mb-1.5 inline-block"
                      style={{ backgroundColor: n.subjects.color }}
                    >
                      {n.subjects.name}
                    </span>
                  )}
                  <p className="text-sm font-medium transition-colors group-hover:text-[#4ECDC4]"
                    style={{ color: 'var(--text)' }}>
                    {n.title}
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    {new Date(n.updated_at).toLocaleDateString()}
                  </p>
                </Link>
              ))}
            </div>
          )}

          <Link
            href="/dashboard/notes/new"
            className="mt-3 block text-xs text-center border border-dashed rounded-xl py-2 transition-colors hover:text-[#4ECDC4] hover:border-[#4ECDC4]/50"
            style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}
          >
            + New Note
          </Link>
        </div>
      </div>

      {/* AI Tutor 배너 */}
      <div
        className="mt-8 rounded-xl p-4 flex items-center justify-between border"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>AI Tutor</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Ask anything about your assignments or notes.
          </p>
        </div>
        <Link
          href="/dashboard/tutor"
          className="px-4 py-2 text-sm rounded-lg font-medium transition-colors bg-[#4ECDC4] text-[#1c1d22] hover:bg-[#3dbdb5]"
        >
          Open
        </Link>
      </div>
    </div>
  )
}
