'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { CaretRight, Lock, Plus } from '@phosphor-icons/react'
import PageHeader from '@/components/page-header'
import Field, { inputClass } from '@/components/field'
import { toast } from '@/components/toaster'
import Modal from '@/components/modal'
import LoadError from '@/components/load-error'
import OrbitGlyph from '@/components/orbit-glyph'

type Room = {
  id: string
  name: string
  description: string | null
  created_at: string
  has_password: boolean
}

type JoinResult = { status: 'joined' | 'kicked' | 'password_required' | 'wrong_password'; role?: string; kicked_until?: string }

export default function CommunityPage() {
  const router = useRouter()
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [showCreate, setShowCreate] = useState(false)
  const [lockedRoom, setLockedRoom] = useState<Room | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [password, setPassword] = useState('')
  const [enteredPassword, setEnteredPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [saving, setSaving] = useState(false)
  const [joining, setJoining] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    supabase
      .from('chat_rooms')
      .select('id, name, description, created_at, has_password')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!alive) return
        setFailed(!!error)
        setRooms(data || [])
        setLoading(false)
      })
    return () => { alive = false }
  }, [attempt])

  const handleCreate = async () => {
    if (!name.trim() || saving) return
    setSaving(true)
    const { data: roomId, error } = await supabase.rpc('create_room', {
      p_name: name.trim(),
      p_description: description.trim() || null,
      p_password: password || null,
    })
    setSaving(false)
    if (error || !roomId) { toast(error?.message || 'Could not create the room.', 'error'); return }
    router.push(`/dashboard/community/${roomId}`)
  }

  // Joining happens in the database, which checks the password and whether you're kicked.
  const join = async (room: Room, roomPassword: string | null) => {
    setJoining(room.id)
    const { data, error } = await supabase.rpc('join_room', { p_room: room.id, p_password: roomPassword })
    setJoining(null)
    if (error) { toast(error.message, 'error'); return }
    const result = data as JoinResult
    if (result.status === 'joined') { router.push(`/dashboard/community/${room.id}`); return }
    if (result.status === 'kicked') {
      toast(`You can rejoin this room at ${new Date(result.kicked_until!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`, 'error')
      return
    }
    if (result.status === 'wrong_password') { setPasswordError('That password isn’t right.'); return }
    setEnteredPassword('')
    setPasswordError('')
    setLockedRoom(room)
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Community"
        description="Study rooms you can chat in with other StudyOS users."
        actions={
          <button onClick={() => setShowCreate(true)} className="primary-button rounded-xl px-4 py-2 text-sm font-medium">
            <Plus size={16} weight="bold" />
            New room
          </button>
        }
      />

      {loading ? (
        <div className="space-y-2">{[0, 1, 2].map((row) => <div key={row} className="skeleton h-[76px] rounded-2xl" />)}</div>
      ) : failed ? (
        <LoadError message="Rooms couldn’t load. Check your connection and try again." onRetry={() => { setLoading(true); setAttempt((value) => value + 1) }} />
      ) : rooms.length === 0 ? (
        <div className="empty-card rounded-2xl px-6 py-14 text-center">
          <OrbitGlyph />
          <p className="text-sm font-medium text-[var(--text)]">No rooms yet</p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Start one for your class or study group.</p>
        </div>
      ) : (
        <ul className="glass-panel divide-y overflow-hidden rounded-2xl">
          {rooms.map((room) => (
            <li key={room.id}>
              <button
                onClick={() => join(room, null)}
                disabled={joining === room.id}
                className="group flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-[var(--surface-hover)] disabled:opacity-60"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-soft)] text-sm font-semibold text-[var(--text)]">
                  {room.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-[var(--text)]">{room.name}</span>
                    {room.has_password && <Lock size={13} className="shrink-0 text-[var(--text-muted)]" aria-label="Password protected" />}
                  </span>
                  {room.description && <span className="mt-0.5 block truncate text-sm text-[var(--text-muted)]">{room.description}</span>}
                </span>
                <span className="hidden shrink-0 font-mono text-xs text-[var(--text-muted)] sm:block">
                  {joining === room.id ? 'Joining…' : new Date(room.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
                <CaretRight size={14} className="shrink-0 text-[var(--text-muted)] transition-transform group-hover:translate-x-0.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {showCreate && (
        <Modal title="New room" busy={saving} onClose={() => setShowCreate(false)}>
          <form onSubmit={(event) => { event.preventDefault(); handleCreate() }} className="space-y-4">
            <Field label="Name" htmlFor="room-name">
              <input id="room-name" autoFocus maxLength={80} value={name} onChange={(event) => setName(event.target.value)} className={inputClass} />
            </Field>
            <Field label="Description" htmlFor="room-description" hint="Optional.">
              <textarea id="room-description" maxLength={500} value={description} onChange={(event) => setDescription(event.target.value)} rows={3} className={`${inputClass} resize-none`} />
            </Field>
            <Field label="Password" htmlFor="room-password" hint="Optional. Leave empty for an open room. Share it with people you invite.">
              <input id="room-password" type="password" autoComplete="new-password" maxLength={100} value={password} onChange={(event) => setPassword(event.target.value)} className={inputClass} />
            </Field>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setShowCreate(false)} className="secondary-button flex-1 rounded-xl px-4 py-2 text-sm font-medium">Cancel</button>
              <button type="submit" disabled={saving || !name.trim()} className="primary-button flex-1 rounded-xl px-4 py-2 text-sm font-medium">
                {saving ? 'Creating…' : 'Create room'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {lockedRoom && (
        <Modal title={lockedRoom.name} description="This room has a password." busy={joining === lockedRoom.id} onClose={() => setLockedRoom(null)}>
          <form onSubmit={(event) => { event.preventDefault(); if (enteredPassword) join(lockedRoom, enteredPassword) }}>
            <label htmlFor="join-password" className="sr-only">Password</label>
            <input
              id="join-password"
              autoFocus
              type="password"
              autoComplete="off"
              placeholder="Password"
              value={enteredPassword}
              onChange={(event) => { setEnteredPassword(event.target.value); setPasswordError('') }}
              aria-invalid={!!passwordError}
              className={`field-input w-full rounded-xl px-4 py-3 text-sm ${passwordError ? 'border-[var(--danger)]' : ''}`}
            />
            {passwordError && <p role="alert" className="mt-2 text-xs text-[var(--danger)]">{passwordError}</p>}
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={() => setLockedRoom(null)} className="secondary-button flex-1 rounded-xl px-4 py-2 text-sm font-medium">Cancel</button>
              <button type="submit" disabled={!enteredPassword || joining === lockedRoom.id} className="primary-button flex-1 rounded-xl px-4 py-2 text-sm font-medium">
                {joining === lockedRoom.id ? 'Joining…' : 'Join'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
