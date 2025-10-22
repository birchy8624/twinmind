import type Stripe from 'stripe'

type SubscriptionWithLegacyFields = Stripe.Subscription & {
  current_period_end?: number | null
}

export function normalizeStripeTimestamp(timestamp?: number | null): string | null {
  if (typeof timestamp !== 'number') {
    return null
  }

  return new Date(timestamp * 1000).toISOString()
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
