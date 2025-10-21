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

import {
  fetchDashboardSummary,
  type ActivityFeedItem,
  type PipelineOverviewItem,
  type RevenuePerformanceItem,
  type UpcomingProject,
  type VelocityItem,
  type WinRate,
} from '@/lib/api/dashboard'

import { useCustomization } from '../_components/customization-context'

export default function DashboardPage() {
  const { resolvedTheme } = useCustomization()

  const [pipelineOverview, setPipelineOverview] = useState<PipelineOverviewItem[]>([])
  const [pipelineLoading, setPipelineLoading] = useState(true)
  const [pipelineError, setPipelineError] = useState<string | null>(null)

  const [revenuePerformance, setRevenuePerformance] = useState<RevenuePerformanceItem[]>([])
  const [revenueLoading, setRevenueLoading] = useState(true)
  const [revenueError, setRevenueError] = useState<string | null>(null)

  const [velocityByStage, setVelocityByStage] = useState<VelocityItem[]>([])
  const [velocityLoading, setVelocityLoading] = useState(true)
  const [velocityError, setVelocityError] = useState<string | null>(null)

  const [winRate, setWinRate] = useState<WinRate | null>(null)
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

  const chartAppearance = useMemo(
    () => {
      const isLight = resolvedTheme === 'light'
      return {
        grid: isLight ? 'rgba(23,30,45,0.12)' : 'rgba(255,255,255,0.08)',
        axis: isLight ? 'rgba(23,30,45,0.7)' : 'rgba(255,255,255,0.6)',
        tooltip: {
          background: isLight ? 'rgba(255,255,255,0.95)' : '#0f172a',
          border: isLight ? '1px solid rgba(15,23,42,0.08)' : '1px solid rgba(255,255,255,0.1)',
          color: isLight ? '#0f172a' : 'white',
          boxShadow: isLight ? '0 18px 45px rgba(15,23,42,0.12)' : '0 18px 45px rgba(15,23,42,0.4)',
        },
        barCursor: isLight ? 'rgba(23,30,45,0.08)' : 'rgba(255,255,255,0.08)',
        areaCursor: isLight ? 'rgba(23,30,45,0.2)' : 'rgba(255,255,255,0.2)',
      }
    },
    [resolvedTheme],
  )

  useEffect(() => {
    let isMounted = true

    setPipelineLoading(true)
    setRevenueLoading(true)
    setVelocityLoading(true)
    setWinRateLoading(true)
    setUpcomingLoading(true)
    setActivityLoading(true)
    fetchDashboardSummary()
      .then((data) => {
        if (!isMounted) {
          return
        }

        setPipelineOverview(data.pipelineOverview)
        setPipelineError(null)

        setRevenuePerformance(data.revenuePerformance)
        setRevenueError(null)
        setWinRate(data.winRate)
        setWinRateError(null)

        setVelocityByStage(data.velocityByStage)
        setVelocityError(null)

        setUpcomingProjects(data.upcomingProjects)
        setUpcomingError(null)

        setActivityFeed(data.activityFeed)
        setActivityError(null)
      })
      .catch((error) => {
        console.error('Failed to load dashboard data', error)
        if (!isMounted) {
          return
        }

        setPipelineOverview([])
        setPipelineError('Unable to load pipeline data right now.')

        setRevenuePerformance([])
        setRevenueError('Unable to load revenue performance.')
        setWinRate(null)
        setWinRateError('Unable to load win rate.')

        setVelocityByStage([])
        setVelocityError('Unable to load velocity data.')

        setUpcomingProjects([])
        setUpcomingError('Unable to load upcoming projects.')

        setActivityFeed([])
        setActivityError('Unable to load activity feed.')
      })
      .finally(() => {
        if (!isMounted) {
          return
        }

        setPipelineLoading(false)
        setRevenueLoading(false)
        setVelocityLoading(false)
        setWinRateLoading(false)
        setUpcomingLoading(false)
        setActivityLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

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
                  <CartesianGrid strokeDasharray="3 3" stroke={chartAppearance.grid} vertical={false} />
                  <XAxis
                    dataKey="stage"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: chartAppearance.axis, fontSize: 12 }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: chartAppearance.axis, fontSize: 12 }}
                  />
                  <Tooltip
                    cursor={{ fill: chartAppearance.barCursor }}
                    contentStyle={{
                      background: chartAppearance.tooltip.background,
                      border: chartAppearance.tooltip.border,
                      borderRadius: '0.75rem',
                      color: chartAppearance.tooltip.color,
                      boxShadow: chartAppearance.tooltip.boxShadow,
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
                  <CartesianGrid strokeDasharray="3 3" stroke={chartAppearance.grid} vertical={false} />
                  <XAxis
                    dataKey="period"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: chartAppearance.axis, fontSize: 12 }}
                  />
                  <YAxis
                    tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: chartAppearance.axis, fontSize: 12 }}
                  />
                  <Tooltip
                    cursor={{ fill: chartAppearance.barCursor }}
                    formatter={(value: number | string) => currencyFormatter.format(Number(value))}
                    contentStyle={{
                      background: chartAppearance.tooltip.background,
                      border: chartAppearance.tooltip.border,
                      borderRadius: '0.75rem',
                      color: chartAppearance.tooltip.color,
                      boxShadow: chartAppearance.tooltip.boxShadow,
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
                  <CartesianGrid strokeDasharray="3 3" stroke={chartAppearance.grid} vertical={false} />
                  <XAxis
                    dataKey="stage"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: chartAppearance.axis, fontSize: 12 }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: chartAppearance.axis, fontSize: 12 }}
                  />
                  <Tooltip
                    cursor={{ stroke: chartAppearance.areaCursor, strokeWidth: 1 }}
                    formatter={(value: number | string) => `${Number(value).toFixed(1)} days`}
                    contentStyle={{
                      background: chartAppearance.tooltip.background,
                      border: chartAppearance.tooltip.border,
                      borderRadius: '0.75rem',
                      color: chartAppearance.tooltip.color,
                      boxShadow: chartAppearance.tooltip.boxShadow,
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
                      tick={{ fill: chartAppearance.axis, fontSize: 12 }}
                    />
                    <YAxis allowDecimals={false} hide />
                    <Tooltip
                      cursor={{ fill: chartAppearance.barCursor }}
                      contentStyle={{
                        background: chartAppearance.tooltip.background,
                        border: chartAppearance.tooltip.border,
                        borderRadius: '0.75rem',
                        color: chartAppearance.tooltip.color,
                        boxShadow: chartAppearance.tooltip.boxShadow,
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
              {upcomingProjects.slice(0, 4).map((project) => (
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
