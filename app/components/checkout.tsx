'use client'

import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'

import { fetchClientSecret } from '../actions/stripe'

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? null
const stripePromise = publishableKey ? loadStripe(publishableKey) : null

if (!publishableKey && process.env.NODE_ENV !== 'production') {
  console.warn(
    'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set. TwinMind Premium checkout will be disabled until it is configured.',
  )
}

const embeddedCheckoutOptions = {
  fetchClientSecret,
} as const

export default function Checkout() {
  if (!stripePromise) {
    return (
      <div
        role="alert"
        className="space-y-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100"
      >
        <p className="font-semibold text-amber-200">Checkout temporarily unavailable</p>
        <p className="text-amber-100/80">
          We couldn&apos;t load the TwinMind Premium checkout because the Stripe publishable key is missing. Please
          contact{' '}
          <a className="font-medium text-amber-50 underline" href="mailto:billing@twinmind.app">
            billing@twinmind.app
          </a>{' '}
          and we&apos;ll finish the upgrade for you right away.
        </p>
      </div>
    )
  }

  return (
    <div id="checkout">
      <EmbeddedCheckoutProvider stripe={stripePromise} options={embeddedCheckoutOptions}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  )
}
