'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'

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

  useEffect(() => {
    const load = async () => {
      const { data: deck } = await supabase.from('flashcard_decks').select('title').eq('id', id).single()
      if (deck) setTitle(deck.title)

      const { data } = await supabase.from('flashcards').select('*').eq('deck_id', id)
      setCards(data || [])
      setLoading(false)
    }
    load()
  }, [id])

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
    await supabase.from('flashcard_decks').delete().eq('id', id)
    router.push('/dashboard/flashcards')
  }

  if (loading) return <div className="text-sm text-gray-400">Loading...</div>
  if (cards.length === 0) return <div className="text-sm text-gray-400">No cards in this deck.</div>

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <button onClick={handleDelete} disabled={deleting} className="text-xs text-red-400 hover:text-red-600 transition disabled:opacity-40">
          {deleting ? 'Deleting...' : 'Delete deck'}
        </button>
      </div>

      {done ? (
        <div className="text-center py-16 border rounded-2xl">
          <p className="text-lg font-medium mb-2">All done!</p>
          <p className="text-sm text-gray-400 mb-6">{cards.length} cards reviewed.</p>
          <button onClick={handleRestart} className="px-6 py-2.5 bg-black text-white text-sm rounded-lg hover:bg-gray-800 transition">
            Study again
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-gray-400">{current + 1} / {cards.length}</span>
            <div className="w-48 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-black rounded-full transition-all duration-300"
                style={{ width: `${((current + 1) / cards.length) * 100}%` }}
              />
            </div>
          </div>

          <div
            onClick={() => setFlipped(!flipped)}
            className="border rounded-2xl p-8 min-h-64 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition select-none mb-4"
          >
            <p className="text-xs text-gray-400 mb-4">{flipped ? 'Answer' : 'Question'}</p>
            <p className="text-lg text-center font-medium">
              {flipped ? cards[current].back : cards[current].front}
            </p>
            {!flipped && (
              <p className="text-xs text-gray-400 mt-6">Click to reveal</p>
            )}
          </div>

          <div className="flex gap-3 justify-center">
            <button
              onClick={handlePrev}
              disabled={current === 0}
              className="px-5 py-2.5 border text-sm rounded-lg hover:bg-gray-50 transition disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={handleNext}
              className="px-5 py-2.5 bg-black text-white text-sm rounded-lg hover:bg-gray-800 transition"
            >
              {current + 1 === cards.length ? 'Finish' : 'Next'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
