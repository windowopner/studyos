import { NextResponse } from 'next/server'
import { askClaude } from '@/lib/ai'

export async function POST(req: Request) {
  const { content } = await req.json()

  const result = await askClaude({
    max_tokens: 300,
    messages: [{
      role: 'user',
      content: `Summarize the following notes in 2-3 concise sentences:\n\n${content}`,
    }],
  })
  if (!result.ok) return result.response

  return NextResponse.json({ summary: result.text })
}
