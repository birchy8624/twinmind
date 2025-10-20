import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { ACTIVE_ACCOUNT_COOKIE, isAccountRoleAtLeast } from '@/lib/active-account'
import { createServerSupabase } from '@/lib/supabase/server'
import type { Database } from '@/types/supabase'

import BillingPageClient from './BillingPageClient'

type PlanRow = Database['public']['Tables']['plans']['Row']
type AccountMemberRow = Database['public']['Tables']['account_members']['Row']
type SubscriptionRow = Database['public']['Tables']['subscriptions']['Row']

type PlanLimitEntry = {
  label: string
  value: string
}

const formatLimitLabel = (key: string) =>
  key
    .split(/[_-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ')

const formatLimitValue = (value: unknown): string => {
  if (value === null || typeof value === 'undefined') {
    return '—'
  }

  if (typeof value === 'number') {
    return value.toLocaleString()
  }

  if (typeof value === 'boolean') {
    return value ? 'Included' : 'Not included'
  }

  if (Array.isArray(value)) {
    return value.map((item) => formatLimitValue(item)).join(', ')
  }

  if (typeof value === 'object') {
    return JSON.stringify(value)
  }

  return String(value)
}

const parsePlanLimits = (limits: PlanRow['limits']): PlanLimitEntry[] => {
  if (!limits || typeof limits !== 'object' || Array.isArray(limits)) {
    return []
  }

  return Object.entries(limits as Record<string, unknown>).map(([key, value]) => ({
    label: formatLimitLabel(key),
    value: formatLimitValue(value)
  }))
}

export default async function BillingPage() {
  const supabase = createServerSupabase()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/sign_in')
  }

  const cookieStore = cookies()
  const storedAccountId = cookieStore.get(ACTIVE_ACCOUNT_COOKIE)?.value?.trim() ?? null

  const { data: membershipRows, error: membershipsError } = await supabase
    .from('account_members')
    .select('account_id, role')
    .eq('profile_id', user.id)

  if (membershipsError) {
    console.error('Failed to load account memberships for billing:', membershipsError)
  }

  const memberships = (membershipRows ?? []) as Array<Pick<AccountMemberRow, 'account_id' | 'role'>>
  const membershipMap = new Map(memberships.map((membership) => [membership.account_id, membership]))

  let activeAccountId = storedAccountId && membershipMap.has(storedAccountId)
    ? storedAccountId
    : memberships[0]?.account_id ?? null

  if (!activeAccountId) {
    redirect('/app/setup-account')
  }

  const activeMembership = membershipMap.get(activeAccountId) ?? null

  if (!isAccountRoleAtLeast(activeMembership?.role, 'owner')) {
    redirect('/app/dashboard')
  }

  const {
    data: planRowsData,
    error: plansError
  } = await supabase
    .from('plans')
    .select('code, name, monthly_price_cents, limits')
    .order('monthly_price_cents', { ascending: true })

  if (plansError) {
    console.error('Failed to load billing plans:', plansError)
  }

  const planRows = (planRowsData ?? []) as Array<
    Pick<PlanRow, 'code' | 'name' | 'monthly_price_cents' | 'limits'>
  >

  const { data: subscriptionRowData, error: subscriptionError } = await supabase
    .from('subscriptions')
    .select('plan_code, status, current_period_end')
    .eq('account_id', activeAccountId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (subscriptionError) {
    console.error('Failed to load subscription:', subscriptionError)
  }

  const subscriptionRow = (subscriptionRowData ?? null) as
    | Pick<SubscriptionRow, 'plan_code' | 'status' | 'current_period_end'>
    | null

  const plans = planRows.map((plan) => ({
    code: plan.code,
    name: plan.name,
    monthlyPriceCents: plan.monthly_price_cents ?? 0,
    limits: parsePlanLimits(plan.limits)
  }))

  let activePlanCode = subscriptionRow?.plan_code ?? ''

  if (!activePlanCode) {
    const freePlan = plans.find((plan) => plan.code.toLowerCase() === 'free')
    activePlanCode = freePlan?.code ?? plans[0]?.code ?? ''
  }

  const subscriptionStatus = subscriptionRow?.status ?? null
  const currentPeriodEnd = subscriptionRow?.current_period_end ?? null

  return (
    <BillingPageClient
      plans={plans}
      activePlanCode={activePlanCode}
      subscriptionStatus={subscriptionStatus}
      currentPeriodEnd={currentPeriodEnd}
    />
  )
}
