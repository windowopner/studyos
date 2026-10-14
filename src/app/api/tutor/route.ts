import { NextResponse } from 'next/server'
import { askClaude } from '@/lib/ai'
import { badRequest, readBody, text } from '@/lib/request'

type Message = { role: 'user' | 'assistant'; content: string }

export async function POST(req: Request) {
  const body = await readBody(req)
  if (!body || !Array.isArray(body.messages)) return badRequest()

  // The last 20 turns, each capped, starting with a user turn as the API requires.
  const messages: Message[] = (body.messages as unknown[])
    .filter((m): m is Message =>
      !!m && ((m as Message).role === 'user' || (m as Message).role === 'assistant') && typeof (m as Message).content === 'string' && !!(m as Message).content.trim())
    .slice(-20)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 8000) }))
  while (messages.length && messages[0].role !== 'user') messages.shift()
  if (!messages.length || messages[messages.length - 1].role !== 'user') return badRequest('Type a question first.')

  const assignment = body.assignment as { title?: unknown; description?: unknown } | null
  const note = body.note as { title?: unknown; content?: unknown } | null

  let systemPrompt = `You are a helpful AI tutor for students. Be concise, clear, and encouraging.
Do not use markdown formatting like **bold**, *italic*, bullet points, or headers.
Write in plain conversational text only.`

  if (assignment && text(assignment.title, 300)) {
    systemPrompt += `\n\nThe student is working on this assignment: "${text(assignment.title, 300)}".`
    const description = text(assignment.description, 4000)
    if (description) systemPrompt += ` Description: ${description}`
  }

  if (note && text(note.title, 300)) {
    systemPrompt += `\n\nRelevant notes: "${text(note.title, 300)}".\n${text(note.content, 20000)}`
  }

  const result = await askClaude({ max_tokens: 1000, system: systemPrompt, messages })
  if (!result.ok) return result.response

  return NextResponse.json({ reply: result.text.trim() })
}
