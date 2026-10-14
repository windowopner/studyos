import { NextResponse } from 'next/server'
import { askClaude } from '@/lib/ai'

export const maxDuration = 60

export async function POST(req: Request) {
  const { content, title, count = 5 } = await req.json()

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

  try {
    const cards = JSON.parse(result.text.replace(/```json|```/g, '').trim())
    return NextResponse.json({ cards })
  } catch {
    return NextResponse.json({ error: 'Could not read the flashcards the AI returned. Try again.' }, { status: 502 })
  }
}
