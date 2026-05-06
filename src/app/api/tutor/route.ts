import { NextResponse } from 'next/server'

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

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      system: systemPrompt,
      messages: messages.map((m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content,
      })),
    }),
  })

  const data = await res.json()
  const reply = data.content[0].text
  return NextResponse.json({ reply })
}
