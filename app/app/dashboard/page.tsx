'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { createBrowserClient } from '@/lib/supabase/browser'
import type { Database } from '@/types/supabase'

type ProjectStatus = Database['public']['Enums']['project_status']
type InvoiceStatus = Database['public']['Enums']['invoice_status']

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

const MS_IN_DAY = 1000 * 60 * 60 * 24

const ACTIVE_PIPELINE_STATUSES: ProjectStatus[] = [
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

const invoiceStatusToBucket = (status: InvoiceStatus) => {
  if (status === 'Quote' || status === 'Draft') {
    return 'quoted' as const
  }

  if (status === 'Sent') {
    return 'invoiced' as const
  }

  if (status === 'Paid') {
    return 'paid' as const
  }

  return null
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

const humanizeEntityType = (entityType: string) => {
  const normalized = entityType.replace(/_/g, ' ').trim()
  if (!normalized) {
    return 'Activity'
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

export default function DashboardPage() {
  const supabase = useMemo(createBrowserClient, [])

  const [pipelineOverview, setPipelineOverview] = useState<PipelineOverviewItem[]>([])
  const [pipelineLoading, setPipelineLoading] = useState(true)
  const [pipelineError, setPipelineError] = useState<string | null>(null)

  const [revenuePerformance, setRevenuePerformance] = useState<RevenuePerformanceItem[]>([])
  const [revenueLoading, setRevenueLoading] = useState(true)
  const [revenueError, setRevenueError] = useState<string | null>(null)

  const [velocityByStage, setVelocityByStage] = useState<VelocityItem[]>([])
  const [velocityLoading, setVelocityLoading] = useState(true)
  const [velocityError, setVelocityError] = useState<string | null>(null)

  const [winRate, setWinRate] = useState<{ quotes: number; paid: number } | null>(null)
  const [winRateLoading, setWinRateLoading] = useState(true)
  const [winRateError, setWinRateError] = useState<string | null>(null)

  const [upcomingProjects, setUpcomingProjects] = useState<UpcomingProject[]>([])
  const [upcomingLoading, setUpcomingLoading] = useState(true)
  const [upcomingError, setUpcomingError] = useState<string | null>(null)

  const [activityFeed, setActivityFeed] = useState<ActivityFeedItem[]>([])
  const [activityLoading, setActivityLoading] = useState(true)
  const [activityError, setActivityError] = useState<string | null>(null)

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }),
    [],
  )

  useEffect(() => {
    let isMounted = true

    setPipelineLoading(true)
    setRevenueLoading(true)
    setVelocityLoading(true)
    setWinRateLoading(true)
    setUpcomingLoading(true)
    setActivityLoading(true)

    const fetchPipelineData = async (): Promise<PipelineOverviewItem[]> => {
      const { data, error } = await supabase
        .from('projects')
        .select('status')
        .eq('archived', false)

      if (error) {
        throw new Error(error.message)
      }

      const counts = (data ?? []).reduce((acc, project) => {
        const status = project.status as ProjectStatus | null
        if (!status || !ACTIVE_PIPELINE_STATUSES.includes(status)) {
          return acc
        }

        acc[status] = (acc[status] ?? 0) + 1
        return acc
      }, {} as Record<ProjectStatus, number>)

      return ACTIVE_PIPELINE_STATUSES.map((status) => ({
        stage: status,
        count: counts[status] ?? 0,
      })).filter((item) => item.count > 0)
    }

    const fetchRevenueAndWinRate = async (): Promise<{
      revenue: RevenuePerformanceItem[]
      winRate: { quotes: number; paid: number }
    }> => {
      const { data, error } = await supabase
        .from('invoices')
        .select('status, amount, issued_at')

      if (error) {
        throw new Error(error.message)
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

      for (const invoice of data ?? []) {
        const bucket = invoiceStatusToBucket(invoice.status as InvoiceStatus)
        const amount = Number(invoice.amount ?? 0)
        const issuedAt = invoice.issued_at ? new Date(invoice.issued_at) : null

        if (invoice.status !== 'Cancelled') {
          quotesCount += 1
        }
        if (invoice.status === 'Paid') {
          paidCount += 1
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
    }

    const fetchVelocityData = async (): Promise<VelocityItem[]> => {
      const { data, error } = await supabase
        .from('project_stage_events')
        .select('project_id, from_status, to_status, changed_at')
        .not('changed_at', 'is', null)
        .order('project_id', { ascending: true })
        .order('changed_at', { ascending: true })

      if (error) {
        throw new Error(error.message)
      }

      const lastStageByProject = new Map<string, { stage: ProjectStatus; changedAt: Date }>()
      const transitionTotals = new Map<string, { totalMs: number; count: number }>()

      for (const event of data ?? []) {
        const projectId = event.project_id
        const toStatus = event.to_status as ProjectStatus | null
        const fromStatus = event.from_status as ProjectStatus | null
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

      const transitions = Array.from(transitionTotals.entries())
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

      return transitions.slice(0, 5).map(({ stage, days }) => ({ stage, days }))
    }

    const fetchUpcomingProjects = async (): Promise<UpcomingProject[]> => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, due_date, clients:client_id(name)')
        .not('due_date', 'is', null)
        .eq('archived', false)
        .order('due_date', { ascending: true })
        .limit(6)

      if (error) {
        throw new Error(error.message)
      }

      const now = new Date()

      return (data ?? []).map((project) => {
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
    }

    const fetchActivityFeed = async (): Promise<ActivityFeedItem[]> => {
      const { data, error } = await supabase
        .from('audit_log')
        .select('id, action, entity_type, created_at, profiles:actor_profile_id(full_name)')
        .order('created_at', { ascending: false })
        .limit(6)

      if (error) {
        throw new Error(error.message)
      }

      return (data ?? []).map((entry) => {
        const createdAt = entry.created_at ? new Date(entry.created_at) : null
        const actor = entry.profiles?.full_name?.trim()

        return {
          id: entry.id,
          author: actor && actor.length > 0 ? actor : 'System',
          description: `${humanizeEntityType(entry.entity_type)} · ${entry.action}`,
          timeAgo: createdAt ? formatTimeAgo(createdAt) : 'Unknown time',
        }
      })
    }

    Promise.allSettled([
      fetchPipelineData(),
      fetchRevenueAndWinRate(),
      fetchVelocityData(),
      fetchUpcomingProjects(),
      fetchActivityFeed(),
    ]).then((results) => {
      if (!isMounted) {
        return
      }

      const [pipelineResult, revenueResult, velocityResult, upcomingResult, activityResult] = results

      if (pipelineResult.status === 'fulfilled') {
        setPipelineOverview(pipelineResult.value)
        setPipelineError(null)
      } else {
        console.error('Failed to load pipeline data', pipelineResult.reason)
        setPipelineOverview([])
        setPipelineError('Unable to load pipeline data right now.')
      }
      setPipelineLoading(false)

      if (revenueResult.status === 'fulfilled') {
        setRevenuePerformance(revenueResult.value.revenue)
        setRevenueError(null)
        setWinRate(revenueResult.value.winRate)
        setWinRateError(null)
      } else {
        console.error('Failed to load revenue data', revenueResult.reason)
        setRevenuePerformance([])
        setRevenueError('Unable to load revenue performance.')
        setWinRate(null)
        setWinRateError('Unable to load win rate.')
      }
      setRevenueLoading(false)
      setWinRateLoading(false)

      if (velocityResult.status === 'fulfilled') {
        setVelocityByStage(velocityResult.value)
        setVelocityError(null)
      } else {
        console.error('Failed to load velocity data', velocityResult.reason)
        setVelocityByStage([])
        setVelocityError('Unable to load velocity data.')
      }
      setVelocityLoading(false)

      if (upcomingResult.status === 'fulfilled') {
        setUpcomingProjects(upcomingResult.value)
        setUpcomingError(null)
      } else {
        console.error('Failed to load upcoming projects', upcomingResult.reason)
        setUpcomingProjects([])
        setUpcomingError('Unable to load upcoming projects.')
      }
      setUpcomingLoading(false)

      if (activityResult.status === 'fulfilled') {
        setActivityFeed(activityResult.value)
        setActivityError(null)
      } else {
        console.error('Failed to load activity feed', activityResult.reason)
        setActivityFeed([])
        setActivityError('Unable to load activity feed.')
      }
      setActivityLoading(false)
    })

    return () => {
      isMounted = false
    }
  }, [supabase])

  const pipelineTotal = pipelineOverview.reduce((total, item) => total + item.count, 0)
  const hasPipelineData = pipelineOverview.length > 0

  const hasRevenueData = revenuePerformance.some(
    (item) => item.quoted > 0 || item.invoiced > 0 || item.paid > 0,
  )

  const hasVelocityData = velocityByStage.length > 0

  const winRatePercent =
    winRate && winRate.quotes > 0 ? Math.round((winRate.paid / winRate.quotes) * 100) : 0

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.3em] text-white/40">Operations</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Studio Dashboard</h1>
        <p className="mt-2 max-w-xl text-sm text-white/70">
          High-level insights across the studio pipeline, revenue motion, and delivery activity using the latest data sync.
        </p>
      </header>

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="rounded-lg border border-white/10 bg-base-900/40 p-6 shadow-sm backdrop-blur-xl">
          <header className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Pipeline overview</h2>
              <p className="text-xs text-white/60">Active work by delivery stage</p>
            </div>
            <span className="rounded-full bg-limeglow-500/10 px-3 py-1 text-xs font-medium text-limeglow-300">
              {pipelineLoading ? 'Loading…' : `${pipelineTotal} open`}
            </span>
          </header>
          {pipelineError ? (
            <p className="mt-6 text-sm text-red-300">{pipelineError}</p>
          ) : pipelineLoading ? (
            <p className="mt-6 text-sm text-white/60">Loading pipeline overview…</p>
          ) : hasPipelineData ? (
            <div className="mt-6 h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pipelineOverview} barSize={24}>
                  <defs>
                    <linearGradient id="pipelineGradient" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="5%" stopColor="#a3ff12" stopOpacity={0.9} />
                      <stop offset="95%" stopColor="#00ffa3" stopOpacity={0.25} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
                  <XAxis
                    dataKey="stage"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(255,255,255,0.08)' }}
                    contentStyle={{
                      background: '#0f172a',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '0.75rem',
                      color: 'white',
                    }}
                  />
                  <Bar dataKey="count" fill="url(#pipelineGradient)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="mt-6 text-sm text-white/60">No active work in the pipeline yet.</p>
          )}
        </section>

        <section className="rounded-lg border border-white/10 bg-base-900/40 p-6 shadow-sm backdrop-blur-xl">
          <header className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Revenue</h2>
              <p className="text-xs text-white/60">Quoted vs invoiced vs paid</p>
            </div>
            <span className="text-xs text-white/60">
              {revenueLoading ? 'Loading…' : 'Rolling 12-month trend'}
            </span>
          </header>
          {revenueError ? (
            <p className="mt-6 text-sm text-red-300">{revenueError}</p>
          ) : revenueLoading ? (
            <p className="mt-6 text-sm text-white/60">Loading revenue insights…</p>
          ) : hasRevenueData ? (
            <div className="mt-6 h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenuePerformance} barGap={8}>
                  <defs>
                    <linearGradient id="quotedGradient" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.2} />
                    </linearGradient>
                    <linearGradient id="invoicedGradient" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#fbbf24" stopOpacity={0.2} />
                    </linearGradient>
                    <linearGradient id="paidGradient" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#a3ff12" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#00ffa3" stopOpacity={0.25} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
                  <XAxis
                    dataKey="period"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }}
                  />
                  <YAxis
                    tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(255,255,255,0.08)' }}
                    formatter={(value: number | string) => currencyFormatter.format(Number(value))}
                    contentStyle={{
                      background: '#0f172a',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '0.75rem',
                      color: 'white',
                    }}
                  />
                  <Bar dataKey="quoted" name="Quoted" fill="url(#quotedGradient)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="invoiced" name="Invoiced" fill="url(#invoicedGradient)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="paid" name="Paid" fill="url(#paidGradient)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="mt-6 text-sm text-white/60">No invoice activity recorded this year.</p>
          )}
        </section>

        <section className="rounded-lg border border-white/10 bg-base-900/40 p-6 shadow-sm backdrop-blur-xl">
          <header className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Velocity</h2>
              <p className="text-xs text-white/60">Avg days between milestones</p>
            </div>
            <span className="text-xs text-white/60">
              {velocityLoading ? 'Loading…' : 'Based on stage transitions'}
            </span>
          </header>
          {velocityError ? (
            <p className="mt-6 text-sm text-red-300">{velocityError}</p>
          ) : velocityLoading ? (
            <p className="mt-6 text-sm text-white/60">Analyzing delivery velocity…</p>
          ) : hasVelocityData ? (
            <div className="mt-6 h-52">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={velocityByStage}>
                  <defs>
                    <linearGradient id="velocityGradient" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="5%" stopColor="#a855f7" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#a855f7" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
                  <XAxis
                    dataKey="stage"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }}
                  />
                  <Tooltip
                    cursor={{ stroke: 'rgba(255,255,255,0.2)', strokeWidth: 1 }}
                    formatter={(value: number | string) => `${Number(value).toFixed(1)} days`}
                    contentStyle={{
                      background: '#0f172a',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '0.75rem',
                      color: 'white',
                    }}
                  />
                  <Area type="monotone" dataKey="days" stroke="#a855f7" fill="url(#velocityGradient)" strokeWidth={2.5} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="mt-6 text-sm text-white/60">No stage transitions logged yet.</p>
          )}
        </section>

        <section className="rounded-lg border border-white/10 bg-base-900/40 p-6 shadow-sm backdrop-blur-xl">
          <header className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Win rate</h2>
              <p className="text-xs text-white/60">Quotes converted to paid</p>
            </div>
            <span className="text-xs text-white/60">
              {winRateLoading ? 'Loading…' : winRate ? `${winRate.quotes} invoices` : 'No invoices'}
            </span>
          </header>
          {winRateError ? (
            <p className="mt-6 text-sm text-red-300">{winRateError}</p>
          ) : winRateLoading ? (
            <p className="mt-6 text-sm text-white/60">Calculating win rate…</p>
          ) : winRate && winRate.quotes > 0 ? (
            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <div>
                <p className="text-4xl font-semibold text-white">{winRatePercent}%</p>
                <p className="mt-1 text-xs text-white/60">
                  {winRate.paid} paid of {winRate.quotes} quoted
                </p>
              </div>
              <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { label: 'Quotes', value: winRate.quotes },
                      { label: 'Paid', value: winRate.paid },
                    ]}
                    barCategoryGap={30}
                  >
                    <defs>
                      <linearGradient id="winGradient" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.2} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }}
                    />
                    <YAxis allowDecimals={false} hide />
                    <Tooltip
                      cursor={{ fill: 'rgba(255,255,255,0.08)' }}
                      contentStyle={{
                        background: '#0f172a',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '0.75rem',
                        color: 'white',
                      }}
                    />
                    <Bar dataKey="value" fill="url(#winGradient)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <p className="mt-6 text-sm text-white/60">No quotes captured yet.</p>
          )}
        </section>

        <section className="rounded-lg border border-white/10 bg-base-900/40 p-6 shadow-sm backdrop-blur-xl">
          <header className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Upcoming</h2>
              <p className="text-xs text-white/60">Projects due soon</p>
            </div>
            <span className="text-xs text-white/60">7 &amp; 14 day horizon</span>
          </header>
          {upcomingError ? (
            <p className="mt-6 text-sm text-red-300">{upcomingError}</p>
          ) : upcomingLoading ? (
            <p className="mt-6 text-sm text-white/60">Fetching upcoming work…</p>
          ) : upcomingProjects.length > 0 ? (
            <ul className="mt-6 space-y-4">
              {upcomingProjects.map((project) => (
                <li key={project.id} className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-white">{project.name}</p>
                    <p className="text-xs text-white/60">{project.client}</p>
                  </div>
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/80">
                    {project.dueIn === null ? 'Date TBC' : `Due in ${project.dueIn} days`}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-6 text-sm text-white/60">No upcoming projects scheduled.</p>
          )}
        </section>

        <section className="rounded-lg border border-white/10 bg-base-900/40 p-6 shadow-sm backdrop-blur-xl xl:col-span-2">
          <header className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Activity feed</h2>
              <p className="text-xs text-white/60">Latest collaboration across the team</p>
            </div>
            <span className="text-xs text-white/60">
              {activityLoading ? 'Loading…' : 'Updated from audit trail'}
            </span>
          </header>
          {activityError ? (
            <p className="mt-6 text-sm text-red-300">{activityError}</p>
          ) : activityLoading ? (
            <p className="mt-6 text-sm text-white/60">Syncing recent activity…</p>
          ) : activityFeed.length > 0 ? (
            <ul className="mt-6 space-y-4">
              {activityFeed.map((activity) => (
                <li key={activity.id} className="flex items-start gap-4 rounded-lg border border-white/5 bg-white/5 p-4">
                  <div className="mt-1 h-2 w-2 rounded-full bg-limeglow-500" />
                  <div>
                    <p className="text-sm text-white">
                      <span className="font-medium text-white">{activity.author}</span>{' '}
                      {activity.description}
                    </p>
                    <p className="mt-1 text-xs text-white/60">{activity.timeAgo}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-6 text-sm text-white/60">No recent activity to display.</p>
          )}
        </section>
      </div>
    </div>
  )
}
