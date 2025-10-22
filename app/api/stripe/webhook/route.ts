import { NextResponse } from 'next/server'
import type Stripe from 'stripe'

import { stripe } from '@/lib/stripe'
import {
  normalizePlanStatus,
  normalizeStripeStatus,
  normalizeStripeTimestamp,
  resolvePlanStatus,
  resolveSubscriptionPeriodEnd,
  serializeSubscriptionCancellationDetails,
} from '@/lib/stripe-subscription'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import type { Database } from '@/types/supabase'

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
  console.info('[stripe webhook] updating subscription record', {
    subscriptionId: subscription.id,
    status: subscription.status,
    customerType: typeof subscription.customer,
  })
  const supabase = supabaseAdmin()

  const currentPeriodEnd = resolveSubscriptionPeriodEnd(subscription)
  const providerStatus = normalizeStripeStatus(subscription.status) ?? 'canceled'
  const planStatus = normalizePlanStatus(resolvePlanStatus(providerStatus, currentPeriodEnd))

  const updatePayload: Database['public']['Tables']['subscriptions']['Update'] = {
    status: planStatus,
    provider: 'stripe',
    provider_subscription_id: subscription.id,
    current_period_end: currentPeriodEnd,
    cancel_at: normalizeStripeTimestamp(subscription.cancel_at),
    canceled_at: normalizeStripeTimestamp(subscription.canceled_at),
    cancel_at_period_end:
      typeof subscription.cancel_at_period_end === 'boolean'
        ? subscription.cancel_at_period_end
        : null,
    cancellation_details:
      serializeSubscriptionCancellationDetails(subscription.cancellation_details) as Database['public']['Tables']['subscriptions']['Update']['cancellation_details'],
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

  console.info('[stripe webhook] found subscription record', {
    subscriptionId: subscription.id,
    recordId: existing.id,
  })

  const { error: updateError } = await supabase
    .from(SUBSCRIPTIONS)
    .update(updatePayload)
    .eq('id', existing.id)

  if (updateError) {
    console.error('stripe webhook subscription update error:', updateError)
    throw new Error(`Unable to update subscription record ${existing.id}`)
  }

  console.info('[stripe webhook] subscription record updated', {
    subscriptionId: subscription.id,
    recordId: existing.id,
    planStatus,
  })
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
      console.info('[stripe webhook] processing subscription event', {
        eventId: event.id,
        eventType: event.type,
        subscriptionId: subscription.id,
        subscriptionStatus: subscription.status,
      })
      await updateSubscriptionRecord(subscription)
    }
  } catch (error) {
    console.error('stripe webhook processing error:', error)
    return NextResponse.json({ message: 'Webhook processing failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
