import 'server-only'

import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'

import {
  normalizePlanStatus,
  normalizeStripeStatus,
  normalizeStripeTimestamp,
  resolvePlanStatus,
  resolveSubscriptionPeriodEnd,
  serializeSubscriptionCancellationDetails,
  type PlanStatus,
} from '@/lib/stripe-subscription'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import type { Database } from '@/types/supabase'

const SUBSCRIPTIONS = 'subscriptions' as const
const PRO_PLAN_CODE = 'pro' as const
const FREE_PLAN_CODE = 'free' as const

type AdminClient = SupabaseClient<Database>

type SubscriptionInsertPayload = Database['public']['Tables']['subscriptions']['Insert'] & {
  updated_at?: string | null
}

type SubscriptionUpsertResult = {
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

function resolvePlanCode(planStatus: PlanStatus, subscription: Stripe.Subscription): string {
  for (const item of subscription.items?.data ?? []) {
    const metadataPlanCode = item.price?.metadata?.plan_code

    if (typeof metadataPlanCode === 'string' && metadataPlanCode.trim()) {
      return metadataPlanCode.trim()
    }
  }

  if (planStatus === 'pro' || planStatus === 'cancelled') {
    return PRO_PLAN_CODE
  }

  return FREE_PLAN_CODE
}

function resolveProviderCustomerId(subscription: Stripe.Subscription): string | null {
  if (typeof subscription.customer === 'string') {
    return subscription.customer
  }

  if (
    subscription.customer &&
    typeof subscription.customer === 'object' &&
    'id' in subscription.customer &&
    typeof subscription.customer.id === 'string'
  ) {
    return subscription.customer.id
  }

  return null
}

function createUpsertPayload(
  accountId: string,
  subscription: Stripe.Subscription,
  planStatus: PlanStatus,
  planCode: string,
): SubscriptionInsertPayload {
  const currentPeriodEnd = resolveSubscriptionPeriodEnd(subscription)
  const providerCustomerId = resolveProviderCustomerId(subscription)
  const cancelAt = normalizeStripeTimestamp(subscription.cancel_at)
  const canceledAt = normalizeStripeTimestamp(subscription.canceled_at)
  const cancelAtPeriodEnd =
    typeof subscription.cancel_at_period_end === 'boolean' ? subscription.cancel_at_period_end : null

  const cancellationDetails = serializeSubscriptionCancellationDetails(
    subscription.cancellation_details,
  ) as Database['public']['Tables']['subscriptions']['Update']['cancellation_details']

  return {
    account_id: accountId,
    plan_code: planCode,
    status: planStatus,
    provider: 'stripe',
    provider_customer_id: providerCustomerId,
    provider_subscription_id: subscription.id,
    current_period_end: currentPeriodEnd,
    cancel_at: cancelAt,
    canceled_at: canceledAt,
    cancel_at_period_end: cancelAtPeriodEnd,
    cancellation_details: cancellationDetails,
    updated_at: new Date().toISOString(),
  }
}

export async function upsertSubscriptionForAccount(
  accountId: string,
  subscription: Stripe.Subscription,
  client?: AdminClient,
): Promise<SubscriptionUpsertResult> {
  if (!accountId) {
    throw new Error('An accountId is required to upsert a subscription.')
  }

  if (!subscription?.id) {
    throw new Error('A valid Stripe subscription is required to upsert a subscription.')
  }

  const currentPeriodEnd = resolveSubscriptionPeriodEnd(subscription)
  const providerStatus = normalizeStripeStatus(subscription.status)
  const resolvedPlanStatus = resolvePlanStatus(providerStatus, currentPeriodEnd)
  const planStatus = normalizePlanStatus(resolvedPlanStatus)
  const planCode = resolvePlanCode(planStatus, subscription)

  const supabase = client ?? supabaseAdmin()
  const upsertPayload = createUpsertPayload(accountId, subscription, planStatus, planCode)

  const { error: upsertError } = await supabase
    .from(SUBSCRIPTIONS)
    .upsert(upsertPayload, { onConflict: 'account_id' })

  if (upsertError) {
    throw new Error(`Unable to upsert subscription for account ${accountId}: ${upsertError.message}`)
  }

  return {
    planStatus,
    planCode,
    providerStatus,
    providerCustomerId: upsertPayload.provider_customer_id ?? null,
    providerSubscriptionId: subscription.id,
    currentPeriodEnd: upsertPayload.current_period_end ?? null,
    cancelAt: upsertPayload.cancel_at ?? null,
    canceledAt: upsertPayload.canceled_at ?? null,
    cancelAtPeriodEnd: upsertPayload.cancel_at_period_end ?? null,
  }
}
