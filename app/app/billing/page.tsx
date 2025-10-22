import { cache } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

import { stripe } from '@/lib/stripe'
import {
  hasActivePlan,
  normalizePlanStatus,
  normalizeStripeStatus,
  normalizeStripeTimestamp,
  resolvePlanStatus,
  resolveSubscriptionPeriodEnd,
  serializeSubscriptionCancellationDetails,
  type PlanStatus,
} from '@/lib/stripe-subscription'

import { BillingManagement } from './_components/BillingManagement'
import { BillingUpgrade } from './_components/BillingUpgrade'
import { createServerSupabase } from '@/lib/supabase/server'
import type { Database } from '@/types/supabase'

const ACCOUNT_MEMBERS = 'account_members' as const
const SUBSCRIPTIONS = 'subscriptions' as const

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
  incomplete_expired: { label: 'Incomplete', tone: 'warning' },
  pro: { label: 'Pro', tone: 'positive' },
  free: { label: 'Free', tone: 'default' }
}

type AccountMembershipRow = Pick<
  Database['public']['Tables']['account_members']['Row'],
  'account_id' | 'role'
>

type SubscriptionRow = Pick<
  Database['public']['Tables']['subscriptions']['Row'],
  |
    'id'
    | 'plan_code'
    | 'status'
    | 'current_period_end'
    | 'provider_subscription_id'
    | 'provider_customer_id'
    | 'created_at'
    | 'cancel_at'
    | 'canceled_at'
    | 'cancel_at_period_end'
    | 'cancellation_details'
>

type SubscriptionRecord = SubscriptionRow & { provider_status: string | null }

type BillingState = {
  membershipRole: AccountMembershipRow['role'] | null
  subscription: SubscriptionRecord | null
}

type SubscriptionSyncContext = {
  supabase: SupabaseClient<Database>
  subscription: SubscriptionRow
}

const SUBSCRIPTION_SYNC_SELECT =
  'id, plan_code, status, current_period_end, provider_subscription_id, provider_customer_id, created_at, cancel_at, canceled_at, cancel_at_period_end, cancellation_details'

const applyPlanStatus = (subscription: SubscriptionRow, planStatus: PlanStatus): SubscriptionRow => ({
  ...subscription,
  status: planStatus,
})

