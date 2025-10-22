'use server'

import { headers } from 'next/headers'

import { stripe } from '@/lib/stripe'
import { createServerSupabase } from '@/lib/supabase/server'
import type { Database } from '@/types/supabase'

const ACCOUNT_MEMBERS = 'account_members' as const
const SUBSCRIPTIONS = 'subscriptions' as const

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
    throw new Error('You need to be signed in to start the checkout session')
  }

  const { data: membership, error: membershipError } = await supabase
    .from(ACCOUNT_MEMBERS)
    .select('account_id')
    .eq('profile_id', user.id)
    .maybeSingle<{ account_id: string | null }>()

  if (membershipError) {
    throw new Error('Unable to find a workspace for the current profile')
  }

  const accountId = membership?.account_id

  if (!accountId) {
    throw new Error('Workspace account could not be determined for checkout')
  }

  const { data: subscription, error: subscriptionError } = await supabase
    .from(SUBSCRIPTIONS)
    .select('provider_customer_id')
    .eq('account_id', accountId)
    .maybeSingle<Pick<Database['public']['Tables']['subscriptions']['Row'], 'provider_customer_id'>>()

  if (subscriptionError) {
    throw new Error('Unable to load the current subscription for checkout')
  }

  const existingCustomerId = subscription?.provider_customer_id ?? undefined

  const session = await stripe.checkout.sessions.create({
    ui_mode: 'embedded',
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    mode: 'subscription',
    return_url: `${originHeader}/return?session_id={CHECKOUT_SESSION_ID}`,
    automatic_tax: { enabled: true },
    client_reference_id: accountId,
    metadata: { account_id: accountId },
    subscription_data: {
      metadata: { account_id: accountId },
    },
    ...(existingCustomerId ? { customer: existingCustomerId } : {}),
  })

  const clientSecret = session.client_secret

  if (!clientSecret) {
    throw new Error('Unable to retrieve client secret from Stripe session')
  }

  return clientSecret
}
