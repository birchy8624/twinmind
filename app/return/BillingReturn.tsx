import { redirect } from 'next/navigation'
import Link from 'next/link'
import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'

import { stripe } from '@/lib/stripe'
import {
  normalizePlanStatus,
  normalizeStripeStatus,
  normalizeStripeTimestamp,
  resolvePlanStatus,
  resolveSubscriptionPeriodEnd,
  serializeSubscriptionCancellationDetails,
  type PlanStatus,
} from '@/lib/stripe-subscription'
import { createServerSupabase } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import type { Database } from '@/types/supabase'

type BillingReturnProps = {
  searchParams?: {
    session_id?: string
  }
}

const ACCOUNT_MEMBERS = 'account_members' as const
const SUBSCRIPTIONS = 'subscriptions' as const
const PRO_PLAN_CODE = 'pro' as const

type SubscriptionSyncContext = {
  session: Stripe.Checkout.Session
  supabase: SupabaseClient<Database>
}

type SubscriptionSyncResult = {
  customerId: string | null
  subscriptionId: string | null
  currentPeriodEnd: string | null
  planStatus: PlanStatus
  providerStatus: string | null
  cancelAt: string | null
  canceledAt: string | null
  cancelAtPeriodEnd: boolean | null
  cancellationDetails: Database['public']['Tables']['subscriptions']['Update']['cancellation_details']
}

function isDeletedCustomer(
  customer: Stripe.Customer | Stripe.DeletedCustomer
): customer is Stripe.DeletedCustomer {
  return 'deleted' in customer && customer.deleted === true
}

function normalizeAccountId(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed || null
}

function extractAccountIdFromSession(session: Stripe.Checkout.Session): string | null {
  const sessionAccountId = normalizeAccountId(session.metadata?.account_id)

  if (sessionAccountId) {
    return sessionAccountId
  }

  if (typeof session.subscription === 'object' && session.subscription && 'metadata' in session.subscription) {
    const subscriptionMetadata = session.subscription.metadata as Stripe.Metadata | undefined
    const subscriptionAccountId = normalizeAccountId(subscriptionMetadata?.account_id)

    if (subscriptionAccountId) {
      return subscriptionAccountId
    }
  }

  return normalizeAccountId(session.client_reference_id)
}

async function resolveSubscriptionMetadata(
  session: Stripe.Checkout.Session,
): Promise<SubscriptionSyncResult> {
  console.info('[billing return] resolving subscription metadata', {
    sessionId: session.id,
    sessionStatus: session.status,
    subscriptionType: typeof session.subscription,
  })
  let subscriptionId: string | null = null
  let subscription: Stripe.Subscription | null = null

  if (typeof session.subscription === 'string') {
    subscriptionId = session.subscription

    try {
      subscription = await stripe.subscriptions.retrieve(session.subscription, {
        expand: ['items'],
      })
    } catch (error) {
      console.error('billing return subscription retrieve error:', error)
    }
  } else if (session.subscription) {
    subscription = session.subscription
    subscriptionId = session.subscription.id
  }

  console.info('[billing return] subscription resolution result', {
    sessionId: session.id,
    subscriptionId,
    subscriptionStatus: subscription?.status,
  })

  const currentPeriodEnd = resolveSubscriptionPeriodEnd(subscription)

  let customerId: string | null = null

  if (typeof session.customer === 'string') {
    customerId = session.customer
  } else if (session.customer && !isDeletedCustomer(session.customer)) {
    customerId = session.customer.id
  }

  const rawProviderStatus =
    subscription?.status ?? (session.status === 'complete' ? 'active' : session.status ?? 'active')
  const providerStatus = normalizeStripeStatus(rawProviderStatus) ?? 'active'
  const planStatus = resolvePlanStatus(providerStatus, currentPeriodEnd)

  const cancelAt = normalizeStripeTimestamp(subscription?.cancel_at)
  const canceledAt = normalizeStripeTimestamp(subscription?.canceled_at)
  const cancelAtPeriodEnd =
    typeof subscription?.cancel_at_period_end === 'boolean'
      ? subscription.cancel_at_period_end
      : null

  const cancellationDetails = serializeSubscriptionCancellationDetails(subscription?.cancellation_details) as Database['public']['Tables']['subscriptions']['Update']['cancellation_details']

  console.info('[billing return] subscription metadata normalized', {
    sessionId: session.id,
    customerId,
    subscriptionId,
    currentPeriodEnd,
    planStatus,
    providerStatus,
    cancelAt,
    canceledAt,
    cancelAtPeriodEnd,
  })

  return {
    customerId,
    subscriptionId,
    currentPeriodEnd,
    planStatus,
    providerStatus,
    cancelAt,
    canceledAt,
    cancelAtPeriodEnd,
    cancellationDetails,
  }
}

