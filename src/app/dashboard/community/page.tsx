'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { spotlightProps } from '@/lib/spotlight'

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

    await supabase.from('chat_rooms').insert({
      name,
      description: description || null,
      created_by: user.id,
      password: password || null,
    })

    setSaving(false)
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

  if (loading) {
    return <div className="text-sm text-[var(--text-muted)]">Loading...</div>
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="page-kicker">Community</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text)]">Community</h1>
        </div>

        <button onClick={() => setShowModal(true)} className="primary-button rounded-2xl px-5 py-3 text-sm font-semibold">
          New Room
        </button>
      </div>

      {rooms.length === 0 ? (
        <div className="empty-card rounded-[28px] px-6 py-12 text-center">
          <p className="text-sm text-[var(--text-muted)]">No rooms yet. Create one!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rooms.map((room) => (
            <button
              key={room.id}
              onClick={() => handleRoomClick(room)}
              className="interactive-card w-full rounded-[26px] px-5 py-5 text-left"
              {...spotlightProps}
            >
              <div className="relative z-10">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold text-[var(--text)]">{room.name}</h2>
                      {room.password && (
                        <span className="rounded-full border border-white/8 bg-white/5 px-2.5 py-1 text-[11px] text-[var(--text-muted)]">
                          Private
                        </span>
                      )}
                    </div>

                    {room.description && (
                      <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">{room.description}</p>
                    )}
                  </div>

                  <span className="text-[11px] text-[var(--text-muted)]">
                    {new Date(room.created_at).toLocaleDateString()}
                  </span>
                </div>

                <p className="mt-3 text-xs text-[var(--text-muted)]">Created by Anonymous</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="glass-panel w-full max-w-sm rounded-[28px] p-6">
            <h2 className="text-lg font-semibold text-[var(--text)]">New Room</h2>
            <div className="mt-4 space-y-3">
              <input
                type="text"
                placeholder="Room name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="field-input w-full rounded-2xl px-4 py-3 text-sm"
              />
              <textarea
                placeholder="Description (optional)"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
                className="field-input w-full resize-none rounded-2xl px-4 py-3 text-sm"
              />
              <input
                type="password"
                placeholder="Password (optional)"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="field-input w-full rounded-2xl px-4 py-3 text-sm"
              />
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setShowModal(false)}
                className="secondary-button flex-1 rounded-2xl px-4 py-3 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={saving || !name.trim()}
                className="primary-button flex-1 rounded-2xl px-4 py-3 text-sm font-semibold disabled:opacity-40"
              >
                {saving ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="glass-panel w-full max-w-sm rounded-[28px] p-6">
            <h2 className="text-lg font-semibold text-[var(--text)]">Private Room</h2>
            <p className="mt-2 text-sm text-[var(--text-muted)]">Enter the password to join.</p>

            <input
              type="password"
              placeholder="Password"
              value={enteredPassword}
              onChange={(event) => {
                setEnteredPassword(event.target.value)
                setPasswordError(false)
              }}
              onKeyDown={(event) => event.key === 'Enter' && handlePasswordSubmit()}
              className="field-input mt-4 w-full rounded-2xl px-4 py-3 text-sm"
              style={passwordError ? { borderColor: '#f87171' } : undefined}
            />

            {passwordError ? (
              <p className="mt-2 text-xs text-red-400">Incorrect password.</p>
            ) : null}

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setShowPasswordModal(false)}
                className="secondary-button flex-1 rounded-2xl px-4 py-3 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handlePasswordSubmit}
                className="primary-button flex-1 rounded-2xl px-4 py-3 text-sm font-semibold"
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
