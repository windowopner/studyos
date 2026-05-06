import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createSupabaseServer } from '@/lib/supabase-server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(req: Request) {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const origin = new URL(req.url).origin

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price: process.env.STRIPE_PRICE_ID || 'price_1TU2Q2LMZQxWklImaBmFt8vN',
        quantity: 1,
      },
    ],
    success_url: `${origin}/dashboard?payment=success`,
    cancel_url: `${origin}/pricing`,
    customer_email: user.email,
    metadata: {
      user_id: user.id,
    },
  })

  return NextResponse.json({ url: session.url })
}
