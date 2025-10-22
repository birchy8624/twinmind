'use server'

import { headers } from 'next/headers'

import { stripe } from '@/lib/stripe'
import { createServerSupabase } from '@/lib/supabase/server'

const ACCOUNT_MEMBERS = 'account_members' as const
const SUBSCRIPTIONS = 'subscriptions' as const

export async function createBillingPortalSession(): Promise<string> {
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
    console.error('billing portal membership lookup error:', membershipError)
    throw new Error('Unable to load workspace membership.')
  }

  const accountId = membership?.account_id

  if (!accountId) {
    throw new Error('Workspace membership not found.')
  }

  const {
    data: subscription,
    error: subscriptionError,
  } = await supabase
    .from(SUBSCRIPTIONS)
    .select('provider_customer_id')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<{ provider_customer_id: string | null }>()

  if (subscriptionError) {
    console.error('billing portal subscription lookup error:', subscriptionError)
    throw new Error('Unable to load workspace subscription.')
  }

  const customerId = subscription?.provider_customer_id

  if (!customerId) {
    throw new Error('The workspace subscription is missing a billing customer.')
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${originHeader}/app/billing`,
  })

  if (!session.url) {
    throw new Error('Unable to create billing portal session.')
  }

  return session.url
}
