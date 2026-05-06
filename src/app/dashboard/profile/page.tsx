'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'

export default function ProfilePage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [plan, setPlan] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setEmail(user.email || '')
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (data) {
        setName(data.name || '')
        setAvatarUrl(data.avatar_url || '')
        setPlan(data.plan || 'free')
      }
    }
    load()
  }, [])

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setUploading(false); return }
    const ext = file.name.split('.').pop()
    const path = `avatars/${user.id}.${ext}`
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (error) { alert('Upload failed: ' + error.message); setUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
    await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id)
    setAvatarUrl(publicUrl)
    setUploading(false)
  }

  const handleSave = async () => {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }
    await supabase.from('profiles').update({ name }).eq('id', user.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const inputStyle = {
    background: 'var(--surface)',
    borderColor: 'var(--border)',
    color: 'var(--text)',
  }

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-semibold mb-8" style={{ color: 'var(--text)' }}>Profile Settings</h1>

      {/* 아바타 + 기본 정보 */}
      <div className="flex items-center gap-4 mb-8">
        <div className="relative group flex-shrink-0">
          {avatarUrl ? (
            <img src={avatarUrl} alt="avatar" className="w-16 h-16 rounded-full object-cover" />
          ) : (
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ background: 'var(--border)' }}
            >
              <span className="text-xl" style={{ color: 'var(--text-muted)' }}>{name?.[0] || '?'}</span>
            </div>
          )}
          <button
            onClick={() => fileRef.current?.click()}
            className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center"
          >
            <span className="text-white text-xs font-medium">{uploading ? '...' : 'Edit'}</span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
        </div>
        <div>
          <p className="font-medium" style={{ color: 'var(--text)' }}>{name}</p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{email}</p>
          <span
            className="text-xs px-2 py-0.5 rounded-full mt-1 inline-block capitalize"
            style={{ background: 'var(--border)', color: 'var(--text-muted)' }}
          >
            {plan} plan
          </span>
        </div>
      </div>

      {/* 폼 */}
      <div className="flex flex-col gap-4">
        <div>
          <label className="text-sm mb-1 block" style={{ color: 'var(--text-muted)' }}>Display Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm outline-none transition focus:border-[#4ECDC4]"
            style={inputStyle}
          />
        </div>

        <div>
          <label className="text-sm mb-1 block" style={{ color: 'var(--text-muted)' }}>Email</label>
          <input
            type="text"
            value={email}
            disabled
            className="w-full border rounded-lg px-3 py-2 text-sm outline-none opacity-50 cursor-not-allowed"
            style={inputStyle}
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 text-sm rounded-lg font-medium transition w-fit disabled:opacity-40 bg-[#4ECDC4] text-[#1c1d22] hover:bg-[#3dbdb5]"
        >
          {saved ? 'Saved ✓' : saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}
