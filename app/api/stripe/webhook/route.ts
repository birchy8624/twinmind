import { NextResponse } from 'next/server'
import type Stripe from 'stripe'

import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import type { Database } from '@/types/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SUBSCRIPTIONS = 'subscriptions' as const

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

if (!webhookSecret) {
  throw new Error('STRIPE_WEBHOOK_SECRET is not set in environment variables')
}

type SubscriptionWithLegacyFields = Stripe.Subscription & {
  current_period_end?: number | null
}

function normalizeTimestamp(timestamp?: number | null): string | null {
  if (typeof timestamp !== 'number') {
    return null
  }

  return new Date(timestamp * 1000).toISOString()
}

function resolveCurrentPeriodEnd(subscription: Stripe.Subscription): string | null {
  const subscriptionWithLegacyFields = subscription as SubscriptionWithLegacyFields

  if (typeof subscriptionWithLegacyFields.current_period_end === 'number') {
    return normalizeTimestamp(subscriptionWithLegacyFields.current_period_end)
  }

  const latestItemPeriodEnd = subscription.items.data.reduce<number | null>((latest, item) => {
    if (typeof item.current_period_end !== 'number') {
      return latest
    }

    if (latest === null || item.current_period_end > latest) {
      return item.current_period_end
    }

    return latest
  }, null)

  return normalizeTimestamp(latestItemPeriodEnd)
}

function serializeCancellationDetails(
  details: Stripe.Subscription.CancellationDetails | null | undefined
): Database['public']['Tables']['subscriptions']['Update']['cancellation_details'] {
  if (!details) {
    return null
  }

  return JSON.parse(JSON.stringify(details)) as Database['public']['Tables']['subscriptions']['Update']['cancellation_details']
}

async function updateSubscriptionRecord(subscription: Stripe.Subscription) {
  const supabase = supabaseAdmin()

  const normalizedStatus = subscription.status?.trim() || 'canceled'

  const updatePayload: Database['public']['Tables']['subscriptions']['Update'] = {
    status: normalizedStatus,
    provider: 'stripe',
    provider_subscription_id: subscription.id,
    current_period_end: resolveCurrentPeriodEnd(subscription),
    cancel_at: normalizeTimestamp(subscription.cancel_at),
    canceled_at: normalizeTimestamp(subscription.canceled_at),
    cancel_at_period_end:
      typeof subscription.cancel_at_period_end === 'boolean'
        ? subscription.cancel_at_period_end
        : null,
    cancellation_details: serializeCancellationDetails(subscription.cancellation_details),
  }

  if (typeof subscription.customer === 'string') {
    updatePayload.provider_customer_id = subscription.customer
  } else if (
    subscription.customer &&
    typeof subscription.customer === 'object' &&
    'id' in subscription.customer &&
    typeof subscription.customer.id === 'string'
  ) {
    updatePayload.provider_customer_id = subscription.customer.id
  }

  const { data: existing, error: fetchError } = await supabase
    .from(SUBSCRIPTIONS)
    .select('id')
    .eq('provider_subscription_id', subscription.id)
    .maybeSingle<{ id: string }>()

  if (fetchError) {
    console.error('stripe webhook subscription lookup error:', fetchError)
    throw new Error(`Unable to load subscription record for ${subscription.id}`)
  }

  if (!existing?.id) {
    console.warn('stripe webhook subscription not found:', subscription.id)
    return
  }

  const { error: updateError } = await supabase
    .from(SUBSCRIPTIONS)
    .update(updatePayload)
    .eq('id', existing.id)

  if (updateError) {
    console.error('stripe webhook subscription update error:', updateError)
    throw new Error(`Unable to update subscription record ${existing.id}`)
  }
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
