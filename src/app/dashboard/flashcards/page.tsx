'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { pickJoined, type JoinedRelation } from '@/lib/relations'
import { spotlightProps } from '@/lib/spotlight'
import { ArrowRight } from '@phosphor-icons/react'
import PageHeader from '@/components/page-header'
import LoadError from '@/components/load-error'
import OrbitGlyph from '@/components/orbit-glyph'

type SubjectData = {
  name: string
  color: string
}

type NoteData = {
  title: string
}

type Deck = {
  id: string
  title: string
  created_at: string
  subjects: SubjectData | null
  notes: NoteData | null
  flashcards: { count: number }[]
}

type RawDeck = Omit<Deck, 'subjects' | 'notes'> & {
  subjects: JoinedRelation<SubjectData>
  notes: JoinedRelation<NoteData>
}

export default function FlashcardsPage() {
  const [decks, setDecks] = useState<Deck[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true
    supabase
      .from('flashcard_decks')
      .select('*, subjects(name, color), notes(title), flashcards(count)')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!alive) return
        setFailed(!!error)
        setDecks(((data || []) as RawDeck[]).map((deck) => ({
          ...deck,
          subjects: pickJoined(deck.subjects),
          notes: pickJoined(deck.notes),
        })))
        setLoading(false)
      })
    return () => { alive = false }
  }, [attempt])

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Flashcards" description="Decks made from your notes. Open one to study." />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((card) => <div key={card} className="skeleton h-[150px] rounded-2xl" />)}
        </div>
      ) : failed ? (
        <LoadError message="Your decks couldn’t load. Check your connection and try again." onRetry={() => { setLoading(true); setAttempt((value) => value + 1) }} />
      ) : decks.length === 0 ? (
        <div className="empty-card rounded-2xl px-6 py-14 text-center">
          <OrbitGlyph />
          <p className="text-sm font-medium text-[var(--text)]">No decks yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-[var(--text-muted)]">
            Open a note and choose Make flashcards. The AI turns it into a deck.
          </p>
          <Link href="/dashboard/notes" className="secondary-button mt-5 rounded-xl px-4 py-2 text-sm font-medium">
            Go to notes
          </Link>
        </div>
      ) : (
        <div className="grid gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
          {decks.map((deck) => (
            <Link key={deck.id} href={`/dashboard/flashcards/${deck.id}`} className="group relative block">
              {/* Two cards peeking out behind the deck; they fan out a little on hover. */}
              <span aria-hidden className="absolute inset-x-3 -bottom-2 h-full rounded-2xl border bg-[var(--surface)] transition-transform duration-300 group-hover:translate-y-1 group-hover:rotate-[1.5deg]" />
              <span aria-hidden className="absolute inset-x-1.5 -bottom-1 h-full rounded-2xl border bg-[var(--surface)] transition-transform duration-300 group-hover:translate-y-0.5 group-hover:-rotate-1" />
              <span className="interactive-card relative flex min-h-[150px] flex-col rounded-2xl p-5" {...spotlightProps}>
                {deck.subjects && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: deck.subjects.color }} />
                    {deck.subjects.name}
                  </span>
                )}
                <span className="mt-2 text-base font-semibold text-[var(--text)]">{deck.title}</span>
                {deck.notes && <span className="mt-1 line-clamp-1 text-sm text-[var(--text-muted)]">From {deck.notes.title}</span>}
                <span className="mt-auto flex items-center justify-between pt-4 text-xs text-[var(--text-muted)]">
                  <span className="font-mono">{deck.flashcards[0]?.count || 0} cards</span>
                  <span className="inline-flex items-center gap-1 text-[var(--accent)] opacity-0 transition-opacity group-hover:opacity-100">
                    Study <ArrowRight size={12} />
                  </span>
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
