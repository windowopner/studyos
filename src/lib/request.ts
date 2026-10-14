import { NextResponse } from 'next/server'

// Helpers for API routes: a JSON body that might be missing or malformed, and inputs that must
// be capped so one request can't send a novel to the AI.

export async function readBody(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json()
    return body && typeof body === 'object' && !Array.isArray(body) ? body : null
  } catch {
    return null
  }
}

export function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.slice(0, max) : ''
}

export function int(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback
}

export function badRequest(message = 'The request was missing something. Reload and try again.') {
  return NextResponse.json({ error: message }, { status: 400 })
}

// Claude sometimes wraps JSON in a code fence or adds a sentence; take the first array.
export function parseJsonArray(raw: string): unknown[] | null {
  const cleaned = raw.replace(/```(?:json)?/g, '').trim()
  const start = cleaned.indexOf('[')
  const end = cleaned.lastIndexOf(']')
  if (start === -1 || end <= start) return null
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1))
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}
