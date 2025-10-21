'use client'

import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import type { ComponentProps } from 'react'

import { fetchClientSecret } from '../actions/stripe'

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY

if (!publishableKey) {
  throw new Error('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set')
}

const stripePromise = loadStripe(publishableKey)

type EmbeddedCheckoutOptions = ComponentProps<
  typeof EmbeddedCheckoutProvider
>['options']

const embeddedCheckoutOptions: EmbeddedCheckoutOptions = {
  fetchClientSecret,
}

export default function Checkout() {
  return (
    <div id="checkout">
      <EmbeddedCheckoutProvider
        stripe={stripePromise}
        options={embeddedCheckoutOptions}
      >
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  )
}
