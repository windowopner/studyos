'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { CaretRight, Lock, Plus } from '@phosphor-icons/react'
import PageHeader from '@/components/page-header'
import Field, { inputClass } from '@/components/field'
import { toast } from '@/components/toaster'

type Room = {
  id: string
  name: string
  description: string | null
  created_at: string
  password: string | null
}

export default function CommunityPage() {
  const router = useRouter()
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [password, setPassword] = useState('')
  const [enteredPassword, setEnteredPassword] = useState('')
  const [passwordError, setPasswordError] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('chat_rooms')
        .select('id, name, description, created_at, password')
        .order('created_at', { ascending: false })

      setRooms(data || [])
      setLoading(false)
    }

    load()
  }, [])

  const fetchRooms = async () => {
    const { data } = await supabase
      .from('chat_rooms')
      .select('id, name, description, created_at, password')
      .order('created_at', { ascending: false })

    setRooms(data || [])
    setLoading(false)
  }

  const handleCreate = async () => {
    if (!name.trim()) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setSaving(false)
      return
    }

    const { error } = await supabase.from('chat_rooms').insert({
      name: name.trim(),
      description: description.trim() || null,
      created_by: user.id,
      password: password || null,
    })

    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    setShowModal(false)
    setName('')
    setDescription('')
    setPassword('')
    fetchRooms()
  }

  const handleRoomClick = (room: Room) => {
    if (!room.password) {
      router.push(`/dashboard/community/${room.id}`)
      return
    }

    const unlocked = JSON.parse(localStorage.getItem('unlocked_rooms') || '[]')
    if (unlocked.includes(room.id)) {
      router.push(`/dashboard/community/${room.id}`)
      return
    }

    setSelectedRoom(room)
    setEnteredPassword('')
    setPasswordError(false)
    setShowPasswordModal(true)
  }

  const handlePasswordSubmit = () => {
    if (!selectedRoom) return

    if (enteredPassword === selectedRoom.password) {
      const unlocked = JSON.parse(localStorage.getItem('unlocked_rooms') || '[]')
      if (!unlocked.includes(selectedRoom.id)) {
        unlocked.push(selectedRoom.id)
        localStorage.setItem('unlocked_rooms', JSON.stringify(unlocked))
      }
      router.push(`/dashboard/community/${selectedRoom.id}`)
    } else {
      setPasswordError(true)
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Community"
        description="Study rooms you can chat in with other StudyOS users."
        actions={
          <button onClick={() => setShowModal(true)} className="primary-button rounded-xl px-4 py-2 text-sm font-medium">
            <Plus size={16} weight="bold" />
            New room
          </button>
        }
      />

      {loading ? (
        <div className="space-y-2">{[0, 1, 2].map((row) => <div key={row} className="skeleton h-[76px] rounded-2xl" />)}</div>
      ) : rooms.length === 0 ? (
        <div className="empty-card rounded-2xl px-6 py-14 text-center">
          <p className="text-sm font-medium text-[var(--text)]">No rooms yet</p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Start one for your class or study group.</p>
        </div>
      ) : (
        <ul className="glass-panel divide-y overflow-hidden rounded-2xl">
          {rooms.map((room) => (
            <li key={room.id}>
              <button onClick={() => handleRoomClick(room)} className="group flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-[var(--surface-hover)]">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-soft)] text-sm font-semibold text-[var(--text)]">
                  {room.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-[var(--text)]">{room.name}</span>
                    {room.password && <Lock size={13} className="shrink-0 text-[var(--text-muted)]" aria-label="Password protected" />}
                  </span>
                  {room.description && <span className="mt-0.5 block truncate text-sm text-[var(--text-muted)]">{room.description}</span>}
                </span>
                <span className="hidden shrink-0 font-mono text-xs text-[var(--text-muted)] sm:block">
                  {new Date(room.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
                <CaretRight size={14} className="shrink-0 text-[var(--text-muted)] transition-transform group-hover:translate-x-0.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-[2px]" onClick={() => setShowModal(false)}>
          <div className="glass-panel w-full max-w-sm rounded-2xl p-6 shadow-[var(--shadow-pop)]" onClick={(event) => event.stopPropagation()}>
            <h2 className="text-lg font-semibold text-[var(--text)]">New room</h2>
            <div className="mt-5 space-y-4">
              <Field label="Name" htmlFor="room-name">
                <input id="room-name" autoFocus value={name} onChange={(event) => setName(event.target.value)} className={inputClass} />
              </Field>
              <Field label="Description" htmlFor="room-description" hint="Optional.">
                <textarea id="room-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={3} className={`${inputClass} resize-none`} />
              </Field>
              <Field label="Password" htmlFor="room-password" hint="Optional. Leave empty for an open room.">
                <input id="room-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} className={inputClass} />
              </Field>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setShowModal(false)}
                className="secondary-button flex-1 rounded-xl px-4 py-2 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={saving || !name.trim()}
                className="primary-button flex-1 rounded-xl px-4 py-2 text-sm font-medium"
              >
                {saving ? 'Creating…' : 'Create room'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-[2px]" onClick={() => setShowPasswordModal(false)}>
          <div className="glass-panel w-full max-w-sm rounded-2xl p-6 shadow-[var(--shadow-pop)]" onClick={(event) => event.stopPropagation()}>
            <h2 className="text-lg font-semibold text-[var(--text)]">{selectedRoom?.name}</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">This room has a password.</p>

            <label htmlFor="join-password" className="sr-only">Password</label>
            <input
              id="join-password"
              autoFocus
              type="password"
              placeholder="Password"
              value={enteredPassword}
              onChange={(event) => {
                setEnteredPassword(event.target.value)
                setPasswordError(false)
              }}
              onKeyDown={(event) => event.key === 'Enter' && handlePasswordSubmit()}
              className="field-input mt-4 w-full rounded-xl px-4 py-3 text-sm"
              style={passwordError ? { borderColor: 'var(--danger)' } : undefined}
            />

            {passwordError ? (
              <p className="mt-2 text-xs text-[var(--danger)]">Incorrect password.</p>
            ) : null}

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setShowPasswordModal(false)}
                className="secondary-button flex-1 rounded-xl px-4 py-2 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handlePasswordSubmit}
                className="primary-button flex-1 rounded-xl px-4 py-2 text-sm font-medium"
              >
                Join
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
