import { cache } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

import { stripe } from '@/lib/stripe'
import {
  normalizeStripeTimestamp,
  resolveSubscriptionPeriodEnd,
  serializeSubscriptionCancellationDetails,
} from '@/lib/stripe-subscription'

import { BillingManagement } from './_components/BillingManagement'
import { BillingUpgrade } from './_components/BillingUpgrade'
import { createServerSupabase } from '@/lib/supabase/server'
import type { Database } from '@/types/supabase'
import {
  resolvePaidAccess as resolvePaidAccessFromSubscription,
  syncWorkspaceSubscription,
  type SubscriptionRow
} from '@/lib/subscription'

const ACCOUNT_MEMBERS = 'account_members' as const

const PLAN_DETAILS: Record<
  string,
  {
    name: string
    price: string
    priceNote: string
    description: string
  }
> = {
  pro: {
    name: 'Premium',
    price: '$12',
    priceNote: 'per month',
    description: 'TwinMind Premium unlocks unlimited clients, workflow automation, and priority workspace support.'
  }
}

const DEFAULT_PLAN_DETAIL = PLAN_DETAILS['pro']

const STATUS_APPEARANCE: Record<
  string,
  {
    label: string
    tone: 'positive' | 'warning' | 'danger' | 'default'
  }
> = {
  active: { label: 'Active', tone: 'positive' },
  trialing: { label: 'Trialing', tone: 'positive' },
  past_due: { label: 'Past due', tone: 'warning' },
  unpaid: { label: 'Unpaid', tone: 'danger' },
  canceled: { label: 'Cancelled', tone: 'danger' },
  cancelled: { label: 'Cancelled', tone: 'danger' },
  incomplete: { label: 'Incomplete', tone: 'warning' },
  incomplete_expired: { label: 'Incomplete', tone: 'warning' }
}

type AccountMembershipRow = Pick<
  Database['public']['Tables']['account_members']['Row'],
  'account_id' | 'role'
>

type BillingState = {
  membershipRole: AccountMembershipRow['role'] | null
  subscription: SubscriptionRow | null
}

type SubscriptionSyncContext = {
  supabase: SupabaseClient<Database>
  accountId: string
  subscription: SubscriptionRow
}

const SUBSCRIPTION_SYNC_SELECT =
  'plan_code, status, current_period_end, provider_subscription_id, provider_customer_id, created_at, cancel_at, canceled_at, cancel_at_period_end, cancellation_details'

const normalizeStripeStatus = (value: string | null | undefined): string | null => {
  if (!value) {
    return null
  }

  return value.trim()
}

const resolvePaidAccess = (status: string | null, currentPeriodEnd: string | null): boolean => {
  if (!status) {
    return false
  }

  const normalized = status.toLowerCase()

  if (ACTIVE_STATUSES.has(normalized)) {
    return true
  }

  if (normalized !== 'canceled' || !currentPeriodEnd) {
    return false
  }

  const periodEndDate = new Date(currentPeriodEnd)

  if (Number.isNaN(periodEndDate.getTime())) {
    return false
  }

  return periodEndDate.getTime() > Date.now()
}

const syncStripeSubscription = async ({
  supabase,
  accountId,
  subscription,
}: SubscriptionSyncContext): Promise<SubscriptionRow> => {
  if (!subscription.provider_subscription_id) {
    return subscription
  }

  try {
    const stripeSubscription = await stripe.subscriptions.retrieve(subscription.provider_subscription_id, {
      expand: ['items'],
    })

    const currentPeriodEnd = resolveSubscriptionPeriodEnd(stripeSubscription)
    const cancelAt = normalizeStripeTimestamp(stripeSubscription.cancel_at)
    const canceledAt = normalizeStripeTimestamp(stripeSubscription.canceled_at)
    const cancelAtPeriodEnd =
      typeof stripeSubscription.cancel_at_period_end === 'boolean'
        ? stripeSubscription.cancel_at_period_end
        : null
    const cancellationDetails = serializeSubscriptionCancellationDetails(
      stripeSubscription.cancellation_details,
    ) as Database['public']['Tables']['subscriptions']['Update']['cancellation_details']

    const nextStatus = normalizeStripeStatus(stripeSubscription.status) ?? subscription.status ?? 'active'

    const updatePayload: Database['public']['Tables']['subscriptions']['Update'] = {
      status: nextStatus,
      current_period_end: currentPeriodEnd,
      cancel_at: cancelAt,
      canceled_at: canceledAt,
      cancel_at_period_end: cancelAtPeriodEnd,
      cancellation_details: cancellationDetails,
    }

    const { data: syncedSubscription, error: syncError } = await supabase
      .from(SUBSCRIPTIONS)
      .update(updatePayload)
      .eq('account_id', accountId)
      .eq('provider_subscription_id', subscription.provider_subscription_id)
      .select(SUBSCRIPTION_SYNC_SELECT)
      .maybeSingle<SubscriptionRow>()

    if (syncError) {
      console.error('billing subscription sync update error:', syncError)
      return { ...subscription, ...updatePayload }
    }

    return syncedSubscription ?? { ...subscription, ...updatePayload }
  } catch (error) {
    console.error('billing subscription sync retrieve error:', error)
    return subscription
  }
}

