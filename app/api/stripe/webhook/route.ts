import { NextResponse } from 'next/server'
import type Stripe from 'stripe'

import { stripe } from '@/lib/stripe'
import { upsertSubscriptionForAccount } from '@/lib/subscription-upsert'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SUBSCRIPTIONS = 'subscriptions' as const

const webhookSecret = (() => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET

  if (!secret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not set in environment variables')
  }

  return secret
})()

async function updateSubscriptionRecord(subscription: Stripe.Subscription) {
  const supabase = supabaseAdmin()

  const { data: existing, error: fetchError } = await supabase
    .from(SUBSCRIPTIONS)
    .select('account_id')
    .eq('provider_subscription_id', subscription.id)
    .maybeSingle<{ account_id: string }>()

  if (fetchError) {
    console.error('stripe webhook subscription lookup error:', fetchError)
    throw new Error(`Unable to load subscription record for ${subscription.id}`)
  }

  const accountId = existing?.account_id

  if (!accountId) {
    console.warn('stripe webhook subscription not linked to account:', subscription.id)
    return
  }

  await upsertSubscriptionForAccount(accountId, subscription, supabase)
}

export async function POST(req: Request) {
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ message: 'Missing stripe-signature header' }, { status: 400 })
  }

  const payload = await req.text()

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret)
  } catch (error) {
    console.error('stripe webhook signature verification failed:', error)
    return NextResponse.json({ message: 'Invalid signature' }, { status: 400 })
  }

  try {
    if (
      event.type === 'customer.subscription.updated' ||
      event.type === 'customer.subscription.deleted'
    ) {
      const subscription = event.data.object as Stripe.Subscription
      await updateSubscriptionRecord(subscription)
    }
  } catch (error) {
    console.error('stripe webhook processing error:', error)
    return NextResponse.json({ message: 'Webhook processing failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