async function syncWorkspaceSubscription({
  session,
  supabase,
}: SubscriptionSyncContext) {
  const adminClient = supabaseAdmin()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError) {
    console.error('billing return user resolution error:', userError)
  }

  let memberAccountId: string | null = null

  if (user) {
    console.info('[billing return] loading membership for user', { userId: user.id })
    const { data: membership, error: membershipError } = await supabase
      .from(ACCOUNT_MEMBERS)
      .select('account_id')
      .eq('profile_id', user.id)
      .maybeSingle<{ account_id: string | null }>()

    if (membershipError) {
      throw new Error('Unable to load workspace membership.')
    }

    memberAccountId = membership?.account_id ?? null

    console.info('[billing return] membership lookup result', {
      userId: user.id,
      memberAccountId,
    })
  }

  const sessionAccountId = extractAccountIdFromSession(session)

  console.info('[billing return] extracted account from session', {
    sessionId: session.id,
    sessionAccountId,
    memberAccountId,
  })

  if (memberAccountId && sessionAccountId && memberAccountId !== sessionAccountId) {
    throw new Error('The checkout session does not match the active workspace.')
  }

  const accountId = memberAccountId ?? sessionAccountId

  if (!accountId) {
    throw new Error('Workspace account is not linked to this checkout session.')
  }

  console.info('[billing return] syncing subscription for account', {
    accountId,
    sessionId: session.id,
  })

  const metadata = await resolveSubscriptionMetadata(session)

  const normalizedPlanStatus = normalizePlanStatus(metadata.planStatus)

  const updatePayload: Database['public']['Tables']['subscriptions']['Update'] = {
    plan_code: PRO_PLAN_CODE,
    status: normalizedPlanStatus,
    provider: 'stripe',
    provider_customer_id: metadata.customerId,
    provider_subscription_id: metadata.subscriptionId,
    current_period_end: metadata.currentPeriodEnd,
    cancel_at: metadata.cancelAt,
    canceled_at: metadata.canceledAt,
    cancel_at_period_end: metadata.cancelAtPeriodEnd,
    cancellation_details: metadata.cancellationDetails,
  }

  console.info('[billing return] prepared subscription update payload', {
    accountId,
    normalizedPlanStatus,
    hasCustomerId: Boolean(metadata.customerId),
    hasSubscriptionId: Boolean(metadata.subscriptionId),
    currentPeriodEnd: metadata.currentPeriodEnd,
  })

  const { data: existingSubscription, error: fetchError } = await adminClient
    .from(SUBSCRIPTIONS)
    .select('id')
    .eq('account_id', accountId)
    .maybeSingle<{ id: string }>()

  if (fetchError) {
    throw new Error('Unable to load the existing subscription record.')
  }

  if (existingSubscription?.id) {
    console.info('[billing return] updating existing subscription', {
      accountId,
      subscriptionId: existingSubscription.id,
    })
    const { error: updateError } = await adminClient
      .from(SUBSCRIPTIONS)
      .update(updatePayload)
      .eq('id', existingSubscription.id)

    if (updateError) {
      throw new Error('Unable to update the subscription record.')
    }
  } else {
    console.info('[billing return] inserting new subscription', {
      accountId,
    })
    const insertPayload: Database['public']['Tables']['subscriptions']['Insert'] = {
      account_id: accountId,
      plan_code: PRO_PLAN_CODE,
      status: normalizedPlanStatus,
      provider: 'stripe',
      provider_customer_id: metadata.customerId,
      provider_subscription_id: metadata.subscriptionId,
      current_period_end: metadata.currentPeriodEnd,
      cancel_at: metadata.cancelAt,
      canceled_at: metadata.canceledAt,
      cancel_at_period_end: metadata.cancelAtPeriodEnd,
      cancellation_details: metadata.cancellationDetails,
    }

    const { error: insertError } = await adminClient.from(SUBSCRIPTIONS).insert(insertPayload)

    if (insertError) {
      throw new Error('Unable to create the subscription record.')
    }
  }

  console.info('[billing return] subscription sync complete', {
    accountId,
    sessionId: session.id,
    normalizedPlanStatus,
  })
}

