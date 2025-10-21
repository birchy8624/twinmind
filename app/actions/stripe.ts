'use server'

import { headers } from 'next/headers'

import { stripe } from '@/lib/stripe'

const priceId = process.env.STRIPE_PRICE_ID

if (!priceId) {
  throw new Error('STRIPE_PRICE_ID is not set in environment variables')
}

export async function fetchClientSecret(): Promise<string> {
  const originHeader = (await headers()).get('origin')

  if (!originHeader) {
    throw new Error('Missing origin header in request')
  }

  const session = await stripe.checkout.sessions.create({
    ui_mode: 'embedded',
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    mode: 'subscription',
    return_url: `${originHeader}/return?session_id={CHECKOUT_SESSION_ID}`,
    automatic_tax: { enabled: true },
  })

  const clientSecret = session.client_secret

  if (!clientSecret) {
    throw new Error('Unable to retrieve client secret from Stripe session')
  }

  return clientSecret
}
