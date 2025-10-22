import { cache } from 'react'

import { BillingManagement } from './_components/BillingManagement'
import { BillingUpgrade } from './_components/BillingUpgrade'
import { createServerSupabase } from '@/lib/supabase/server'
import type { Database } from '@/types/supabase'

const ACCOUNT_MEMBERS = 'account_members' as const
const SUBSCRIPTIONS = 'subscriptions' as const

const PLAN_DETAILS: Record<
  string,
  {
    name: string
    price: string
    priceNote: string
    description: string
  }
> = {
  pro: {
    name: 'Growth',
    price: '$12',
    priceNote: 'per month',
    description: 'TwinMind Growth unlocks unlimited clients, workflow automation, and priority workspace support.'
  }
}

const DEFAULT_PLAN_DETAIL = PLAN_DETAILS['pro']

const ACTIVE_STATUSES = new Set(['active', 'trialing', 'past_due'])

const STATUS_APPEARANCE: Record<
  string,
  {
    label: string
    tone: 'positive' | 'warning' | 'danger' | 'default'
  }
> = {
  active: { label: 'Active', tone: 'positive' },
  trialing: { label: 'Trialing', tone: 'positive' },
  past_due: { label: 'Past due', tone: 'warning' },
  unpaid: { label: 'Unpaid', tone: 'danger' },
  canceled: { label: 'Cancelled', tone: 'danger' },
  incomplete: { label: 'Incomplete', tone: 'warning' },
  incomplete_expired: { label: 'Incomplete', tone: 'warning' }
}

type AccountMembershipRow = Pick<
  Database['public']['Tables']['account_members']['Row'],
  'account_id' | 'role'
>

type SubscriptionRow = Pick<
  Database['public']['Tables']['subscriptions']['Row'],
  'plan_code' | 'status' | 'current_period_end' | 'provider_subscription_id' | 'provider_customer_id' | 'created_at'
>

type BillingState = {
  membershipRole: AccountMembershipRow['role'] | null
  subscription: SubscriptionRow | null
}

const getBillingState = cache(async (): Promise<BillingState> => {
  const supabase = createServerSupabase()

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { membershipRole: null, subscription: null }
  }

  const {
    data: membership,
    error: membershipError
  } = await supabase
    .from(ACCOUNT_MEMBERS)
    .select('account_id, role')
    .eq('profile_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle<AccountMembershipRow>()

  if (membershipError) {
    console.error('billing membership lookup error:', membershipError)
    return { membershipRole: null, subscription: null }
  }

  const accountId = membership?.account_id ?? null

  if (!accountId) {
    return { membershipRole: membership?.role ?? null, subscription: null }
  }

  const {
    data: subscription,
    error: subscriptionError
  } = await supabase
    .from(SUBSCRIPTIONS)
    .select('plan_code, status, current_period_end, provider_subscription_id, provider_customer_id, created_at')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<SubscriptionRow>()

  if (subscriptionError) {
    console.error('billing subscription lookup error:', subscriptionError)
    return { membershipRole: membership?.role ?? null, subscription: null }
  }

  return {
    membershipRole: membership?.role ?? null,
    subscription: subscription ?? null
  }
})

const formatBillingDate = (value: string | null): string | null => {
  if (!value) {
    return null
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return null
  }

  return new Intl.DateTimeFormat('en-US', { dateStyle: 'long' }).format(date)
}

const resolveStatusAppearance = (status: string | null | undefined) => {
  if (!status) {
    return { label: 'Unknown', tone: 'default' as const }
  }

  const normalized = status.toLowerCase()
  return STATUS_APPEARANCE[normalized] ?? {
    label: normalized.charAt(0).toUpperCase() + normalized.slice(1),
    tone: 'default' as const
  }
}

export default async function BillingPage() {
  const { subscription } = await getBillingState()

  const planDetail = subscription ? PLAN_DETAILS[subscription.plan_code] ?? DEFAULT_PLAN_DETAIL : DEFAULT_PLAN_DETAIL
  const normalizedStatus = subscription?.status ? subscription.status.toLowerCase() : null
  const hasActiveSubscription = normalizedStatus ? ACTIVE_STATUSES.has(normalizedStatus) : false
  const statusAppearance = resolveStatusAppearance(normalizedStatus)
  const nextBillingLabel = formatBillingDate(subscription?.current_period_end ?? null)

  const pageTitle = hasActiveSubscription
    ? 'Manage your TwinMind subscription'
    : 'Choose the plan that grows with your studio'

  const pageDescription = hasActiveSubscription
    ? 'Your workspace is on the TwinMind Growth plan. Review billing details, manage payment methods, or download invoices from one place.'
    : 'TwinMind Studio helps agencies stay on top of client relationships. Upgrade to the premium plan to unlock unlimited clients, richer reporting, and proactive support from our team.'

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-12">
      <header className="space-y-3">
        <p className="text-xs uppercase tracking-[0.3em] text-white/40">Workspace billing</p>
        <h1 className="text-3xl font-semibold text-white">{pageTitle}</h1>
        <p className="max-w-2xl text-sm text-white/60">{pageDescription}</p>
      </header>

      {hasActiveSubscription ? (
        <BillingManagement
          planName={planDetail.name}
          planPrice={planDetail.price}
          planPriceNote={planDetail.priceNote}
          planDescription={planDetail.description}
          statusLabel={statusAppearance.label}
          statusTone={statusAppearance.tone}
          statusValue={normalizedStatus ?? 'unknown'}
          nextBillingDateLabel={nextBillingLabel}
          nextBillingDateIso={subscription?.current_period_end ?? null}
          subscriptionId={subscription?.provider_subscription_id ?? null}
          canManageBilling={Boolean(subscription?.provider_customer_id)}
        />
      ) : (
        <BillingUpgrade
          planName={planDetail.name}
          planPrice={planDetail.price}
          planPriceNote={planDetail.priceNote}
        />
      )}
    </div>
  )
}
