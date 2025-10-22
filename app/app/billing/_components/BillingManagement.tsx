'use client'

import { useMemo, useState, useTransition } from 'react'

import { createBillingPortalSession } from '@/app/actions/billing'

type BillingManagementProps = {
  planName: string
  planPrice: string
  planPriceNote: string
  planDescription: string
  statusLabel: string
  statusTone: 'positive' | 'warning' | 'danger' | 'default'
  statusValue: string
  nextBillingDateLabel: string | null
  nextBillingDateIso: string | null
  subscriptionId: string | null
  canManageBilling: boolean
  cancellationNotice?: string | null
}

type ToneClassNameMap = Record<BillingManagementProps['statusTone'], string>

type ToneIconMap = Record<BillingManagementProps['statusTone'], JSX.Element>

const toneClassNames: ToneClassNameMap = {
  positive: 'border-limeglow-400/50 bg-limeglow-400/10 text-limeglow-200',
  warning: 'border-amber-300/40 bg-amber-300/10 text-amber-200',
  danger: 'border-rose-400/40 bg-rose-400/10 text-rose-200',
  default: 'border-white/20 bg-white/10 text-white/70',
}

const toneIcons: ToneIconMap = {
  positive: (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m5 11 3 3 7-7" />
    </svg>
  ),
  warning: (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 4.5 3.5 17h13L10 4.5Zm0 4.5v3m0 3h.01" />
    </svg>
  ),
  danger: (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6v4m0 4h.01M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" />
    </svg>
  ),
  default: (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 4v12m6-6H4" />
    </svg>
  ),
}

export function BillingManagement(props: BillingManagementProps) {
  const {
    planName,
    planPrice,
    planPriceNote,
    planDescription,
    statusLabel,
    statusTone,
    statusValue,
    nextBillingDateLabel,
    nextBillingDateIso,
    subscriptionId,
    canManageBilling,
    cancellationNotice,
  } = props

  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const badgeClassName = useMemo(() => {
    const base = 'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.18em]'
    const toneClass = toneClassNames[statusTone] ?? toneClassNames.default
    return `${base} ${toneClass}`
  }, [statusTone])

  const toneIcon = useMemo(() => toneIcons[statusTone] ?? toneIcons.default, [statusTone])

  const handleOpenPortal = () => {
    if (isPending || !canManageBilling) {
      return
    }

    setError(null)

    startTransition(async () => {
      try {
        const url = await createBillingPortalSession()

        if (!url) {
          throw new Error('Unable to determine the billing portal URL.')
        }

        window.location.href = url
      } catch (actionError) {
        console.error('billing portal open error:', actionError)
        setError(
          actionError instanceof Error
            ? actionError.message
            : 'We were unable to open the billing portal. Please try again.'
        )
      }
    })
  }

  const normalizedStatusValue = statusValue?.toLowerCase()
  const nextBillingHeading =
    normalizedStatusValue === 'canceled' || normalizedStatusValue === 'cancelled'
      ? 'Access until'
      : 'Next billing'

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <article className="flex flex-col gap-6 rounded-3xl border border-white/10 bg-base-900/70 p-8 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.45)]">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <span className="text-xs uppercase tracking-[0.3em] text-white/50">Current plan</span>
            <h2 className="text-2xl font-semibold text-white">{planName}</h2>
            <p className="text-sm text-white/60">{planDescription}</p>
          </div>
          <span className={badgeClassName}>
            {toneIcon}
            <span>{statusLabel}</span>
          </span>
        </div>

        <div className="flex items-baseline gap-2 text-white">
          <span className="text-4xl font-semibold">{planPrice}</span>
          <span className="text-sm text-white/50">{planPriceNote}</span>
        </div>

        <dl className="space-y-3 text-sm text-white/70">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-white/60">{nextBillingHeading}</dt>
            <dd className="text-right text-white" title={nextBillingDateIso ?? undefined}>
              {nextBillingDateLabel ?? 'Not available'}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-white/60">Status</dt>
            <dd className="text-right text-white capitalize">{statusValue || 'unknown'}</dd>
          </div>
          {subscriptionId ? (
            <div className="flex items-center justify-between gap-4">
              <dt className="text-white/60">Subscription ID</dt>
              <dd className="truncate text-right text-white/80" title={subscriptionId}>
                {subscriptionId}
              </dd>
            </div>
          ) : null}
        </dl>

        {cancellationNotice ? (
          <p className="rounded-2xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
            {cancellationNotice}
          </p>
        ) : null}

        <div className="mt-auto space-y-3">
          <button
            type="button"
            onClick={handleOpenPortal}
            disabled={!canManageBilling || isPending}
            className="inline-flex w-full items-center justify-center rounded-full bg-limeglow-400 px-5 py-2 text-sm font-semibold text-base-950 transition hover:bg-limeglow-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? 'Opening billing portal…' : 'Open billing center'}
          </button>
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
          {!canManageBilling ? (
            <p className="text-xs text-white/50">
              Billing portal access becomes available once the subscription is fully linked to Stripe.
            </p>
          ) : null}
        </div>
      </article>

      <article className="flex flex-col gap-6 rounded-3xl border border-white/10 bg-base-900/50 p-8">
        <div className="space-y-2">
          <h3 className="text-xl font-semibold text-white">Billing management</h3>
          <p className="text-sm text-white/60">
            Update payment methods, download invoices, or change plans directly from the TwinMind billing center.
          </p>
        </div>
        <ul className="space-y-3 text-sm text-white/70">
          <li className="flex items-start gap-3">
            <svg className="mt-0.5 h-4 w-4 text-limeglow-300" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m4 10 4 4 8-8" />
            </svg>
            <span>Manage payment methods and billing contacts in one place.</span>
          </li>
          <li className="flex items-start gap-3">
            <svg className="mt-0.5 h-4 w-4 text-limeglow-300" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h10M5 8h10M5 16h6" />
            </svg>
            <span>Download receipts and invoice PDFs for every billing cycle.</span>
          </li>
          <li className="flex items-start gap-3">
            <svg className="mt-0.5 h-4 w-4 text-limeglow-300" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 10a5 5 0 0 1 5-5v5h5a5 5 0 1 1-10 0Z" />
            </svg>
            <span>Adjust seat counts or cancel anytime without contacting support.</span>
          </li>
        </ul>
        <div className="mt-auto rounded-2xl border border-white/10 bg-base-900/70 p-4 text-sm text-white/70">
          <p>
            Need help? Email{' '}
            <a className="text-white underline" href="mailto:billing@twinmind.app">
              billing@twinmind.app
            </a>{' '}
            and our team will assist you within one business day.
          </p>
        </div>
      </article>
    </div>
  )
}
