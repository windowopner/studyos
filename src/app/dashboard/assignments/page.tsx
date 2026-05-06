'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

type Assignment = {
  id: string
  title: string
  description: string | null
  due_date: string | null
  status: string
  priority: number
  max_points: number | null
  subjects: any
}

type ClassroomAssignment = {
  classroomId: string
  title: string
  description: string | null
  courseName: string
  due_date: string | null
  max_points: number | null
  selected: boolean
  isPast: boolean
  hasDate: boolean
}

const statusLabel: Record<string, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Done',
}

const priorityLabel: Record<number, string> = {
  1: 'Low',
  2: 'Medium',
  3: 'High',
}

const statusStyle: Record<string, string> = {
  done: 'bg-emerald-500/10 text-emerald-400',
  in_progress: 'bg-blue-500/10 text-blue-400',
  todo: 'bg-white/5 text-[color:var(--text-muted)]',
}

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)
  const [importing, setImporting] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [classroomList, setClassroomList] = useState<ClassroomAssignment[]>([])
  const [showModal, setShowModal] = useState(false)

  const fetchAssignments = () => {
    supabase
      .from('assignments')
      .select('*, subjects(name, color)')
      .order('due_date', { ascending: true })
      .then(({ data }) => {
        setAssignments((data || []) as any)
        setLoading(false)
      })
  }

  useEffect(() => { fetchAssignments() }, [])

  const handleClearAll = async () => {
    if (!confirm('Delete all assignments? This cannot be undone.')) return
    setClearing(true)
    const ids = assignments.map(a => a.id)
    if (ids.length > 0) await supabase.from('assignments').delete().in('id', ids)
    fetchAssignments()
    setClearing(false)
  }

  const handleFetchClassroom = async () => {
    setFetching(true)
    const res = await fetch('/api/classroom')
    if (res.status === 401) {
      alert('Google Classroom access not available. Please sign out and sign in again.')
      setFetching(false)
      return
    }
    const { assignments: raw } = await res.json()
    const today = new Date().toISOString().split('T')[0]
    const list: ClassroomAssignment[] = raw.map((a: Omit<ClassroomAssignment, 'selected' | 'isPast' | 'hasDate'>) => {
      const hasDate = !!a.due_date
      const isPast = hasDate && a.due_date! < today
      return { ...a, isPast, hasDate, selected: hasDate && !isPast }
    })
    setClassroomList(list)
    setShowModal(true)
    setFetching(false)
  }

  const selectGroup = (type: 'upcoming' | 'past' | 'nodate' | 'all' | 'none') => {
    setClassroomList(prev => prev.map(a => {
      if (type === 'all') return { ...a, selected: true }
      if (type === 'none') return { ...a, selected: false }
      if (type === 'upcoming') return { ...a, selected: a.hasDate && !a.isPast }
      if (type === 'past') return { ...a, selected: a.isPast }
      if (type === 'nodate') return { ...a, selected: !a.hasDate }
      return a
    }))
  }

  const handleImport = async () => {
    const selected = classroomList.filter(a => a.selected)
    if (selected.length === 0) return
    setImporting(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setImporting(false); return }

    const courseNames = [...new Set(selected.map(a => a.courseName))]
    const subjectMap: Record<string, string> = {}
    const colors = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899']

    for (let i = 0; i < courseNames.length; i++) {
      const name = courseNames[i]
      const { data: existing } = await supabase.from('subjects').select('id').eq('name', name).eq('profile_id', user.id).single()
      if (existing) {
        subjectMap[name] = existing.id
      } else {
        const { data: created } = await supabase.from('subjects').insert({ profile_id: user.id, name, color: colors[i % colors.length] }).select().single()
        if (created) subjectMap[name] = created.id
      }
    }

    const today = new Date().toISOString().split('T')[0]
    let imported = 0
    for (const a of selected) {
      let priority = 2
      if (a.due_date) {
        const daysLeft = Math.ceil((new Date(a.due_date).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24))
        if (daysLeft <= 3) priority = 3
        else if (daysLeft <= 7) priority = 2
        else priority = 1
      }
      const { error } = await supabase.from('assignments').insert({
        profile_id: user.id,
        title: a.title,
        description: a.description,
        due_date: a.due_date,
        status: 'todo',
        priority,
        max_points: a.max_points,
        subject_id: subjectMap[a.courseName] || null,
        classroom_id: a.classroomId,
      })
      if (!error) imported++
    }

    setImporting(false)
    setShowModal(false)
    alert(`Imported ${imported} assignments.`)
    fetchAssignments()
  }

  const upcoming = classroomList.filter(a => a.hasDate && !a.isPast)
  const past = classroomList.filter(a => a.isPast)
  const noDate = classroomList.filter(a => !a.hasDate)

  if (loading) return <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading...</div>

  return (
    <div className="max-w-3xl mx-auto">

      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--text)' }}>Assignments</h1>
        <div className="flex gap-2 items-center">
          {assignments.length > 0 && (
            <button
              onClick={handleClearAll}
              disabled={clearing}
              className="text-xs text-red-400 hover:text-red-300 transition disabled:opacity-40"
            >
              {clearing ? 'Clearing...' : 'Clear all'}
            </button>
          )}
          <button
            onClick={handleFetchClassroom}
            disabled={fetching}
            className="px-3 py-1.5 text-sm rounded-lg border transition disabled:opacity-40 hover:border-[#4ECDC4]/50 hover:text-[#4ECDC4]"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
          >
            {fetching ? 'Fetching...' : 'Import from Classroom'}
          </button>
          <Link
            href="/dashboard/assignments/new"
            className="px-3 py-1.5 text-sm rounded-lg font-medium transition bg-[#4ECDC4] text-[#1c1d22] hover:bg-[#3dbdb5]"
          >
            New Assignment
          </Link>
        </div>
      </div>

      {/* 리스트 */}
      {assignments.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No assignments yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {assignments.map((a) => (
            <Link
              key={a.id}
              href={`/dashboard/assignments/${a.id}`}
              className="rounded-xl p-4 border transition-colors hover:border-[#4ECDC4]/40 group"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  {a.subjects && (
                    <span className="text-xs px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: a.subjects.color }}>
                      {a.subjects.name}
                    </span>
                  )}
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{priorityLabel[a.priority]} priority</span>
                  {a.max_points && (
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{a.max_points} pts</span>
                  )}
                </div>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {a.due_date ? `Due ${new Date(a.due_date).toLocaleDateString()}` : 'No due date'}
                </span>
              </div>
              <h2 className="font-medium text-sm transition-colors group-hover:text-[#4ECDC4]" style={{ color: 'var(--text)' }}>
                {a.title}
              </h2>
              {a.description && (
                <p className="text-xs mt-1 line-clamp-1" style={{ color: 'var(--text-muted)' }}>{a.description}</p>
              )}
              <div className="mt-2">
                <span className={`text-xs px-2 py-0.5 rounded-full ${statusStyle[a.status]}`}>
                  {statusLabel[a.status]}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Import 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div
            className="rounded-2xl p-6 w-full max-w-lg max-h-[80vh] flex flex-col border"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>Import from Classroom</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-xl leading-none transition hover:text-[#4ECDC4]"
                style={{ color: 'var(--text-muted)' }}
              >
                ×
              </button>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              <button onClick={() => selectGroup('upcoming')} className="text-xs px-3 py-1.5 rounded-full bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition">Upcoming ({upcoming.length})</button>
              <button onClick={() => selectGroup('past')} className="text-xs px-3 py-1.5 rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/20 transition">Past due ({past.length})</button>
              <button onClick={() => selectGroup('nodate')} className="text-xs px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 transition" style={{ color: 'var(--text-muted)' }}>No date ({noDate.length})</button>
              <button onClick={() => selectGroup('all')} className="text-xs px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 transition" style={{ color: 'var(--text-muted)' }}>All</button>
              <button onClick={() => selectGroup('none')} className="text-xs px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 transition" style={{ color: 'var(--text-muted)' }}>None</button>
            </div>

            <div className="overflow-y-auto flex-1 flex flex-col gap-2 mb-4">
              {upcoming.length > 0 && (
                <>
                  <p className="text-xs uppercase tracking-wider mt-1" style={{ color: 'var(--text-muted)' }}>Upcoming</p>
                  {upcoming.map((a) => (
                    <label key={a.classroomId} className="flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition hover:border-[#4ECDC4]/40" style={{ borderColor: 'var(--border)' }}>
                      <input type="checkbox" checked={a.selected} onChange={e => setClassroomList(prev => prev.map(item => item.classroomId === a.classroomId ? { ...item, selected: e.target.checked } : item))} className="mt-0.5 accent-[#4ECDC4]" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{a.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{a.courseName}</span>
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Due {new Date(a.due_date!).toLocaleDateString()}</span>
                          {a.max_points && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{a.max_points} pts</span>}
                        </div>
                      </div>
                    </label>
                  ))}
                </>
              )}
              {past.length > 0 && (
                <>
                  <p className="text-xs uppercase tracking-wider mt-2" style={{ color: 'var(--text-muted)' }}>Past due</p>
                  {past.map((a) => (
                    <label key={a.classroomId} className="flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition hover:border-[#4ECDC4]/40" style={{ borderColor: 'var(--border)' }}>
                      <input type="checkbox" checked={a.selected} onChange={e => setClassroomList(prev => prev.map(item => item.classroomId === a.classroomId ? { ...item, selected: e.target.checked } : item))} className="mt-0.5 accent-[#4ECDC4]" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{a.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{a.courseName}</span>
                          <span className="text-xs text-red-400">Past due · {new Date(a.due_date!).toLocaleDateString()}</span>
                          {a.max_points && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{a.max_points} pts</span>}
                        </div>
                      </div>
                    </label>
                  ))}
                </>
              )}
              {noDate.length > 0 && (
                <>
                  <p className="text-xs uppercase tracking-wider mt-2" style={{ color: 'var(--text-muted)' }}>No due date</p>
                  {noDate.map((a) => (
                    <label key={a.classroomId} className="flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition hover:border-[#4ECDC4]/40" style={{ borderColor: 'var(--border)' }}>
                      <input type="checkbox" checked={a.selected} onChange={e => setClassroomList(prev => prev.map(item => item.classroomId === a.classroomId ? { ...item, selected: e.target.checked } : item))} className="mt-0.5 accent-[#4ECDC4]" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{a.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{a.courseName}</span>
                          {a.max_points && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{a.max_points} pts</span>}
                        </div>
                      </div>
                    </label>
                  ))}
                </>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{classroomList.filter(a => a.selected).length} selected</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm rounded-lg border transition hover:border-[#4ECDC4]/50"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  disabled={importing || classroomList.filter(a => a.selected).length === 0}
                  className="px-4 py-2 text-sm rounded-lg font-medium transition bg-[#4ECDC4] text-[#1c1d22] hover:bg-[#3dbdb5] disabled:opacity-40"
                >
                  {importing ? 'Importing...' : 'Import'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
