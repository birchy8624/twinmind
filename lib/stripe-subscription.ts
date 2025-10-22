import type Stripe from 'stripe'

type SubscriptionWithLegacyFields = Stripe.Subscription & {
  current_period_end?: number | null
}

const ACTIVE_PROVIDER_STATUSES = new Set(['active', 'trialing', 'past_due'])

export type PlanStatus = 'free' | 'pro' | 'cancelled'

export function normalizeStripeTimestamp(timestamp?: number | null): string | null {
  if (typeof timestamp !== 'number') {
    return null
  }

  return new Date(timestamp * 1000).toISOString()
}

export function normalizeStripeStatus(status?: string | null): string | null {
  if (typeof status !== 'string') {
    return null
  }

  const normalized = status.trim().toLowerCase()
  return normalized || null
}

export function normalizePlanStatus(status?: string | null): PlanStatus {
  const normalized = normalizeStripeStatus(status)

  if (normalized === 'pro') {
    return 'pro'
  }

  if (normalized === 'cancelled' || normalized === 'canceled') {
    return 'cancelled'
  }

  return 'free'
}

export function resolvePlanStatus(
  providerStatus: string | null | undefined,
  currentPeriodEnd: string | null,
): PlanStatus {
  const normalizedStatus = normalizeStripeStatus(providerStatus)

  if (normalizedStatus && ACTIVE_PROVIDER_STATUSES.has(normalizedStatus)) {
    return 'pro'
  }

  if (normalizedStatus === 'canceled') {
    if (currentPeriodEnd) {
      const periodEndDate = new Date(currentPeriodEnd)

      if (!Number.isNaN(periodEndDate.getTime()) && periodEndDate.getTime() > Date.now()) {
        return 'cancelled'
      }
    }

    return 'free'
  }

  return 'free'
}

export function hasActivePlan(planStatus: PlanStatus): boolean {
  return planStatus === 'pro' || planStatus === 'cancelled'
}

export function resolveSubscriptionPeriodEnd(
  subscription: Stripe.Subscription | null | undefined,
): string | null {
  if (!subscription) {
    return null
  }

  const subscriptionWithLegacyFields = subscription as SubscriptionWithLegacyFields

  if (typeof subscriptionWithLegacyFields.current_period_end === 'number') {
    return normalizeStripeTimestamp(subscriptionWithLegacyFields.current_period_end)
  }

  const latestItemPeriodEnd = subscription.items.data.reduce<number | null>((latest, item) => {
    if (typeof item.current_period_end !== 'number') {
      return latest
    }

    if (latest === null || item.current_period_end > latest) {
      return item.current_period_end
    }

    return latest
  }, null)

  return normalizeStripeTimestamp(latestItemPeriodEnd)
}

export function serializeSubscriptionCancellationDetails(
  details: Stripe.Subscription.CancellationDetails | null | undefined,
): Stripe.Subscription.CancellationDetails | null {
  if (!details) {
    return null
  }

  return JSON.parse(JSON.stringify(details)) as Stripe.Subscription.CancellationDetails
}