export default async function BillingReturn({
  searchParams,
}: BillingReturnProps) {
  const sessionId = searchParams?.session_id

  if (!sessionId) {
    throw new Error('Please provide a valid session_id (`cs_test_...`)')
  }

  console.info('[billing return] loading checkout session', { sessionId })

  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['line_items', 'payment_intent', 'subscription', 'subscription.items', 'customer'],
  })

  const status = session.status
  const customerEmail = session.customer_details?.email

  console.info('[billing return] checkout session retrieved', {
    sessionId,
    status,
    customerEmail,
  })

  if (status === 'open') {
    console.warn('[billing return] session still open, redirecting to billing', { sessionId })
    redirect('/app/billing')
  }

  if (status !== 'complete') {
    console.warn('[billing return] session not complete, redirecting to billing', {
      sessionId,
      status,
    })
    redirect('/app/billing')
  }

  const supabase = createServerSupabase()

  console.info('[billing return] attempting subscription sync', { sessionId })

  let syncError: string | null = null

  try {
    await syncWorkspaceSubscription({ session, supabase })
  } catch (error) {
    console.error('billing return subscription sync error:', error)
    syncError =
      'We processed your payment, but we were unable to update your workspace subscription automatically. Please contact support so we can help.'
  }

  if (syncError) {
    console.error('[billing return] subscription sync failed', { sessionId })
    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-24">
        <section className="mx-auto flex w-full max-w-xl flex-col items-center justify-center gap-6 rounded-3xl border border-rose-400/30 bg-base-900/70 p-8 text-center shadow-[0_25px_70px_-25px_rgba(255,83,112,0.25)]">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-400/10">
            <svg className="h-6 w-6 text-rose-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-white">We need a hand to finish your upgrade</h1>
            <p className="text-sm text-white/70">
              {syncError}{' '}
              You can email <a className="text-white underline" href="mailto:billing@twinmind.app">billing@twinmind.app</a> and we&apos;ll make sure everything is squared away.
            </p>
          </div>
          <Link
            href="/app/billing"
            className="inline-flex items-center justify-center rounded-full border border-white/20 px-5 py-2 text-sm font-medium text-white transition hover:border-white/40"
          >
            Return to billing
          </Link>
        </section>
      </main>
    )
  }

  console.info('[billing return] subscription sync succeeded', {
    sessionId,
    customerEmail,
  })

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-24">
      <section className="mx-auto flex w-full max-w-xl flex-col items-center justify-center gap-6 rounded-3xl border border-limeglow-400/40 bg-base-900/70 p-8 text-center shadow-[0_25px_70px_-25px_rgba(157,242,85,0.3)]">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-limeglow-400/10">
          <svg className="h-6 w-6 text-limeglow-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m5 12 4 4L19 6" />
          </svg>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-white">Your TwinMind Premium plan is active</h1>
          <p className="text-sm text-white/70">
            Thanks for upgrading{customerEmail ? `, ${customerEmail}` : ''}! Your workspace subscription has been moved to the pro plan and you can now manage billing directly from the TwinMind billing center.
          </p>
        </div>
        <Link
          href="/app/billing"
          className="inline-flex items-center justify-center rounded-full bg-limeglow-400 px-5 py-2 text-sm font-semibold text-base-950 transition hover:bg-limeglow-300"
        >
          Return to billing
        </Link>
      </section>
    </main>
  )
}
