import { NextResponse } from 'next/server'

import type { Database } from '@/types/supabase'

import { getAccessContext, HttpError } from '../_lib/access'

const MS_IN_DAY = 1000 * 60 * 60 * 24
const ACTIVE_PIPELINE_STATUSES: Array<Database['public']['Enums']['project_status']> = [
  'Backlog',
  'Call Arranged',
  'Brief Gathered',
  'UI Stage',
  'DB Stage',
  'Auth Stage',
  'Build',
  'QA',
  'Handover',
]

const invoiceStatusToBucket = (status: Database['public']['Enums']['invoice_status']) => {
  if (status === 'Quote') {
    return 'quoted' as const
  }

  if (status === 'Sent' || status === 'Invoice Sent') {
    return 'invoiced' as const
  }

  if (status === 'Paid' || status === 'Payment Made') {
    return 'paid' as const
  }

  return null
}

type PipelineOverviewItem = {
  stage: string
  count: number
}

type RevenuePerformanceItem = {
  period: string
  quoted: number
  invoiced: number
  paid: number
}

type VelocityItem = {
  stage: string
  days: number
}

type UpcomingProject = {
  id: string
  name: string
  client: string
  dueIn: number | null
}

type ActivityFeedItem = {
  id: string
  author: string
  description: string
  timeAgo: string
}

