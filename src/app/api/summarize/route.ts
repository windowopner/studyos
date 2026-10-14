import { NextResponse } from 'next/server'
import { askClaude } from '@/lib/ai'
import { badRequest, readBody, text } from '@/lib/request'

export async function POST(req: Request) {
  const body = await readBody(req)
  const content = text(body?.content, 30000).trim()
  if (!content) return badRequest('Write something in the note first.')

  const result = await askClaude({
    max_tokens: 300,
    messages: [{
      role: 'user',
      content: `Summarize the following notes in 2-3 concise sentences. Plain text only, no Markdown or headings:\n\n${content}`,
    }],
  })
  if (!result.ok) return result.response

  return NextResponse.json({ summary: result.text.trim() })
}
