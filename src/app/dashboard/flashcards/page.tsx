'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

type Deck = {
  id: string
  title: string
  created_at: string
  subjects: { name: string; color: string } | null
  notes: { title: string } | null
  flashcards: { count: number }[]
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
        setDecks(data || [])
        setLoading(false)
      })
  }, [])

  if (loading) return <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading...</div>

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-6" style={{ color: 'var(--text)' }}>Flashcards</h1>

      {decks.length === 0 ? (
        <div className="text-center mt-12">
          <p className="text-sm mb-1" style={{ color: 'var(--text-muted)' }}>No flashcard decks yet.</p>
          <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
            Open a note and click "Generate Flashcards" to create one.
          </p>
          <Link
            href="/dashboard/notes"
            className="inline-block px-4 py-2 text-sm rounded-lg font-medium transition bg-[#4ECDC4] text-[#1c1d22] hover:bg-[#3dbdb5]"
          >
            Go to Notes
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {decks.map(deck => (
            <Link
              key={deck.id}
              href={`/dashboard/flashcards/${deck.id}`}
              className="rounded-xl p-4 border transition-colors hover:border-[#4ECDC4]/40 group"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              {deck.subjects && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full text-white mb-2 inline-block"
                  style={{ backgroundColor: deck.subjects.color }}
                >
                  {deck.subjects.name}
                </span>
              )}
              <h2
                className="font-medium text-sm mb-1 transition-colors group-hover:text-[#4ECDC4]"
                style={{ color: 'var(--text)' }}
              >
                {deck.title}
              </h2>
              {deck.notes && (
                <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                  From: {deck.notes.title}
                </p>
              )}
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {deck.flashcards[0]?.count || 0} cards
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
