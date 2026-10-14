'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Camera, Check, CheckCircle, GoogleLogo } from '@phosphor-icons/react'
import { connectGoogle, disconnectGoogle } from '@/lib/google'
import { useGoogleConnected } from '@/lib/use-google'
import { toast } from '@/components/toaster'
import PageHeader from '@/components/page-header'
import Field, { inputClass } from '@/components/field'
import Avatar from '@/components/avatar'

export default function ProfilePage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const googleConnected = useGoogleConnected()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      setEmail(user.email || '')

      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (data) {
        setName(data.name || '')
        setAvatarUrl(data.avatar_url || '')
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
      toast(`Upload failed: ${error.message}`, 'error')
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

    const { error } = await supabase.from('profiles').update({ name: name.trim() }).eq('id', user.id)
    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleDisconnect = async () => {
    await disconnectGoogle()
    window.location.reload()
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Profile" />

      <section className="glass-panel rounded-2xl p-5 sm:p-6">
        <div className="flex items-center gap-5">
          <button
            onClick={() => fileRef.current?.click()}
            aria-label="Change photo"
            className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl"
          >
            <Avatar key={avatarUrl} src={avatarUrl} name={name} className="h-full w-full text-2xl" />
            <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100">
              {uploading ? <span className="text-xs">Uploading…</span> : <Camera size={20} />}
            </span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />

          <div className="min-w-0">
            <p className="truncate text-lg font-semibold text-[var(--text)]">{name || 'Your profile'}</p>
            <p className="truncate text-sm text-[var(--text-muted)]">{email}</p>
          </div>
        </div>

        <form onSubmit={(event) => { event.preventDefault(); handleSave() }} className="mt-6 flex flex-col gap-5 border-t pt-6">
          <Field label="Display name" htmlFor="display-name">
            <input id="display-name" value={name} onChange={(event) => setName(event.target.value)} className={inputClass} />
          </Field>
          <Field label="Email" htmlFor="email" hint="Comes from your Google account.">
            <input id="email" value={email} disabled className={`${inputClass} cursor-not-allowed opacity-60`} />
          </Field>
          <div>
            <button type="submit" disabled={saving} className="primary-button rounded-xl px-4 py-2 text-sm font-medium">
              {saved ? <><Check size={16} weight="bold" /> Saved</> : saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </section>

      <section className="glass-panel mt-6 rounded-2xl p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-soft)] text-[var(--text-muted)]">
            <GoogleLogo size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-[var(--text)]">Google Classroom</h2>
            <p className="mt-1 text-sm leading-relaxed text-[var(--text-muted)]">
              Optional. Connecting lets StudyOS import Classroom assignments and create Google Docs or Slides.
              Some school accounts block this; everything else works without it.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {googleConnected ? (
                <>
                  <span className="inline-flex items-center gap-1.5 text-sm text-[var(--success)]">
                    <CheckCircle size={16} weight="fill" />
                    Connected in this browser for the next hour
                  </span>
                  <button onClick={handleDisconnect} className="ghost-button text-sm underline-offset-2 hover:underline">Disconnect</button>
                </>
              ) : (
                <button onClick={() => connectGoogle('/dashboard/profile')} className="secondary-button rounded-xl px-4 py-2 text-sm font-medium">
                  Connect Google
                </button>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
