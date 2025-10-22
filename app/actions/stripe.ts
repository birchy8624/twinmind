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
  console.info('[stripe] fetchClientSecret invoked')
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
    console.error('[stripe] fetchClientSecret user resolution failed', userError)
    throw new Error('You need to be signed in to start the checkout session')
  }

  console.info('[stripe] fetchClientSecret resolved user', { userId: user.id })

  const { data: membership, error: membershipError } = await supabase
    .from(ACCOUNT_MEMBERS)
    .select('account_id')
    .eq('profile_id', user.id)
    .maybeSingle<{ account_id: string | null }>()

  if (membershipError) {
    console.error('[stripe] fetchClientSecret membership lookup failed', membershipError)
    throw new Error('Unable to find a workspace for the current profile')
  }

  const accountId = membership?.account_id

  if (!accountId) {
    throw new Error('Workspace account could not be determined for checkout')
  }

  console.info('[stripe] fetchClientSecret resolved account', { userId: user.id, accountId })

  const { data: subscription, error: subscriptionError } = await supabase
    .from(SUBSCRIPTIONS)
    .select('provider_customer_id')
    .eq('account_id', accountId)
    .maybeSingle<Pick<Database['public']['Tables']['subscriptions']['Row'], 'provider_customer_id'>>()

  if (subscriptionError) {
    console.error('[stripe] fetchClientSecret subscription lookup failed', subscriptionError)
    throw new Error('Unable to load the current subscription for checkout')
  }

  const existingCustomerId = subscription?.provider_customer_id ?? undefined

  console.info('[stripe] fetchClientSecret creating checkout session', {
    accountId,
    hasExistingCustomer: Boolean(existingCustomerId),
  })

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
    console.error('[stripe] fetchClientSecret session missing client secret', {
      accountId,
      sessionId: session.id,
    })
    throw new Error('Unable to retrieve client secret from Stripe session')
  }

  console.info('[stripe] fetchClientSecret created session', {
    accountId,
    sessionId: session.id,
  })

  return clientSecret
}
