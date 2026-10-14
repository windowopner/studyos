import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'

// Haiku keeps everyday use cheap; set ANTHROPIC_MODEL to use another model.
export const AI_MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5'

type ClaudeResult = { ok: true; text: string } | { ok: false; response: NextResponse }

const unavailable = (message: string): ClaudeResult => ({
  ok: false,
  response: NextResponse.json({ error: message, code: 'ai_unavailable' }, { status: 503 }),
})

// Signed-in users only, so nobody else can spend the API key's credits.
export async function requireUser() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// Every AI route calls Claude through here. A missing key, an empty balance, or any API error
// comes back as a 503 that the pages show as "AI isn't available" instead of crashing.
export async function askClaude(body: Record<string, unknown>): Promise<ClaudeResult> {
  if (!(await requireUser())) {
    return { ok: false, response: NextResponse.json({ error: 'Sign in first.' }, { status: 401 }) }
  }

  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return unavailable('AI features are off until an Anthropic API key is added.')

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model: AI_MODEL, ...body }),
      // Stay inside the route's time limit so the page gets a clear answer instead of a hang.
      signal: AbortSignal.timeout(55_000),
    })
    const data = await res.json().catch(() => null)
    const text: string | undefined = data?.content?.find((block: { type: string }) => block.type === 'text')?.text

    if (!res.ok || !text) {
      const message: string = data?.error?.message || ''
      console.error('claude_error', res.status, message)
      return unavailable(message.includes('credit')
        ? 'AI is paused because the Anthropic account is out of credits.'
        : 'AI is not available right now. Try again later.')
    }
    return { ok: true, text }
  } catch (error) {
    console.error('claude_error', error)
    return unavailable('AI is not available right now. Try again later.')
  }
}
