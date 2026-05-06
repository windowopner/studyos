'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

const FREE_FEATURES = [
  'Access to Dashboard overview',
  'Profile management',
]

const PRO_FEATURES = [
  'Unlimited Assignments & To-do',
  'Notes with AI Summary',
  'Flashcard generation',
  'AI Tutor (unlimited)',
  'Google Classroom import',
  'Community chat rooms',
  'Full search',
  'Priority support',
]

export default function PricingPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleUpgrade = async () => {
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const res = await fetch('/api/stripe/checkout', { method: 'POST' })
    const { url, error } = await res.json()

    if (error || !url) {
      console.error('Checkout error:', error)
      setLoading(false)
      return
    }

    window.location.href = url
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16"
      style={{ background: 'var(--background)' }}>

      {/* 헤더 */}
      <div className="text-center mb-12">
        <Link href="/dashboard" className="text-sm mb-6 inline-block transition hover:text-[#4ECDC4]"
          style={{ color: 'var(--text-muted)' }}>
          ← Back to Dashboard
        </Link>
        <h1 className="text-3xl font-semibold mt-2" style={{ color: 'var(--text)' }}>
          Simple, transparent pricing
        </h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
          Start free. Upgrade when you&apos;re ready.
        </p>
      </div>

      {/* 플랜 카드 */}
      <div className="flex flex-col sm:flex-row gap-6 w-full max-w-2xl">

        {/* Free */}
        <div className="flex-1 rounded-2xl border p-6 flex flex-col"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div className="mb-4">
            <span className="text-xs font-medium px-2 py-0.5 rounded-full"
              style={{ background: 'var(--border)', color: 'var(--text-muted)' }}>
              Free
            </span>
            <div className="mt-3 flex items-end gap-1">
              <span className="text-3xl font-bold" style={{ color: 'var(--text)' }}>RM 0</span>
              <span className="text-sm mb-1" style={{ color: 'var(--text-muted)' }}>/month</span>
            </div>
          </div>

          <ul className="flex flex-col gap-2 flex-1 mb-6">
            {FREE_FEATURES.map(f => (
              <li key={f} className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                <span className="text-[#4ECDC4]">✓</span> {f}
              </li>
            ))}
            {PRO_FEATURES.map(f => (
              <li key={f} className="flex items-center gap-2 text-sm line-through opacity-40"
                style={{ color: 'var(--text-muted)' }}>
                <span>✕</span> {f}
              </li>
            ))}
          </ul>

          <div className="text-xs text-center py-2 rounded-xl border"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
            Current plan
          </div>
        </div>

        {/* Pro */}
        <div className="flex-1 rounded-2xl border p-6 flex flex-col relative overflow-hidden"
          style={{ background: 'var(--surface)', borderColor: '#4ECDC4' }}>
          <div className="absolute top-0 right-0 bg-[#4ECDC4] text-[#1c1d22] text-xs font-semibold px-3 py-1 rounded-bl-xl">
            RECOMMENDED
          </div>

          <div className="mb-4">
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[#4ECDC4]/15 text-[#4ECDC4]">
              Pro
            </span>
            <div className="mt-3 flex items-end gap-1">
              <span className="text-3xl font-bold" style={{ color: 'var(--text)' }}>RM 25</span>
              <span className="text-sm mb-1" style={{ color: 'var(--text-muted)' }}>/month</span>
            </div>
          </div>

          <ul className="flex flex-col gap-2 flex-1 mb-6">
            {PRO_FEATURES.map(f => (
              <li key={f} className="flex items-center gap-2 text-sm" style={{ color: 'var(--text)' }}>
                <span className="text-[#4ECDC4]">✓</span> {f}
              </li>
            ))}
          </ul>

          <button
            onClick={handleUpgrade}
            disabled={loading}
            className="w-full py-3 rounded-xl text-sm font-semibold transition bg-[#4ECDC4] text-[#1c1d22] hover:bg-[#3dbdb5] disabled:opacity-50"
          >
            {loading ? 'Redirecting...' : 'Upgrade to Pro'}
          </button>
        </div>
      </div>

      <p className="mt-8 text-xs text-center" style={{ color: 'var(--text-muted)' }}>
        Secured by Stripe. Cancel anytime.
      </p>
    </div>
  )
}
