'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { spotlightProps } from '@/lib/spotlight'

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

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setUploading(false)
      return
    }

    const ext = file.name.split('.').pop()
    const path = `avatars/${user.id}.${ext}`
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (error) {
      alert(`Upload failed: ${error.message}`)
      setUploading(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
    await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id)
    setAvatarUrl(publicUrl)
    setUploading(false)
  }

  const handleSave = async () => {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setSaving(false)
      return
    }

    await supabase.from('profiles').update({ name }).eq('id', user.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <p className="page-kicker">Profile</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text)]">Fine-tune your space</h1>
      </div>

      <section className="glass-panel rounded-[32px] px-6 py-6 sm:px-8 sm:py-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="interactive-card relative h-24 w-24 rounded-[28px]" {...spotlightProps}>
            {avatarUrl ? (
              <img src={avatarUrl} alt="avatar" className="absolute inset-0 h-full w-full rounded-[28px] object-cover" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center rounded-[28px] bg-[rgb(var(--accent-rgb)_/_0.18)] text-3xl font-semibold text-[var(--text)]">
                {name?.[0] || '?'}
              </div>
            )}

            <button
              onClick={() => fileRef.current?.click()}
              className="absolute inset-0 flex items-center justify-center rounded-[28px] bg-black/45 text-xs font-semibold text-white opacity-0 transition hover:opacity-100"
            >
              {uploading ? 'Uploading...' : 'Change'}
            </button>

            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          </div>

          <div>
            <p className="text-xl font-semibold text-[var(--text)]">{name || 'Your profile'}</p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">{email}</p>
            <span className="soft-badge mt-3 rounded-full px-3 py-1.5 text-xs font-medium capitalize">
              {plan} plan
            </span>
          </div>
        </div>

        <div className="mt-8 grid gap-4">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[var(--text-muted)]">Display Name</span>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="field-input w-full rounded-2xl px-4 py-3 text-sm"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[var(--text-muted)]">Email</span>
            <input
              type="text"
              value={email}
              disabled
              className="field-input w-full cursor-not-allowed rounded-2xl px-4 py-3 text-sm opacity-60"
            />
          </label>

          <div className="pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="primary-button rounded-2xl px-5 py-3 text-sm font-semibold disabled:opacity-40"
            >
              {saved ? 'Saved ✓' : saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
