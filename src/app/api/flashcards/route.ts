import { NextResponse } from 'next/server'
import { askClaude } from '@/lib/ai'
import { badRequest, int, parseJsonArray, readBody, text } from '@/lib/request'

export const maxDuration = 60

export async function POST(req: Request) {
  const body = await readBody(req)
  const content = text(body?.content, 30000).trim()
  const title = text(body?.title, 300)
  const count = int(body?.count, 1, 20, 5)
  if (!content) return badRequest('This note is empty.')

  const result = await askClaude({
    max_tokens: 4000,
    messages: [{
      role: 'user',
      content: `Create exactly ${count} flashcards from the following notes titled "${title}".
Return ONLY a JSON array, no other text, in this exact format:
[{"front": "question or term", "back": "answer or definition"}, ...]

Notes:
${content}`,
    }],
  })
  if (!result.ok) return result.response

  // Keep only well-formed cards, trimmed to sane lengths.
  const cards = (parseJsonArray(result.text) || [])
    .filter((card): card is { front: string; back: string } =>
      !!card && typeof (card as { front?: unknown }).front === 'string' && typeof (card as { back?: unknown }).back === 'string')
    .map((card) => ({ front: card.front.trim().slice(0, 500), back: card.back.trim().slice(0, 1000) }))
    .filter((card) => card.front && card.back)
    .slice(0, count)

  if (cards.length === 0) {
    return NextResponse.json({ error: 'Could not read the flashcards the AI returned. Try again.' }, { status: 502 })
  }
  return NextResponse.json({ cards })
}
