import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { content } = await req.json()

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `Summarize the following notes in 2-3 concise sentences:\n\n${content}`,
      }],
    }),
  })

  const data = await res.json()
  const summary = data.content[0].text
  return NextResponse.json({ summary })
}
