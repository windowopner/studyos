import { NextResponse } from 'next/server'

export const maxDuration = 60

export async function POST(req: Request) {
  const { content, title, count = 5 } = await req.json()

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-5',
      max_tokens: 10000,
      messages: [{
        role: 'user',
        content: `Create exactly ${count} flashcards from the following notes titled "${title}".
Return ONLY a JSON array, no other text, in this exact format:
[{"front": "question or term", "back": "answer or definition"}, ...]

Notes:
${content}`,
      }],
    }),
  })

  const data = await res.json()
  console.log('Claude response:', JSON.stringify(data, null, 2))

  if (!data.content || !data.content[0]) {
    return NextResponse.json({ error: 'No response from Claude', detail: data }, { status: 500 })
  }

  const text = data.content[0].text
  console.log('Raw text:', text)

  try {
    const cards = JSON.parse(text)
    return NextResponse.json({ cards })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to parse cards', text }, { status: 500 })
  }
}