const formatTimeAgo = (input: Date) => {
  const now = new Date()
  const diffMs = now.getTime() - input.getTime()

  if (diffMs < 0) {
    return 'Just now'
  }

  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  if (diffMinutes < 1) {
    return 'Just now'
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`
  }

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) {
    return `${diffHours}h ago`
  }

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) {
    return `${diffDays}d ago`
  }

  return input.toLocaleDateString()
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ACCOUNT_MEMBERS = 'account_members' as const

export async function GET() {
  try {
    const { supabase, role, clientMemberships, userId } = await getAccessContext({
      allowEmptyClientMemberships: true,
    })

    if (role === 'client' && clientMemberships.length === 0) {
      return NextResponse.json({
        pipelineOverview: [],
        revenuePerformance: [],
        winRate: { quotes: 0, paid: 0 },
        velocityByStage: [],
        upcomingProjects: [],
        activityFeed: [],
      })
    }

    let accessibleProjectIds: string[] | null = null

    let activeAccountId: string | null = null

    const { data: membershipRow, error: membershipError } = await supabase
      .from(ACCOUNT_MEMBERS)
      .select('account_id')
      .eq('profile_id', userId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle<{ account_id: string | null }>()

    if (membershipError) {
      console.error('dashboard active account lookup error:', membershipError)
    } else if (membershipRow?.account_id) {
      activeAccountId = membershipRow.account_id
    }

    if (role === 'client') {
      const { data: projectRows, error: projectError } = await supabase
        .from('projects')
        .select('id')
        .in('client_id', clientMemberships)
        .returns<Array<{ id: string | null }> | null>()

      if (projectError) {
        console.error('dashboard accessible projects error:', projectError)
        return NextResponse.json({ message: 'Unable to load dashboard data.' }, { status: 500 })
      }

      const projectIdRows = Array.isArray(projectRows) ? projectRows : []

      accessibleProjectIds = projectIdRows
        .map((project) => project?.id)
        .filter((value): value is string => typeof value === 'string' && value.length > 0)

      if (accessibleProjectIds.length === 0) {
        return NextResponse.json({
          pipelineOverview: [],
          revenuePerformance: [],
          winRate: { quotes: 0, paid: 0 },
          velocityByStage: [],
          upcomingProjects: [],
          activityFeed: [],
        })
      }
    }

    const pipelinePromise = (async (): Promise<PipelineOverviewItem[]> => {
      let pipelineQuery = supabase
        .from('projects')
        .select('id, status')
        .eq('archived', false)

      if (accessibleProjectIds) {
        pipelineQuery = pipelineQuery.in('id', accessibleProjectIds)
      }

      const { data, error } = await pipelineQuery.returns<
        Array<{
          id: string | null
          status: Database['public']['Enums']['project_status'] | null
        }> | null
      >()

      if (error) {
        throw error
      }

      const pipelineRows = Array.isArray(data) ? data : []

      const counts = pipelineRows.reduce((acc, project) => {
        const status = project.status
        if (!status || !ACTIVE_PIPELINE_STATUSES.includes(status)) {
          return acc
        }

        acc[status] = (acc[status] ?? 0) + 1
        return acc
      }, {} as Record<Database['public']['Enums']['project_status'], number>)

      return ACTIVE_PIPELINE_STATUSES.map((status) => ({
        stage: status,
        count: counts[status] ?? 0,
      })).filter((item) => item.count > 0)
    })()

    const revenuePromise = (async () => {
      let invoiceQuery = supabase
        .from('invoices')
        .select('status, amount, issued_at, project_id')

      if (accessibleProjectIds) {
        invoiceQuery = invoiceQuery.in('project_id', accessibleProjectIds)
      }

      const { data, error } = await invoiceQuery.returns<
        Array<{
          status: Database['public']['Enums']['invoice_status'] | null
          amount: number | null
          issued_at: string | null
          project_id: string | null
        }> | null
      >()

      if (error) {
        throw error
      }

      const now = new Date()
      const currentMonthAnchor = new Date(now.getFullYear(), now.getMonth(), 1)
      const lastMonthAnchor = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const monthsElapsed = now.getMonth() + 1

      const sumByPeriod = {
        thisMonth: { quoted: 0, invoiced: 0, paid: 0 },
        lastMonth: { quoted: 0, invoiced: 0, paid: 0 },
        ytdTotals: { quoted: 0, invoiced: 0, paid: 0 },
      }

      let quotesCount = 0
      let paidCount = 0

      const invoices = Array.isArray(data) ? data : []

      for (const invoice of invoices) {
        const status = invoice.status
        if (!status) {
          continue
        }

        const bucket = invoiceStatusToBucket(status)
        const amount = Number(invoice.amount ?? 0)
        const issuedAt = invoice.issued_at ? new Date(invoice.issued_at) : null

        if (bucket) {
          quotesCount += 1
          if (status === 'Paid' || status === 'Payment Made') {
            paidCount += 1
          }
        }

        if (!bucket || !issuedAt) {
          continue
        }

        if (
          issuedAt.getFullYear() === currentMonthAnchor.getFullYear() &&
          issuedAt.getMonth() === currentMonthAnchor.getMonth()
        ) {
          sumByPeriod.thisMonth[bucket] += amount
        }

        if (
          issuedAt.getFullYear() === lastMonthAnchor.getFullYear() &&
          issuedAt.getMonth() === lastMonthAnchor.getMonth()
        ) {
          sumByPeriod.lastMonth[bucket] += amount
        }

        if (issuedAt.getFullYear() === currentMonthAnchor.getFullYear()) {
          sumByPeriod.ytdTotals[bucket] += amount
        }
      }

      const ytdAverageFactor = monthsElapsed > 0 ? monthsElapsed : 1

      const revenue: RevenuePerformanceItem[] = [
        { period: 'This Month', ...sumByPeriod.thisMonth },
        { period: 'Last Month', ...sumByPeriod.lastMonth },
        {
          period: 'YTD Avg',
          quoted: sumByPeriod.ytdTotals.quoted / ytdAverageFactor,
          invoiced: sumByPeriod.ytdTotals.invoiced / ytdAverageFactor,
          paid: sumByPeriod.ytdTotals.paid / ytdAverageFactor,
        },
      ]

      return {
        revenue,
        winRate: {
          quotes: quotesCount,
          paid: paidCount,
        },
      }
    })()

    const velocityPromise = (async (): Promise<VelocityItem[]> => {
      let velocityQuery = supabase
        .from('project_stage_events')
        .select('project_id, from_status, to_status, changed_at')
        .not('changed_at', 'is', null)
        .order('project_id', { ascending: true })
        .order('changed_at', { ascending: true })

      if (accessibleProjectIds) {
        velocityQuery = velocityQuery.in('project_id', accessibleProjectIds)
      }

      const { data, error } = await velocityQuery.returns<
        Array<{
          project_id: string | null
          from_status: Database['public']['Enums']['project_status'] | null
          to_status: Database['public']['Enums']['project_status'] | null
          changed_at: string | null
        }> | null
      >()

      if (error) {
        throw error
      }

      const lastStageByProject = new Map<string, { stage: Database['public']['Enums']['project_status']; changedAt: Date }>()
      const transitionTotals = new Map<string, { totalMs: number; count: number }>()

      const events = Array.isArray(data) ? data : []

      for (const event of events) {
        const projectId = event.project_id
        const toStatus = event.to_status as Database['public']['Enums']['project_status'] | null
        const fromStatus = event.from_status as Database['public']['Enums']['project_status'] | null
        const changedAt = event.changed_at ? new Date(event.changed_at) : null

        if (!projectId || !toStatus || !changedAt) {
          continue
        }

        const previous = lastStageByProject.get(projectId)
        if (previous && fromStatus && previous.stage === fromStatus) {
          const diffMs = changedAt.getTime() - previous.changedAt.getTime()
          if (diffMs > 0) {
            const key = `${fromStatus}→${toStatus}`
            const current = transitionTotals.get(key) ?? { totalMs: 0, count: 0 }
            current.totalMs += diffMs
            current.count += 1
            transitionTotals.set(key, current)
          }
        }

        lastStageByProject.set(projectId, { stage: toStatus, changedAt })
      }

      return Array.from(transitionTotals.entries())
        .map(([key, stats]) => {
          const avgDays = stats.totalMs / stats.count / MS_IN_DAY
          const [fromStatus, toStatus] = key.split('→')
          return {
            stage: `${fromStatus} → ${toStatus}`,
            days: Number(avgDays.toFixed(1)),
            count: stats.count,
          }
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
        .map(({ stage, days }) => ({ stage, days }))
    })()

    const upcomingPromise = (async (): Promise<UpcomingProject[]> => {
      let upcomingQuery = supabase
        .from('projects')
        .select('id, name, due_date, clients:client_id(name)')
        .not('due_date', 'is', null)
        .eq('archived', false)
        .order('due_date', { ascending: true })
        .limit(6)

      if (accessibleProjectIds) {
        upcomingQuery = upcomingQuery.in('id', accessibleProjectIds)
      }

      const { data, error } = await upcomingQuery.returns<
        Array<{
          id: string
          name: string
          due_date: string | null
          clients: { name: string | null } | null
        }> | null
      >()

      if (error) {
        throw error
      }

      const now = new Date()

      const upcomingRows = Array.isArray(data) ? data : []

      return upcomingRows.map((project) => {
        const dueDate = project.due_date ? new Date(project.due_date) : null
        let dueIn: number | null = null

        if (dueDate) {
          const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / MS_IN_DAY)
          dueIn = diffDays < 0 ? 0 : diffDays
        }

        return {
          id: project.id,
          name: project.name,
          client: project.clients?.name ?? 'Unknown client',
          dueIn,
        }
      })
    })()

    const activityPromise = (async (): Promise<ActivityFeedItem[]> => {
      if (!accessibleProjectIds && !activeAccountId) {
        return []
      }

      let activityQuery = supabase
        .from('project_stage_events')
        .select(
          `
            id,
            changed_at,
            from_status,
            to_status,
            projects!inner (
              id,
              name,
              account_id
            ),
            actor:changed_by_profile_id (
              full_name
            )
          `,
        )
        .not('changed_at', 'is', null)
        .order('changed_at', { ascending: false })
        .limit(6)

      if (accessibleProjectIds && accessibleProjectIds.length > 0) {
        activityQuery = activityQuery.in('project_id', accessibleProjectIds)
      } else if (activeAccountId) {
        activityQuery = activityQuery.eq('projects.account_id', activeAccountId)
      }

      const { data, error } = await activityQuery.returns<
        Array<{
          id: string | null
          changed_at: string | null
          from_status: Database['public']['Enums']['project_status'] | null
          to_status: Database['public']['Enums']['project_status'] | null
          projects: {
            id: string | null
            name: string | null
            account_id: string | null
          } | null
          actor: { full_name: string | null } | null
        }> | null
      >()

      if (error) {
        throw error
      }

      const stageEvents = Array.isArray(data) ? data : []

      return stageEvents.map((entry) => {
        const createdAt = entry.changed_at ? new Date(entry.changed_at) : null
        const actor = entry.actor?.full_name?.trim()
        const projectName = entry.projects?.name?.trim() || 'Project update'
        const toStatus = entry.to_status ?? null
        const fromStatus = entry.from_status ?? null

        let changeSummary = 'was updated'

        if (toStatus && fromStatus && fromStatus !== toStatus) {
          changeSummary = `moved from ${fromStatus} to ${toStatus}`
        } else if (toStatus) {
          changeSummary = `moved into ${toStatus}`
        }

        return {
          id: entry.id ?? `${entry.projects?.id ?? 'activity'}-${entry.changed_at ?? Date.now().toString()}`,
          author: actor && actor.length > 0 ? actor : 'System',
          description: `${projectName} · ${changeSummary}`,
          timeAgo: createdAt ? formatTimeAgo(createdAt) : 'Unknown time',
        }
      })
    })()

    const [pipelineOverview, revenueResult, velocityByStage, upcomingProjects, activityFeed] = await Promise.all([
      pipelinePromise,
      revenuePromise,
      velocityPromise,
      upcomingPromise,
      activityPromise,
    ])

    return NextResponse.json({
      pipelineOverview,
      revenuePerformance: revenueResult.revenue,
      winRate: revenueResult.winRate,
      velocityByStage,
      upcomingProjects,
      activityFeed,
    })
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ message: error.message }, { status: error.status })
    }

    console.error('dashboard route unexpected error:', error)
    return NextResponse.json({ message: 'Unable to load dashboard data.' }, { status: 500 })
  }
}
