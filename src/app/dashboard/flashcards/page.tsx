'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { pickJoined, type JoinedRelation } from '@/lib/relations'
import { spotlightProps } from '@/lib/spotlight'

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

  useEffect(() => {
    supabase
      .from('flashcard_decks')
      .select('*, subjects(name, color), notes(title), flashcards(count)')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setDecks(((data || []) as RawDeck[]).map((deck) => ({
          ...deck,
          subjects: pickJoined(deck.subjects),
          notes: pickJoined(deck.notes),
        })))
        setLoading(false)
      })
  }, [])

  if (loading) {
    return <div className="text-sm text-[var(--text-muted)]">Loading...</div>
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <p className="page-kicker">Flashcards</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text)]">Recall, but sharper</h1>
      </div>

      {decks.length === 0 ? (
        <div className="empty-card rounded-[28px] px-6 py-12 text-center">
          <p className="text-sm text-[var(--text-muted)]">No flashcard decks yet.</p>
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            Open a note and click &ldquo;Generate Flashcards&rdquo; to create one.
          </p>
          <Link href="/dashboard/notes" className="primary-button mt-5 inline-block rounded-2xl px-5 py-3 text-sm font-semibold">
            Go to Notes
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {decks.map((deck) => (
            <Link
              key={deck.id}
              href={`/dashboard/flashcards/${deck.id}`}
              className="interactive-card block rounded-[26px] px-5 py-5"
              {...spotlightProps}
            >
              <div className="relative z-10">
                {deck.subjects && (
                  <span
                    className="inline-block rounded-full px-2.5 py-1 text-[11px] font-medium text-white"
                    style={{ backgroundColor: deck.subjects.color }}
                  >
                    {deck.subjects.name}
                  </span>
                )}

                <h2 className="mt-3 text-base font-semibold text-[var(--text)]">{deck.title}</h2>

                {deck.notes && (
                  <p className="mt-2 text-sm text-[var(--text-muted)]">
                    From: {deck.notes.title}
                  </p>
                )}

                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-[var(--text-muted)]">
                    {new Date(deck.created_at).toLocaleDateString()}
                  </span>
                  <span className="rounded-full border border-white/8 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-[var(--text-muted)]">
                    {deck.flashcards[0]?.count || 0} cards
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