const getBillingState = cache(async (): Promise<BillingState> => {
  const supabase = createServerSupabase()

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { membershipRole: null, subscription: null }
  }

  const {
    data: membership,
    error: membershipError
  } = await supabase
    .from(ACCOUNT_MEMBERS)
    .select('account_id, role')
    .eq('profile_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle<AccountMembershipRow>()

  if (membershipError) {
    console.error('billing membership lookup error:', membershipError)
    return { membershipRole: null, subscription: null }
  }

  const accountId = membership?.account_id ?? null

  if (!accountId) {
    return { membershipRole: membership?.role ?? null, subscription: null }
  }

  const subscription = await syncWorkspaceSubscription({
    supabase,
    accountId,
  })

  if (!subscription) {
    return { membershipRole: membership?.role ?? null, subscription: null }
  }

  const syncedSubscription = await syncStripeSubscription({
    supabase,
    accountId,
    subscription
  })

  return {
    membershipRole: membership?.role ?? null,
    subscription
  }
})

const formatBillingDate = (value: string | null): string | null => {
  if (!value) {
    return null
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return null
  }

  return new Intl.DateTimeFormat('en-US', { dateStyle: 'long' }).format(date)
}

const resolveStatusAppearance = (status: string | null | undefined) => {
  if (!status) {
    return { label: 'Unknown', tone: 'default' as const }
  }

  const normalized = status.toLowerCase()
  const normalizedForAppearance = normalized === 'cancelled' ? 'canceled' : normalized
  return STATUS_APPEARANCE[normalizedForAppearance] ?? {
    label: normalized.charAt(0).toUpperCase() + normalized.slice(1),
    tone: 'default' as const
  }
}

export default async function BillingPage() {
  const { subscription } = await getBillingState()

  const rawStatus = subscription?.status ?? null
  const normalizedStatus = rawStatus ? rawStatus.toLowerCase() : null
  const isCanceledSubscription = normalizedStatus === 'canceled' || normalizedStatus === 'cancelled'
  const hasPaidAccess = resolvePaidAccessFromSubscription(
    rawStatus,
    subscription?.current_period_end ?? null,
    subscription?.cancel_at ?? null,
  )
  const subscriptionForDisplay = hasPaidAccess ? subscription : null
  const planDetail = subscriptionForDisplay
    ? PLAN_DETAILS[subscriptionForDisplay.plan_code] ?? DEFAULT_PLAN_DETAIL
    : DEFAULT_PLAN_DETAIL
  const hasSubscription = Boolean(subscriptionForDisplay)
  const statusAppearance = resolveStatusAppearance(normalizedStatus)
  const normalizedStatusForDisplay = normalizedStatus === 'canceled' ? 'cancelled' : normalizedStatus
  const statusValueForDisplay = normalizedStatusForDisplay ?? 'unknown'
  const nextBillingReference =
    subscriptionForDisplay?.current_period_end ??
    subscriptionForDisplay?.cancel_at ??
    subscription?.current_period_end ??
    subscription?.cancel_at ??
    null
  const nextBillingLabel = formatBillingDate(nextBillingReference)
  const cancellationNotice =
    (normalizedStatus === 'canceled' || normalizedStatus === 'cancelled') && nextBillingLabel
      ? `Your TwinMind Premium plan has been cancelled. It will remain active until ${nextBillingLabel}. You can reactivate anytime from the billing center.`
      : null

  const pageTitle = hasSubscription
    ? 'Manage your TwinMind subscription'
    : 'Choose the plan that grows with your studio'

  const pageDescription = hasSubscription
    ? isCanceledSubscription
      ? 'Your workspace cancelled the TwinMind Premium plan. Access remains available through the end of the current billing period.'
      : 'Your workspace is on the TwinMind Premium plan. Review billing details, manage payment methods, or download invoices from one place.'
    : 'TwinMind Studio helps agencies stay on top of client relationships. Upgrade to the premium plan to unlock unlimited clients, richer reporting, and proactive support from our team.'

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-12">
      <header className="space-y-3">
        <p className="text-xs uppercase tracking-[0.3em] text-white/40">Workspace billing</p>
        <h1 className="text-3xl font-semibold text-white">{pageTitle}</h1>
        <p className="max-w-2xl text-sm text-white/60">{pageDescription}</p>
      </header>

      {hasSubscription ? (
        <>
          <BillingManagement
            planName={planDetail.name}
            planPrice={planDetail.price}
            planPriceNote={planDetail.priceNote}
            planDescription={planDetail.description}
            statusLabel={statusAppearance.label}
            statusTone={statusAppearance.tone}
            statusValue={statusValueForDisplay}
            nextBillingDateLabel={nextBillingLabel}
            nextBillingDateIso={nextBillingReference}
            subscriptionId={subscriptionForDisplay?.provider_subscription_id ?? null}
            canManageBilling={Boolean(subscriptionForDisplay?.provider_customer_id)}
            cancellationNotice={cancellationNotice}
          />
        </>
      ) : (
        <BillingUpgrade planName={planDetail.name} planPrice={planDetail.price} planPriceNote={planDetail.priceNote} />
      )}
    </div>
  )
}
