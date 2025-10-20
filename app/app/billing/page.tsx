'use client'

import { useState } from 'react'

import { useToast } from '../_components/toast-context'

const freeFeatures = [
  'Up to 2 active clients',
  'Project Kanban board access',
  'Client portal invitations',
  'Weekly email digest'
] as const

const premiumFeatures = [
  'Unlimited clients and relationships',
  'Advanced project reporting',
  'Shared asset library with permissions',
  'Priority workspace support'
] as const

const comparisonRows = [
  {
    label: 'Active clients',
    free: 'Up to 2',
    premium: 'Unlimited'
  },
  {
    label: 'Projects per client',
    free: '3',
    premium: 'Unlimited'
  },
  {
    label: 'Portal customization',
    free: 'Basic branding',
    premium: 'Advanced themes'
  },
  {
    label: 'Automation rules',
    free: '1 rule',
    premium: 'Unlimited'
  },
  {
    label: 'Support',
    free: 'Community forum',
    premium: 'Priority email'
  }
] as const

const CheckIcon = () => (
  <svg className="h-4 w-4 text-limeglow-400" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="m5 10 3 3 7-7" />
  </svg>
)

export default function BillingPage() {
  const { pushToast } = useToast()
  const [isUpgrading, setIsUpgrading] = useState(false)

  const handleUpgrade = () => {
    if (isUpgrading) {
      return
    }

    setIsUpgrading(true)
    setTimeout(() => {
      pushToast({
        title: 'Upgrade requested',
        description: 'We will notify you once billing is connected. Premium features will unlock automatically.',
        variant: 'success'
      })
      setIsUpgrading(false)
    }, 900)
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
      </header>

      <section className="grid gap-6 md:grid-cols-2">
        <article className="flex flex-col gap-6 rounded-3xl border border-white/10 bg-base-900/70 p-8 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.5)]">
          <div className="space-y-2">
            <span className="text-xs uppercase tracking-[0.3em] text-white/50">Free plan</span>
            <h2 className="text-2xl font-semibold text-white">Starter</h2>
            <p className="text-sm text-white/60">
              Perfect for small studios getting organized. Keep working with up to two clients at a time for no cost.
            </p>
          </div>
          <div className="flex items-baseline gap-2 text-white">
            <span className="text-4xl font-semibold">$0</span>
            <span className="text-sm text-white/50">per month</span>
          </div>
          <ul className="flex flex-col gap-3 text-sm text-white/70">
            {freeFeatures.map((feature) => (
              <li key={feature} className="flex items-start gap-3">
                <CheckIcon />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled
            className="mt-auto inline-flex items-center justify-center rounded-full border border-white/20 px-5 py-2 text-sm font-medium text-white/70"
          >
            Current plan
          </button>
        </article>

        <article className="relative flex flex-col gap-6 rounded-3xl border border-limeglow-400/50 bg-gradient-to-br from-base-900/80 via-base-900/60 to-base-900/30 p-8 shadow-[0_25px_70px_-25px_rgba(157,242,85,0.6)]">
          <div className="absolute right-6 top-6 rounded-full bg-limeglow-400/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.25em] text-limeglow-300">
            Most popular
          </div>
          <div className="space-y-2">
            <span className="text-xs uppercase tracking-[0.3em] text-limeglow-300/80">Premium plan</span>
            <h2 className="text-2xl font-semibold text-white">Growth</h2>
            <p className="text-sm text-white/60">
              Unlock the full TwinMind CRM experience. Automate handoffs, scale to unlimited clients, and centralize
              every touchpoint in one place.
            </p>
          </div>
          <div className="flex items-baseline gap-2 text-white">
            <span className="text-4xl font-semibold">$12</span>
            <span className="text-sm text-white/50">per month</span>
          </div>
          <ul className="flex flex-col gap-3 text-sm text-white/80">
            {premiumFeatures.map((feature) => (
              <li key={feature} className="flex items-start gap-3">
                <CheckIcon />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={handleUpgrade}
            disabled={isUpgrading}
            className="mt-auto inline-flex items-center justify-center rounded-full bg-limeglow-400 px-5 py-2 text-sm font-semibold text-base-950 transition hover:bg-limeglow-300 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isUpgrading ? 'Upgrading…' : 'Upgrade to Premium'}
          </button>
        </article>
      </section>

      <section className="overflow-hidden rounded-3xl border border-white/10 bg-base-900/50">
        <div className="border-b border-white/5 bg-base-900/70 px-6 py-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-white/60">Plan comparison</h3>
        </div>
        <div className="divide-y divide-white/5 text-sm text-white/70">
          {comparisonRows.map((row) => (
            <div key={row.label} className="grid grid-cols-3 gap-4 px-6 py-4">
              <span className="font-medium text-white/80">{row.label}</span>
              <span>{row.free}</span>
              <span className="text-white">{row.premium}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
