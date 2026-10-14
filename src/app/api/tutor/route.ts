import { NextResponse } from 'next/server'
import { askClaude } from '@/lib/ai'

export async function POST(req: Request) {
  const { messages, assignment, note } = await req.json()

  let systemPrompt = `You are a helpful AI tutor for students. Be concise, clear, and encouraging. 
Do not use markdown formatting like **bold**, *italic*, bullet points, or headers. 
Write in plain conversational text only.`

  if (assignment) {
    systemPrompt += `\n\nThe student is working on this assignment: "${assignment.title}".`
    if (assignment.description) {
      systemPrompt += ` Description: ${assignment.description}`
    }
  }

  if (note) {
    systemPrompt += `\n\nRelevant notes: "${note.title}".\n${note.content}`
  }

  const result = await askClaude({
    max_tokens: 1000,
    system: systemPrompt,
    messages: messages.map((m: { role: string; content: string }) => ({
      role: m.role,
      content: m.content,
    })),
  })
  if (!result.ok) return result.response

  return NextResponse.json({ reply: result.text })
}
