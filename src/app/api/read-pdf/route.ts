import { NextResponse } from 'next/server'
import { askClaude } from '@/lib/ai'
import { googleFailure, requireGoogleToken } from '@/lib/google-server'
import { badRequest, readBody, text } from '@/lib/request'

export const maxDuration = 60

// Claude reads PDFs up to 32 MB; stay well under that.
const MAX_BYTES = 20 * 1024 * 1024

export async function POST(req: Request) {
  const google = await requireGoogleToken()
  if (!google.ok) return google.response

  const body = await readBody(req)
  const fileId = text(body?.fileId, 200)
  if (!/^[\w-]+$/.test(fileId)) return badRequest('That attachment has no readable file.')
  const assignmentTitle = text(body?.assignmentTitle, 300)
  const assignmentDescription = text(body?.assignmentDescription, 4000)

  const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${google.token}` },
    cache: 'no-store',
  }).catch(() => null)
  if (!fileRes) return NextResponse.json({ error: 'Could not reach Google Drive.' }, { status: 502 })
  if (!fileRes.ok) return googleFailure(fileRes.status, 'Could not download this file. Only PDFs can be summarized.')

  if (!(fileRes.headers.get('content-type') || '').includes('pdf')) {
    return NextResponse.json({ error: 'Only PDF attachments can be summarized.' }, { status: 415 })
  }
  const arrayBuffer = await fileRes.arrayBuffer()
  if (arrayBuffer.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: 'This PDF is too large to summarize (20 MB max).' }, { status: 413 })
  }

  const result = await askClaude({
    max_tokens: 4000,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: Buffer.from(arrayBuffer).toString('base64') },
        },
        {
          type: 'text',
          text: `This is an attachment for the assignment: "${assignmentTitle}".
${assignmentDescription ? `Assignment description: ${assignmentDescription}` : ''}

Summarize the key points of this document and explain what the student needs to do for this assignment. Plain text only, no Markdown.`,
        },
      ],
    }],
  })
  if (!result.ok) return result.response

  return NextResponse.json({ summary: result.text.trim() })
}
