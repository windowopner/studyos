'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowCounterClockwise, ArrowLeft, ArrowRight, CheckCircle, Trash } from '@phosphor-icons/react'
import PageHeader from '@/components/page-header'
import LoadError from '@/components/load-error'
import { toast } from '@/components/toaster'

type Card = {
  id: string
  front: string
  back: string
}

export default function FlashcardStudyPage() {
  const { id } = useParams()
  const router = useRouter()
  const [cards, setCards] = useState<Card[]>([])
  const [current, setCurrent] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [done, setDone] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [found, setFound] = useState(true)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true
    const load = async () => {
      const [deckRes, cardsRes] = await Promise.all([
        supabase.from('flashcard_decks').select('title').eq('id', id).maybeSingle(),
        // Cards in the order they were made, so a deck always studies the same way.
        supabase.from('flashcards').select('id, front, back').eq('deck_id', id).order('created_at').order('id'),
      ])
      if (!alive) return
      const badId = deckRes.error?.code === '22P02'
      if ((deckRes.error && !badId) || cardsRes.error && !badId) { setFailed(true); setLoading(false); return }
      setFailed(false)
      setFound(!!deckRes.data)
      setTitle(deckRes.data?.title || '')
      setCards(cardsRes.data || [])
      setLoading(false)
    }
    load()
    return () => { alive = false }
  }, [id, attempt])

  const handleNext = () => {
    setFlipped(false)
    if (current + 1 >= cards.length) {
      setDone(true)
    } else {
      setCurrent(prev => prev + 1)
    }
  }

  const handlePrev = () => {
    setFlipped(false)
    setCurrent(prev => Math.max(0, prev - 1))
  }

  const handleRestart = () => {
    setCurrent(0)
    setFlipped(false)
    setDone(false)
  }

  const handleDelete = async () => {
    if (!confirm('Delete this deck? This cannot be undone.')) return
    setDeleting(true)
    const { error } = await supabase.from('flashcard_decks').delete().eq('id', id)
    if (error) { toast(error.message, 'error'); setDeleting(false); return }
    toast('Deck deleted.', 'success')
    router.push('/dashboard/flashcards')
  }

  // Space flips the card; arrow keys move between cards.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (done || cards.length === 0) return
      const target = event.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      if (event.key === ' ') { event.preventDefault(); setFlipped((value) => !value) }
      if (event.key === 'ArrowRight') handleNext()
      if (event.key === 'ArrowLeft') handlePrev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const back = (
    <Link href="/dashboard/flashcards" className="group inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)]">
      <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-0.5" />
      Flashcards
    </Link>
  )

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="skeleton h-4 w-24" />
        <div className="skeleton h-9 w-1/2" />
        <div className="skeleton h-72 rounded-2xl" />
      </div>
    )
  }

  if (failed) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader back={back} title="Deck" />
        <LoadError message="This deck couldn’t load. Check your connection and try again." onRetry={() => { setLoading(true); setAttempt((value) => value + 1) }} />
      </div>
    )
  }

  if (!found) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader back={back} title="Deck not found" description="It may have been deleted." />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        back={back}
        title={title || 'Deck'}
        actions={
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-[var(--text-muted)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] disabled:opacity-40"
          >
            <Trash size={16} />
            {deleting ? 'Deleting…' : 'Delete deck'}
          </button>
        }
      />

      {cards.length === 0 ? (
        <div className="empty-card rounded-2xl px-6 py-14 text-center">
          <p className="text-sm font-medium text-[var(--text)]">This deck has no cards</p>
        </div>
      ) : done ? (
        <div className="glass-panel rounded-2xl px-6 py-16 text-center">
          <CheckCircle size={36} weight="fill" className="mx-auto text-[var(--success)]" />
          <p className="mt-4 text-lg font-semibold text-[var(--text)]">Deck finished</p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">You went through all {cards.length} cards.</p>
          <button onClick={handleRestart} className="primary-button mt-6 rounded-xl px-5 py-2 text-sm font-medium">
            <ArrowCounterClockwise size={16} />
            Study again
          </button>
        </div>
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between gap-4">
            <span className="font-mono text-sm text-[var(--text-muted)]">{current + 1} / {cards.length}</span>
            <div className="h-1 w-40 overflow-hidden rounded-full bg-[var(--surface-soft)]">
              <div
                className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-300"
                style={{ width: `${((current + 1) / cards.length) * 100}%` }}
              />
            </div>
          </div>

          <button
            onClick={() => setFlipped((value) => !value)}
            aria-label={flipped ? 'Show question' : 'Show answer'}
            className="group block h-72 w-full [perspective:1200px]"
          >
            <span
              className="relative block h-full w-full transition-transform duration-500 [transform-style:preserve-3d] [transition-timing-function:var(--ease-out)]"
              style={{ transform: flipped ? 'rotateY(180deg)' : 'none' }}
            >
              <span className="glass-panel absolute inset-0 flex flex-col items-center justify-center rounded-2xl p-8 [backface-visibility:hidden] group-hover:border-[var(--border-strong)]">
                <span className="text-xs font-medium text-[var(--text-muted)]">Question</span>
                <span className="mt-4 text-center text-xl font-medium leading-snug text-[var(--text)]">{cards[current].front}</span>
                <span className="absolute bottom-5 text-xs text-[var(--text-muted)]">Click or press Space to flip</span>
              </span>
              <span className="glass-panel absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-[var(--surface-soft)] p-8 [backface-visibility:hidden] [transform:rotateY(180deg)]">
                <span className="text-xs font-medium text-[var(--accent)]">Answer</span>
                <span className="mt-4 text-center text-lg leading-relaxed text-[var(--text)]">{cards[current].back}</span>
              </span>
            </span>
          </button>

          <div className="mt-5 flex justify-center gap-2">
            <button onClick={handlePrev} disabled={current === 0} className="secondary-button rounded-xl px-4 py-2 text-sm font-medium">
              <ArrowLeft size={16} />
              Previous
            </button>
            <button onClick={handleNext} className="primary-button rounded-xl px-4 py-2 text-sm font-medium">
              {current + 1 === cards.length ? 'Finish' : 'Next'}
              <ArrowRight size={16} />
            </button>
          </div>
        </>
      )}
    </div>
  )
}
