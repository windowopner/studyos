import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/ai'

// Whether an Anthropic API key is set, so pages can say AI is off before anyone tries it.
export async function GET() {
  if (!(await requireUser())) return NextResponse.json({ configured: false }, { status: 401 })
  return NextResponse.json({ configured: !!process.env.ANTHROPIC_API_KEY })
}
