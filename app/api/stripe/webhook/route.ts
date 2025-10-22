import { NextResponse } from 'next/server'
import type Stripe from 'stripe'

import { stripe } from '@/lib/stripe'
import {
  normalizeStripeTimestamp,
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

function resolveStripeCustomerId(
  customer: Stripe.Subscription['customer'],
): string | null {
  if (typeof customer === 'string') {
    return customer
  }

  if (customer && typeof customer === 'object' && 'id' in customer && typeof customer.id === 'string') {
    return customer.id
  }

  return null
}

async function updateSubscriptionRecord(subscription: Stripe.Subscription) {
  const supabase = supabaseAdmin()

  const normalizedStatus = subscription.status?.trim() || 'canceled'
  const providerCustomerId = resolveStripeCustomerId(subscription.customer)

  const updatePayload: Database['public']['Tables']['subscriptions']['Update'] = {
    status: normalizedStatus,
    provider: 'stripe',
    provider_subscription_id: subscription.id,
    current_period_end: resolveSubscriptionPeriodEnd(subscription),
    cancel_at: normalizeStripeTimestamp(subscription.cancel_at),
    canceled_at: normalizeStripeTimestamp(subscription.canceled_at),
    cancel_at_period_end:
      typeof subscription.cancel_at_period_end === 'boolean'
        ? subscription.cancel_at_period_end
        : null,
    cancellation_details:
      serializeSubscriptionCancellationDetails(subscription.cancellation_details) as Database['public']['Tables']['subscriptions']['Update']['cancellation_details'],
    provider_customer_id: providerCustomerId,
  }

  const identifierQueries: Array<{
    column: keyof Database['public']['Tables']['subscriptions']['Row']
    value: string
  }> = [{ column: 'provider_subscription_id', value: subscription.id }]

  if (providerCustomerId) {
    identifierQueries.push({ column: 'provider_customer_id', value: providerCustomerId })
  }

  let existing: { id: string } | null = null

  for (const { column, value } of identifierQueries) {
    const { data, error } = await supabase
      .from(SUBSCRIPTIONS)
      .select('id')
      .eq(column, value)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<{ id: string }>()

    if (error) {
      console.error('stripe webhook subscription lookup error:', { column, value, error })
      throw new Error(`Unable to load subscription record for ${subscription.id}`)
    }

    if (data?.id) {
      existing = data
      break
    }
  }

  if (!existing?.id) {
    console.warn('stripe webhook subscription not found for update', {
      subscriptionId: subscription.id,
      providerCustomerId,
    })
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
