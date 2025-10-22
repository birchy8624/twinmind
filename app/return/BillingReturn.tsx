import { redirect } from 'next/navigation'
import Link from 'next/link'
import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'

import { stripe } from '@/lib/stripe'
import { upsertSubscriptionForAccount } from '@/lib/subscription-upsert'
import { createServerSupabase } from '@/lib/supabase/server'
import type { Database } from '@/types/supabase'
import type { PlanStatus } from '@/lib/stripe-subscription'

import { ReturnLogger } from './ReturnLogger'

type BillingReturnProps = {
  searchParams?: {
    session_id?: string
  }
}

type SubscriptionSyncContext = {
  session: Stripe.Checkout.Session
  supabase: SupabaseClient<Database>
}

type SubscriptionSyncResult = {
  accountId: string
  planStatus: PlanStatus
  planCode: string
  providerStatus: string | null
  providerCustomerId: string | null
  providerSubscriptionId: string
  currentPeriodEnd: string | null
  cancelAt: string | null
  canceledAt: string | null
  cancelAtPeriodEnd: boolean | null
}

const ACCOUNT_MEMBERS = 'account_members' as const

async function resolveAccountId(
  supabase: SupabaseClient<Database>,
  profileId: string,
): Promise<string> {
  const { data: membership, error: membershipError } = await supabase
    .from(ACCOUNT_MEMBERS)
    .select('account_id')
    .eq('profile_id', profileId)
    .maybeSingle<{ account_id: string | null }>()

  if (membershipError) {
    throw new Error('Unable to load workspace membership.')
  }

  const accountId = membership?.account_id

  if (!accountId) {
    throw new Error('Workspace account is not linked to this profile.')
  }

  return accountId
}

async function resolveStripeSubscription(
  session: Stripe.Checkout.Session,
): Promise<Stripe.Subscription> {
  if (session.subscription && typeof session.subscription !== 'string') {
    return session.subscription
  }

  if (typeof session.subscription === 'string') {
    return stripe.subscriptions.retrieve(session.subscription, { expand: ['items'] })
  }

  throw new Error('Checkout session does not contain a subscription reference.')
}

async function syncWorkspaceSubscription({
  session,
  supabase,
}: SubscriptionSyncContext): Promise<SubscriptionSyncResult> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    throw new Error('Unable to determine the authenticated user.')
  }

  const accountId = await resolveAccountId(supabase, user.id)
  const subscription = await resolveStripeSubscription(session)
  const upsertResult = await upsertSubscriptionForAccount(accountId, subscription)

  return {
    accountId,
    planStatus: upsertResult.planStatus,
    planCode: upsertResult.planCode,
    providerStatus: upsertResult.providerStatus,
    providerCustomerId: upsertResult.providerCustomerId,
    providerSubscriptionId: upsertResult.providerSubscriptionId,
    currentPeriodEnd: upsertResult.currentPeriodEnd,
    cancelAt: upsertResult.cancelAt,
    canceledAt: upsertResult.canceledAt,
    cancelAtPeriodEnd: upsertResult.cancelAtPeriodEnd,
  }
}

function serializeErrorForLog(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`
  }

  if (typeof error === 'string') {
    return error
  }

  try {
    return JSON.stringify(error)
  } catch {
    return 'Unknown error'
  }
}

export default async function BillingReturn({
  searchParams,
}: BillingReturnProps) {
  const sessionId = searchParams?.session_id

  if (!sessionId) {
    throw new Error('Please provide a valid session_id (`cs_test_...`)')
  }

  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['line_items', 'payment_intent', 'subscription', 'subscription.items', 'customer'],
  })

  const status = session.status
  const customerEmail = session.customer_details?.email

  if (status === 'open') {
    redirect('/app/billing')
  }

  if (status !== 'complete') {
    redirect('/app/billing')
  }

  const supabase = createServerSupabase()

  let syncResult: SubscriptionSyncResult | null = null
  let syncError: string | null = null
  let syncErrorLog: string | null = null

  try {
    syncResult = await syncWorkspaceSubscription({ session, supabase })
  } catch (error) {
    console.error('billing return subscription sync error:', error)
    syncError =
      'We processed your payment, but we were unable to update your workspace subscription automatically. Please contact support so we can help.'
    syncErrorLog = serializeErrorForLog(error)
  }

  if (syncError) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-24">
        <ReturnLogger
          status="error"
          message="Stripe checkout completed but subscription synchronization failed."
          details={{
            sessionId,
            error: syncErrorLog,
          }}
        />
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

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-24">
      {syncResult ? (
        <ReturnLogger
          status="success"
          message="Stripe checkout completed and subscription synchronized."
          details={{
            sessionId,
            accountId: syncResult.accountId,
            planCode: syncResult.planCode,
            planStatus: syncResult.planStatus,
            providerStatus: syncResult.providerStatus,
            providerSubscriptionId: syncResult.providerSubscriptionId,
            providerCustomerId: syncResult.providerCustomerId,
            currentPeriodEnd: syncResult.currentPeriodEnd,
            cancelAt: syncResult.cancelAt,
            canceledAt: syncResult.canceledAt,
            cancelAtPeriodEnd: syncResult.cancelAtPeriodEnd,
          }}
        />
      ) : null}
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
