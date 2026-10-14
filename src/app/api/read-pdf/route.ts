import { NextResponse } from 'next/server'
import { askClaude } from '@/lib/ai'
import { requireGoogleToken } from '@/lib/google-server'

export const maxDuration = 60

export async function POST(req: Request) {
  const google = await requireGoogleToken()
  if (!google.ok) return google.response
  const accessToken = google.token

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

  const result = await askClaude({
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
  })
  if (!result.ok) return result.response

  return NextResponse.json({ summary: result.text })
}
