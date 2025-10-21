import { redirect } from 'next/navigation'

import { stripe } from '@/lib/stripe'

export default async function Return({ searchParams }) {
  const sessionId = searchParams?.session_id

  if (!sessionId) {
    throw new Error('Please provide a valid session_id (`cs_test_...`)')
  }

  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['line_items', 'payment_intent'],
  })

  const status = session.status
  const customerEmail = session.customer_details?.email

  if (status === 'open') {
    return redirect('/app/billing')
  }

  if (status === 'complete') {
    return (
      <section id="success">
        <p>
          We appreciate your business! A confirmation email will be sent to{' '}
          {customerEmail ?? 'your email'}. If you have any questions, please email{' '}
        </p>
        <a href="mailto:orders@example.com">orders@example.com</a>.
      </section>
    )
  }

  return redirect('/app/billing')
}
