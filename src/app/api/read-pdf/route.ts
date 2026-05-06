import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export const maxDuration = 60

export async function POST(req: Request) {
  const cookieStore = await cookies()
  const accessToken = cookieStore.get('google_access_token')?.value

  if (!accessToken) {
    return NextResponse.json({ error: 'No access token' }, { status: 401 })
  }

  const { fileId, assignmentTitle, assignmentDescription } = await req.json()

  const fileRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  if (!fileRes.ok) {
    return NextResponse.json({ error: 'Failed to download file' }, { status: 500 })
  }

  const arrayBuffer = await fileRes.arrayBuffer()
  const base64 = Buffer.from(arrayBuffer).toString('base64')

  const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: base64,
            },
          },
          {
            type: 'text',
            text: `This is an attachment for the assignment: "${assignmentTitle}".
${assignmentDescription ? `Assignment description: ${assignmentDescription}` : ''}

Please summarize the key points of this document and explain what the student needs to do for this assignment.`,
          },
        ],
      }],
    }),
  })

  const aiData = await aiRes.json()
  const summary = aiData.content[0].text
  return NextResponse.json({ summary })
}
