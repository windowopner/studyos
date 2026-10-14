import { NextResponse } from 'next/server'
import { askClaude } from '@/lib/ai'
import { requireGoogleToken } from '@/lib/google-server'

export const maxDuration = 60

type PageElement = { objectId: string; shape?: { placeholder?: { type?: string } } }

export async function POST(req: Request) {
  const google = await requireGoogleToken()
  if (!google.ok) return google.response
  const accessToken = google.token

  const { title, description, type, slideCount = 6 } = await req.json()

  const slidePrompt = `You are a Year 9 student submitting this assignment. Write the actual content as if you are the student completing it.

Assignment title: ${title}
Assignment instructions: ${description || 'No description'}

Create ${slideCount} slides including a title slide. The first slide is the title slide with your name as "Student".
For the remaining slides, write actual content that completes the assignment - not instructions about what to do.

Keep each body to maximum 4 bullet points, each bullet under 10 words. Return ONLY a JSON array with no markdown, no backticks:
[{"title":"slide title","body":"max 4 short bullet points, each under 10 words"},...]`

  const docPrompt = `You are a Year 9 student submitting this assignment. Write the actual completed work as if you are the student handing it in.

Assignment title: ${title}
Assignment instructions: ${description || 'No description'}

Write the full submission directly. Do not describe what you will write or list instructions. Just write the actual content.
Plain text only, no markdown.`

  const result = await askClaude({
    max_tokens: 4000,
    messages: [{ role: 'user', content: type === 'slides' ? slidePrompt : docPrompt }],
  })
  if (!result.ok) return result.response

  const raw = result.text.trim()

  if (type === 'slides') {
    let slides: { title: string; body: string }[] = []
    try {
      const cleaned = raw.replace(/```json|```/g, '').trim()
      slides = JSON.parse(cleaned)
    } catch {
      slides = [{ title, body: raw.slice(0, 300) }]
    }

    const createRes = await fetch('https://slides.googleapis.com/v1/presentations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    })
    const presentation = await createRes.json()
    const presentationId = presentation.presentationId

    const requests: object[] = []

    slides.forEach((slide, i) => {
      if (i === 0) {
        const titleEl = presentation.slides[0].pageElements?.find(
          (el: PageElement) => el.shape?.placeholder?.type === 'CENTERED_TITLE' || el.shape?.placeholder?.type === 'TITLE'
        )
        const bodyEl = presentation.slides[0].pageElements?.find(
          (el: PageElement) => el.shape?.placeholder?.type === 'BODY' || el.shape?.placeholder?.type === 'SUBTITLE'
        )
        if (titleEl) requests.push({ insertText: { objectId: titleEl.objectId, text: slide.title } })
        if (bodyEl) requests.push({ insertText: { objectId: bodyEl.objectId, text: slide.body } })
      } else {
        const newSlideId = `slide_${i}`
        const titleId = `title_${i}`
        const bodyId = `body_${i}`
        requests.push({
          createSlide: {
            objectId: newSlideId,
            insertionIndex: i,
            slideLayoutReference: { predefinedLayout: 'TITLE_AND_BODY' },
            placeholderIdMappings: [
              { layoutPlaceholder: { type: 'TITLE', index: 0 }, objectId: titleId },
              { layoutPlaceholder: { type: 'BODY', index: 0 }, objectId: bodyId },
            ],
          }
        })
        requests.push({ insertText: { objectId: titleId, text: slide.title } })
        requests.push({ insertText: { objectId: bodyId, text: slide.body } })
      }
    })

    await fetch(`https://slides.googleapis.com/v1/presentations/${presentationId}:batchUpdate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests }),
    })

    return NextResponse.json({ url: `https://docs.google.com/presentation/d/${presentationId}/edit`, type: 'slides' })
  } else {
    const createRes = await fetch('https://docs.googleapis.com/v1/documents', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    })
    const doc = await createRes.json()
    const documentId = doc.documentId

    await fetch(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: [{ insertText: { location: { index: 1 }, text: raw } }] }),
    })

    return NextResponse.json({ url: `https://docs.google.com/document/d/${documentId}/edit`, type: 'doc' })
  }
}