const syncStripeSubscription = async ({
  supabase,
  subscription,
}: SubscriptionSyncContext): Promise<SubscriptionRecord> => {
  const existingPlanStatus = normalizePlanStatus(subscription.status)

  if (!subscription.provider_subscription_id) {
    const inferredPlanStatus = resolvePlanStatus(null, subscription.current_period_end)

    if (inferredPlanStatus !== existingPlanStatus) {
      const { data: updatedSubscription, error: updateError } = await supabase
        .from(SUBSCRIPTIONS)
        .update({ status: inferredPlanStatus })
        .eq('id', subscription.id)
        .select(SUBSCRIPTION_SYNC_SELECT)
        .maybeSingle<SubscriptionRow>()

      if (updateError) {
        console.error('billing subscription sync plan normalization error:', updateError)
      } else if (updatedSubscription) {
        return { ...updatedSubscription, status: normalizePlanStatus(updatedSubscription.status), provider_status: null }
      }
    }

    return { ...subscription, status: existingPlanStatus, provider_status: null }
  }

  try {
    const stripeSubscription = await stripe.subscriptions.retrieve(subscription.provider_subscription_id, {
      expand: ['items'],
    })

    const currentPeriodEnd = resolveSubscriptionPeriodEnd(stripeSubscription)
    const providerStatus = normalizeStripeStatus(stripeSubscription.status)
    const planStatus = resolvePlanStatus(providerStatus, currentPeriodEnd)
    const cancelAt = normalizeStripeTimestamp(stripeSubscription.cancel_at)
    const canceledAt = normalizeStripeTimestamp(stripeSubscription.canceled_at)
    const cancelAtPeriodEnd =
      typeof stripeSubscription.cancel_at_period_end === 'boolean'
        ? stripeSubscription.cancel_at_period_end
        : null
    const cancellationDetails = serializeSubscriptionCancellationDetails(
      stripeSubscription.cancellation_details,
    ) as Database['public']['Tables']['subscriptions']['Update']['cancellation_details']

    const updatePayload: Database['public']['Tables']['subscriptions']['Update'] = {
      status: planStatus,
      current_period_end: currentPeriodEnd,
      cancel_at: cancelAt,
      canceled_at: canceledAt,
      cancel_at_period_end: cancelAtPeriodEnd,
      cancellation_details: cancellationDetails,
    }

    const { data: syncedSubscription, error: syncError } = await supabase
      .from(SUBSCRIPTIONS)
      .update(updatePayload)
      .eq('id', subscription.id)
      .select(SUBSCRIPTION_SYNC_SELECT)
      .maybeSingle<SubscriptionRow>()

    if (syncError) {
      console.error('billing subscription sync update error:', syncError)
      const fallbackSubscription = applyPlanStatus(
        { ...subscription, ...updatePayload },
        planStatus,
      )

      return { ...fallbackSubscription, provider_status: providerStatus }
    }

    const nextSubscription = syncedSubscription ?? applyPlanStatus({ ...subscription, ...updatePayload }, planStatus)

    return { ...nextSubscription, status: normalizePlanStatus(nextSubscription.status), provider_status: providerStatus }
  } catch (error) {
    console.error('billing subscription sync retrieve error:', error)
    return { ...subscription, status: existingPlanStatus, provider_status: null }
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

  const {
    data: subscription,
    error: subscriptionError
  } = await supabase
    .from(SUBSCRIPTIONS)
    .select(SUBSCRIPTION_SYNC_SELECT)
    .eq('account_id', accountId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<SubscriptionRow>()

  if (subscriptionError) {
    console.error('billing subscription lookup error:', subscriptionError)
    return { membershipRole: membership?.role ?? null, subscription: null }
  }

  if (!subscription) {
    return { membershipRole: membership?.role ?? null, subscription: null }
  }

  const syncedSubscription = await syncStripeSubscription({
    supabase,
    subscription,
  })

  return {
    membershipRole: membership?.role ?? null,
    subscription: syncedSubscription
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
  const normalized = normalizeStripeStatus(status)

  if (!normalized) {
    return { label: 'Unknown', tone: 'default' as const }
  }

  return (
    STATUS_APPEARANCE[normalized] ?? {
      label: normalized.charAt(0).toUpperCase() + normalized.slice(1),
      tone: 'default' as const,
    }
  )
}

export default async function BillingPage() {
  const { subscription } = await getBillingState()

  const planStatus = normalizePlanStatus(subscription?.status ?? null)
  const hasPaidPlan = Boolean(subscription && hasActivePlan(planStatus))
  const subscriptionForDisplay = hasPaidPlan ? subscription : null
  const planDetail = subscriptionForDisplay
    ? PLAN_DETAILS[subscriptionForDisplay.plan_code] ?? DEFAULT_PLAN_DETAIL
    : DEFAULT_PLAN_DETAIL
  const statusForDisplay = subscriptionForDisplay
    ? normalizeStripeStatus(subscriptionForDisplay.provider_status) ?? planStatus
    : planStatus
  const statusAppearance = resolveStatusAppearance(statusForDisplay)
  const nextBillingLabel = formatBillingDate(subscriptionForDisplay?.current_period_end ?? null)
  const cancellationNotice =
    planStatus === 'cancelled' && nextBillingLabel
      ? `Your TwinMind Premium plan will remain active until ${nextBillingLabel}. You can reactivate anytime from the billing center.`
      : null

  const pageTitle = hasPaidPlan
    ? 'Manage your TwinMind subscription'
    : 'Choose the plan that grows with your studio'

  const pageDescription = hasPaidPlan
    ? planStatus === 'cancelled'
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

      {hasPaidPlan ? (
        <>
          <BillingManagement
            planName={planDetail.name}
            planPrice={planDetail.price}
            planPriceNote={planDetail.priceNote}
            planDescription={planDetail.description}
            planStatus={planStatus}
            statusLabel={statusAppearance.label}
            statusTone={statusAppearance.tone}
            statusValue={statusForDisplay ?? 'unknown'}
            nextBillingDateLabel={nextBillingLabel}
            nextBillingDateIso={subscriptionForDisplay?.current_period_end ?? null}
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
