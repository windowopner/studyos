import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

  // RLS 우회를 위해 service role 사용 — 핸들러 안에서 생성해야 빌드 타임 에러 방지
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const userId = session.metadata?.user_id

    if (!userId) {
      console.error('No user_id in session metadata')
      return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ plan: 'pro' })
      .eq('id', userId)

    if (error) {
      console.error('Failed to update plan:', error.message)
      return NextResponse.json({ error: 'DB update failed' }, { status: 500 })
    }

    console.log(`Plan updated to pro for user: ${userId}`)
  }

  return NextResponse.json({ received: true })
}
