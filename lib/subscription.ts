import type { SupabaseClient } from '@supabase/supabase-js'

import { stripe } from './stripe'
import {
  normalizeStripeTimestamp,
  resolveSubscriptionPeriodEnd,
  serializeSubscriptionCancellationDetails,
} from './stripe-subscription'

import type { Database } from '@/types/supabase'

const SUBSCRIPTIONS = 'subscriptions' as const

const SUBSCRIPTION_FIELDS =
  'id, plan_code, status, current_period_end, provider_subscription_id, provider_customer_id, created_at, cancel_at, canceled_at, cancel_at_period_end, cancellation_details'

export const ACTIVE_STATUSES = new Set(['active', 'trialing', 'past_due'])

export const isActiveStatus = (status: string | null | undefined): boolean => {
  if (!status) {
    return false
  }

  const normalized = status.trim().toLowerCase()

  return ACTIVE_STATUSES.has(normalized)
}

type SubscriptionTable = Database['public']['Tables']['subscriptions']

type SubscriptionRow = Pick<
  SubscriptionTable['Row'],
  | 'id'
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

type SyncContext = {
  supabase: SupabaseClient<Database>
  accountId: string
}

const normalizeStripeStatus = (value: string | null | undefined): string | null => {
  if (!value) {
    return null
  }

  return value.trim()
}

const selectLatestSubscription = async (
  supabase: SupabaseClient<Database>,
  accountId: string,
): Promise<SubscriptionRow | null> => {
  const { data, error } = await supabase
    .from(SUBSCRIPTIONS)
    .select(SUBSCRIPTION_FIELDS)
    .eq('account_id', accountId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<SubscriptionRow>()

  if (error) {
    console.error('subscription select error:', error)
    return null
  }

  return data ?? null
}

const updateSubscription = async (
  supabase: SupabaseClient<Database>,
  subscriptionId: string,
  payload: SubscriptionTable['Update'],
): Promise<SubscriptionRow | null> => {
  const { data, error } = await supabase
    .from(SUBSCRIPTIONS)
    .update(payload)
    .eq('id', subscriptionId)
    .select(SUBSCRIPTION_FIELDS)
    .maybeSingle<SubscriptionRow>()

  if (error) {
    console.error('subscription update error:', error)
    return null
  }

  return data ?? null
}

const syncSubscriptionWithStripe = async (
  supabase: SupabaseClient<Database>,
  subscription: SubscriptionRow,
): Promise<SubscriptionRow> => {
  if (!subscription.provider_subscription_id) {
    return subscription
  }

  try {
    const stripeSubscription = await stripe.subscriptions.retrieve(subscription.provider_subscription_id, {
      expand: ['items'],
    })

    const currentPeriodEndFromStripe = resolveSubscriptionPeriodEnd(stripeSubscription)
    const currentPeriodEnd = currentPeriodEndFromStripe ?? subscription.current_period_end ?? null
    const cancelAt = normalizeStripeTimestamp(stripeSubscription.cancel_at) ?? subscription.cancel_at ?? null
    const canceledAt = normalizeStripeTimestamp(stripeSubscription.canceled_at) ?? subscription.canceled_at ?? null
    const cancelAtPeriodEnd =
      typeof stripeSubscription.cancel_at_period_end === 'boolean'
        ? stripeSubscription.cancel_at_period_end
        : null
    const cancellationDetails = serializeSubscriptionCancellationDetails(
      stripeSubscription.cancellation_details,
    ) as SubscriptionTable['Update']['cancellation_details']

    const rawStripeStatus = normalizeStripeStatus(stripeSubscription.status) ?? subscription.status ?? 'active'
    const nextStatus =
      cancelAtPeriodEnd || canceledAt ? 'canceled' : normalizeStatus(rawStripeStatus) ?? 'active'

    const updatePayload: SubscriptionTable['Update'] = {
      status: nextStatus,
      current_period_end: currentPeriodEnd,
      cancel_at: cancelAt,
      canceled_at: canceledAt,
      cancel_at_period_end: cancelAtPeriodEnd,
      cancellation_details: cancellationDetails,
    }

    const updatedSubscription = await updateSubscription(supabase, subscription.id, updatePayload)

    return updatedSubscription ?? ({ ...subscription, ...updatePayload } as SubscriptionRow)
  } catch (error) {
    console.error('subscription stripe sync error:', error)
    return subscription
  }
}

const normalizeStatus = (status: string | null | undefined): string | null => {
  if (!status) {
    return null
  }

  const normalized = status.trim().toLowerCase()

  if (normalized === 'cancelled' || normalized === 'canceling') {
    return 'canceled'
  }

  return normalized
}

const isFutureDate = (value: string | null | undefined): boolean => {
  if (!value) {
    return false
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return false
  }

  return date.getTime() > Date.now()
}

const shouldMarkAsPaid = (
  status: string | null | undefined,
  currentPeriodEnd: string | null | undefined,
  cancelAt: string | null | undefined,
): boolean => {
  const normalizedStatus = normalizeStatus(status)

  if (!normalizedStatus) {
    return false
  }

  if (isActiveStatus(normalizedStatus)) {
    return true
  }

  if (normalizedStatus !== 'canceled') {
    return false
  }

  return isFutureDate(currentPeriodEnd) || isFutureDate(cancelAt)
}

const ensureFreeStatus = async (
  supabase: SupabaseClient<Database>,
  subscription: SubscriptionRow,
): Promise<SubscriptionRow> => {
  if (normalizeStatus(subscription.status) === 'unpaid') {
    return subscription
  }

  const downgradePayload: SubscriptionTable['Update'] = {
    status: 'unpaid',
  }

  const downgraded = await updateSubscription(supabase, subscription.id, downgradePayload)

  return downgraded ?? ({ ...subscription, ...downgradePayload } as SubscriptionRow)
}

export const resolvePaidAccess = (
  status: string | null | undefined,
  currentPeriodEnd: string | null | undefined,
  cancelAt?: string | null | undefined,
): boolean => shouldMarkAsPaid(status, currentPeriodEnd, cancelAt ?? null)

export async function syncWorkspaceSubscription({
  supabase,
  accountId,
}: SyncContext): Promise<SubscriptionRow | null> {
  const subscription = await selectLatestSubscription(supabase, accountId)

  if (!subscription) {
    return null
  }

  let syncedSubscription = await syncSubscriptionWithStripe(supabase, subscription)

  const hasPaidAccess = shouldMarkAsPaid(
    syncedSubscription.status,
    syncedSubscription.current_period_end,
    syncedSubscription.cancel_at ?? subscription.cancel_at ?? null,
  )

  if (!hasPaidAccess) {
    syncedSubscription = await ensureFreeStatus(supabase, syncedSubscription)
  }

  return syncedSubscription
}

export type { SubscriptionRow }
