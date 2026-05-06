'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Room = {
  id: string
  name: string
  description: string | null
  created_at: string
  password: string | null
}

const inputStyle = {
  background: 'var(--surface)',
  borderColor: 'var(--border)',
  color: 'var(--text)',
}

export default function CommunityPage() {
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

  const fetchRooms = async () => {
    const { data } = await supabase
      .from('chat_rooms')
      .select('id, name, description, created_at, password')
      .order('created_at', { ascending: false })
    setRooms(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchRooms() }, [])

  const handleCreate = async () => {
    if (!name.trim()) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }
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
      window.location.href = `/dashboard/community/${room.id}`
      return
    }
    const unlocked = JSON.parse(localStorage.getItem('unlocked_rooms') || '[]')
    if (unlocked.includes(room.id)) {
      window.location.href = `/dashboard/community/${room.id}`
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
      window.location.href = `/dashboard/community/${selectedRoom.id}`
    } else {
      setPasswordError(true)
    }
  }

  if (loading) return <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading...</div>

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--text)' }}>Community</h1>
        <button
          onClick={() => setShowModal(true)}
          className="px-3 py-1.5 text-sm rounded-lg font-medium transition bg-[#4ECDC4] text-[#1c1d22] hover:bg-[#3dbdb5]"
        >
          New Room
        </button>
      </div>

      {rooms.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No rooms yet. Create one!</p>
      ) : (
        <div className="flex flex-col gap-2">
          {rooms.map(room => (
            <button
              key={room.id}
              onClick={() => handleRoomClick(room)}
              className="rounded-xl p-4 border transition-colors hover:border-[#4ECDC4]/40 text-left w-full group"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <h2
                    className="font-medium text-sm transition-colors group-hover:text-[#4ECDC4]"
                    style={{ color: 'var(--text)' }}
                  >
                    {room.name}
                  </h2>
                  {room.password && (
                    <span
                      className="text-xs px-1.5 py-0.5 rounded-full"
                      style={{ background: 'var(--border)', color: 'var(--text-muted)' }}
                    >
                      Private
                    </span>
                  )}
                </div>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {new Date(room.created_at).toLocaleDateString()}
                </span>
              </div>
              {room.description && (
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{room.description}</p>
              )}
              <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>Created by Anonymous</p>
            </button>
          ))}
        </div>
      )}

      {/* New Room 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div
            className="rounded-2xl p-6 w-80 border"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--text)' }}>New Room</h2>
            <input
              type="text"
              placeholder="Room name"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none mb-3 transition focus:border-[#4ECDC4]"
              style={inputStyle}
            />
            <textarea
              placeholder="Description (optional)"
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none mb-3 resize-none transition focus:border-[#4ECDC4]"
              style={inputStyle}
            />
            <input
              type="password"
              placeholder="Password (optional)"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none mb-4 transition focus:border-[#4ECDC4]"
              style={inputStyle}
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 border text-sm rounded-lg transition hover:border-[#4ECDC4]/50"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={saving || !name.trim()}
                className="flex-1 px-4 py-2 text-sm rounded-lg font-medium transition bg-[#4ECDC4] text-[#1c1d22] hover:bg-[#3dbdb5] disabled:opacity-40"
              >
                {saving ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 비밀번호 모달 */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div
            className="rounded-2xl p-6 w-80 border"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <h2 className="text-base font-semibold mb-1" style={{ color: 'var(--text)' }}>Private Room</h2>
            <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>Enter the password to join.</p>
            <input
              type="password"
              placeholder="Password"
              value={enteredPassword}
              onChange={e => { setEnteredPassword(e.target.value); setPasswordError(false) }}
              onKeyDown={e => e.key === 'Enter' && handlePasswordSubmit()}
              className={`w-full border rounded-lg px-3 py-2 text-sm outline-none mb-1 transition ${passwordError ? 'border-red-400' : 'focus:border-[#4ECDC4]'}`}
              style={{ background: 'var(--surface)', color: 'var(--text)', borderColor: passwordError ? undefined : 'var(--border)' }}
            />
            {passwordError
              ? <p className="text-xs text-red-400 mb-3">Incorrect password.</p>
              : <div className="mb-3" />
            }
            <div className="flex gap-2">
              <button
                onClick={() => setShowPasswordModal(false)}
                className="flex-1 px-4 py-2 border text-sm rounded-lg transition hover:border-[#4ECDC4]/50"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
              >
                Cancel
              </button>
              <button
                onClick={handlePasswordSubmit}
                className="flex-1 px-4 py-2 text-sm rounded-lg font-medium transition bg-[#4ECDC4] text-[#1c1d22] hover:bg-[#3dbdb5]"
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
