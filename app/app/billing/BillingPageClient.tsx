'use client'

import { useMemo, useState } from 'react'

import { useToast } from '../_components/toast-context'

type PlanLimitEntry = {
  label: string
  value: string
}

type PlanInfo = {
  code: string
  name: string
  monthlyPriceCents: number
  limits: PlanLimitEntry[]
}

type Props = {
  plans: PlanInfo[]
  activePlanCode: string
  subscriptionStatus: string | null
  currentPeriodEnd: string | null
}

const planDescriptions: Record<string, string> = {
  free: 'Perfect for small studios getting organized. Keep working with up to two clients at a time for no cost.',
  pro: 'Unlock the full TwinMind CRM experience. Automate handoffs, scale to unlimited clients, and centralize every touchpoint in one place.'
}

const formatCurrency = (cents: number) => {
  const dollars = cents / 100
  return dollars.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  })
}

const formatStatus = (status: string | null) => {
  if (!status) {
    return 'Unknown status'
  }

  const normalized = status.toLowerCase()

  switch (normalized) {
    case 'active':
      return 'Active subscription'
    case 'trialing':
      return 'Trialing'
    case 'past_due':
      return 'Past due'
    default:
      return status
  }
}

const formatDate = (value: string | null) => {
  if (!value) {
    return null
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return null
  }

  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date)
}

const CheckIcon = () => (
  <svg className="h-4 w-4 text-limeglow-400" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="m5 10 3 3 7-7" />
  </svg>
)

export function BillingPageClient({ plans, activePlanCode, subscriptionStatus, currentPeriodEnd }: Props) {
  const { pushToast } = useToast()
  const [isProcessing, setIsProcessing] = useState(false)

  const sortedPlans = useMemo(() => [...plans].sort((a, b) => a.monthlyPriceCents - b.monthlyPriceCents), [plans])

  const activeStatus = formatStatus(subscriptionStatus)
  const formattedPeriodEnd = formatDate(currentPeriodEnd)

  const handleUpgrade = (planCode: string) => {
    if (isProcessing) {
      return
    }

    setIsProcessing(true)
    setTimeout(() => {
      pushToast({
        title: planCode === activePlanCode ? 'Plan confirmed' : 'Upgrade requested',
        description:
          planCode === activePlanCode
            ? 'This plan is already active for your workspace.'
            : 'Billing automation is on the way. We will notify you as soon as checkout is available.',
        variant: planCode === activePlanCode ? 'success' : 'info'
      })
      setIsProcessing(false)
    }, 800)
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-12">
      <header className="space-y-3">
        <p className="text-xs uppercase tracking-[0.3em] text-white/40">Workspace billing</p>
        <h1 className="text-3xl font-semibold text-white">Choose the plan that grows with your studio</h1>
        <p className="max-w-2xl text-sm text-white/60">
          TwinMind Studio helps agencies stay on top of client relationships. Upgrade to the premium plan to unlock
          unlimited clients, richer reporting, and proactive support from our team.
        </p>
        <div className="rounded-2xl border border-white/10 bg-base-900/50 px-4 py-3 text-sm text-white/70">
          <p className="font-semibold text-white/80">{activeStatus}</p>
          {formattedPeriodEnd ? (
            <p className="text-xs text-white/50">Renews on {formattedPeriodEnd}</p>
          ) : (
            <p className="text-xs text-white/50">Subscription details will appear here once billing is connected.</p>
          )}
        </div>
      </header>

      <section className="grid gap-6 md:grid-cols-2">
        {sortedPlans.map((plan) => {
          const isActive = plan.code === activePlanCode
          const description = planDescriptions[plan.code] ?? 'Flexible billing designed for modern studios.'

          return (
            <article
              key={plan.code}
              className={`relative flex flex-col gap-6 rounded-3xl border bg-base-900/70 p-8 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.5)] ${
                isActive ? 'border-limeglow-400/60' : 'border-white/10'
              }`}
            >
              {isActive ? (
                <div className="absolute right-6 top-6 rounded-full bg-limeglow-400/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.25em] text-limeglow-300">
                  Current plan
                </div>
              ) : null}
              <div className="space-y-2">
                <span className="text-xs uppercase tracking-[0.3em] text-white/50">{plan.name}</span>
                <h2 className="text-2xl font-semibold text-white">{plan.name}</h2>
                <p className="text-sm text-white/60">{description}</p>
              </div>
              <div className="flex items-baseline gap-2 text-white">
                <span className="text-4xl font-semibold">{formatCurrency(plan.monthlyPriceCents)}</span>
                <span className="text-sm text-white/50">per month</span>
              </div>
              <ul className="flex flex-col gap-3 text-sm text-white/70">
                {plan.limits.length === 0 ? (
                  <li className="text-white/50">Plan limits will be announced soon.</li>
                ) : (
                  plan.limits.map((limit) => (
                    <li key={`${plan.code}-${limit.label}`} className="flex items-start gap-3">
                      <CheckIcon />
                      <span>
                        <span className="font-medium text-white/80">{limit.label}:</span> {limit.value}
                      </span>
                    </li>
                  ))
                )}
              </ul>
              <button
                type="button"
                onClick={() => handleUpgrade(plan.code)}
                disabled={isProcessing}
                className={`mt-auto inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-semibold transition ${
                  isActive
                    ? 'border border-white/20 text-white/70'
                    : 'bg-limeglow-400 text-base-950 hover:bg-limeglow-300'
                } disabled:cursor-not-allowed disabled:opacity-70`}
              >
                {isActive ? 'Manage plan' : isProcessing ? 'Working…' : 'Select plan'}
              </button>
            </article>
          )
        })}
      </section>
    </div>
  )
}

export default BillingPageClient
