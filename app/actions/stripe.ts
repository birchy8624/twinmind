'use server'

import { headers } from 'next/headers'

import { stripe } from '@/lib/stripe'
import { createServerSupabase } from '@/lib/supabase/server'
import type { Database } from '@/types/supabase'

const ACCOUNT_MEMBERS = 'account_members' as const
const SUBSCRIPTIONS = 'subscriptions' as const

type SubscriptionLookup = Pick<
  Database['public']['Tables']['subscriptions']['Row'],
  'provider_customer_id' | 'provider_subscription_id' | 'status' | 'current_period_end'
>

const priceId = process.env.STRIPE_PRICE_ID

if (!priceId) {
  throw new Error('STRIPE_PRICE_ID is not set in environment variables')
}

export async function fetchClientSecret(): Promise<string> {
  const originHeader = (await headers()).get('origin')

  if (!originHeader) {
    throw new Error('Missing origin header in request')
  }

  const supabase = createServerSupabase()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    throw new Error('Not authenticated.')
  }

  const {
    data: membership,
    error: membershipError,
  } = await supabase
    .from(ACCOUNT_MEMBERS)
    .select('account_id')
    .eq('profile_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle<{ account_id: string | null }>()

  if (membershipError) {
    console.error('checkout membership lookup error:', membershipError)
    throw new Error('Unable to determine the workspace membership.')
  }

  const accountId = membership?.account_id ?? null

  if (!accountId) {
    throw new Error('Workspace membership not found.')
  }

  const {
    data: subscription,
    error: subscriptionError,
  } = await supabase
    .from(SUBSCRIPTIONS)
    .select('provider_customer_id, provider_subscription_id, status, current_period_end')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<SubscriptionLookup>()

  if (subscriptionError) {
    console.error('checkout subscription lookup error:', subscriptionError)
    throw new Error('Unable to load the current subscription details.')
  }

  const providerCustomerId = subscription?.provider_customer_id ?? undefined

  const session = await stripe.checkout.sessions.create({
    ui_mode: 'embedded',
    customer: providerCustomerId,
    client_reference_id: accountId,
    metadata: { accountId },
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    mode: 'subscription',
    subscription_data: {
      metadata: { accountId },
    },
    return_url: `${originHeader}/return?session_id={CHECKOUT_SESSION_ID}`,
    automatic_tax: { enabled: true },
  })

  const clientSecret = session.client_secret

  if (!clientSecret) {
    throw new Error('Unable to retrieve client secret from Stripe session')
  }

  return clientSecret
}
