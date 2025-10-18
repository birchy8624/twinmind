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

const PROJECTS = 'projects' as const
const AUDIT_LOG = 'audit_log' as const
const STAGE_EVENTS = 'project_stage_events' as const

const revenuePerformance = [
  { period: 'This Month', quoted: 48000, invoiced: 36000, paid: 29000 },
  { period: 'Last Month', quoted: 42000, invoiced: 31000, paid: 26000 },
  { period: 'YTD Avg', quoted: 51000, invoiced: 38000, paid: 33000 },
]

const winRate = { quotes: 28, paid: 17 }

const PIPELINE_STATUS_ORDER: Database['public']['Enums']['project_status'][] = [
  'Backlog',
  'Call Arranged',
  'Brief Gathered',
  'UI Stage',
  'DB Stage',
  'Auth Stage',
  'Build',
  'QA',
  'Handover',
  'Closed',
]

const ACTIVE_PROJECT_STATUSES = PIPELINE_STATUS_ORDER.filter((status) => status !== 'Closed')
const PIPELINE_STATUS_SET = new Set(PIPELINE_STATUS_ORDER)

const UPCOMING_WINDOW_DAYS = 14
const ACTIVITY_LIMIT = 6
const STAGE_EVENT_LIMIT = 400
const MS_PER_DAY = 1000 * 60 * 60 * 24

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

const relativeTimeFormatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

const relativeTimeDivisions: { amount: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { amount: 60, unit: 'second' },
  { amount: 60, unit: 'minute' },
  { amount: 24, unit: 'hour' },
  { amount: 7, unit: 'day' },
  { amount: 4.34524, unit: 'week' },
  { amount: 12, unit: 'month' },
  { amount: Number.POSITIVE_INFINITY, unit: 'year' },
]

type PipelineStage = { stage: string; count: number }
type UpcomingProject = { id: string; name: string; clientName: string; dueInDays: number; dueLabel: string }
type ActivityItem = { id: string; author: string; description: string; timeAgo: string }
type VelocityItem = { stage: string; days: number }

type ProjectRow = Database['public']['Tables']['projects']['Row']
type ClientRow = Database['public']['Tables']['clients']['Row']
type AuditLogRow = Database['public']['Tables']['audit_log']['Row']
type StageEventRow = Database['public']['Tables']['project_stage_events']['Row']
type ProfileRow = Database['public']['Tables']['profiles']['Row']

type ProjectStatus = Database['public']['Enums']['project_status']

function formatRelativeTimeFromNow(value: string | null) {
  if (!value) return 'Unknown time'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown time'

  let duration = (date.getTime() - Date.now()) / 1000

  for (const division of relativeTimeDivisions) {
    if (Math.abs(duration) < division.amount) {
      return relativeTimeFormatter.format(Math.round(duration), division.unit)
    }
    duration /= division.amount
  }

  return 'Unknown time'
}

function capitalize(value: string) {
  if (!value) return ''
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function normalizeEntityName(value: string) {
  return value
    .replace(/[_\s]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((segment) => capitalize(segment.toLowerCase()))
    .join(' ')
}

function extractActivityDescription(entry: AuditLogRow): string {
  const baseDescription = `${capitalize(entry.action)} on ${normalizeEntityName(entry.entity_type)}`
  const meta = entry.meta

  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) {
    return baseDescription
  }

  const record = meta as Record<string, unknown>
  const preferredKeys = ['description', 'summary', 'message', 'detail', 'details', 'note']

  for (const key of preferredKeys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim()
    }
  }

  const projectName = record.project_name
  const status = record.status ?? record.to_status
  if (typeof projectName === 'string' && typeof status === 'string') {
    return `${projectName} → ${status}`
  }

  const entityName = record.entity_name ?? record.project ?? record.client
  if (typeof entityName === 'string' && entityName.trim().length > 0) {
    return `${baseDescription}: ${entityName.trim()}`
  }

  return baseDescription
}

function computeDueInfo(value: string | null) {
  if (!value) {
    return { dueInDays: null, dueLabel: 'No due date' }
  }

  const dueDate = new Date(value)
  if (Number.isNaN(dueDate.getTime())) {
    return { dueInDays: null, dueLabel: 'No due date' }
  }

  const today = new Date()
  const dueUTC = Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate())
  const todayUTC = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())

  const diffDays = Math.round((dueUTC - todayUTC) / MS_PER_DAY)

  if (diffDays < 0) {
    const absolute = Math.abs(diffDays)
    return { dueInDays: diffDays, dueLabel: absolute === 1 ? 'Overdue by 1 day' : `Overdue by ${absolute} days` }
  }

  if (diffDays === 0) {
    return { dueInDays: diffDays, dueLabel: 'Due today' }
  }

  if (diffDays === 1) {
    return { dueInDays: diffDays, dueLabel: 'Due tomorrow' }
  }

  return { dueInDays: diffDays, dueLabel: `Due in ${diffDays} days` }
}

function computeTransitionOrder(stage: string) {
  const [fromStatus, toStatus] = stage.split(' → ') as [ProjectStatus | undefined, ProjectStatus | undefined]
  const fromIndex = fromStatus ? PIPELINE_STATUS_ORDER.indexOf(fromStatus) : -1
  const toIndex = toStatus ? PIPELINE_STATUS_ORDER.indexOf(toStatus) : -1

  if (fromIndex === -1 || toIndex === -1) {
    return Number.MAX_SAFE_INTEGER
  }

  return fromIndex * PIPELINE_STATUS_ORDER.length + toIndex
}

export default function DashboardPage() {
  const [pipelineOverview, setPipelineOverview] = useState<PipelineStage[]>([])
  const [upcomingProjects, setUpcomingProjects] = useState<UpcomingProject[]>([])
  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([])
  const [velocityByStage, setVelocityByStage] = useState<VelocityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [globalError, setGlobalError] = useState<string | null>(null)
  const [activityError, setActivityError] = useState<string | null>(null)
  const [velocityError, setVelocityError] = useState<string | null>(null)

  const supabase = useMemo(createBrowserClient, [])

  useEffect(() => {
    let isMounted = true

    const fetchDashboardData = async () => {
      setLoading(true)
      setGlobalError(null)
      setActivityError(null)
      setVelocityError(null)

      try {
        const { data: projectsData, error: projectsError } = await supabase
          .from(PROJECTS)
          .select('id,name,status,due_date,clients:client_id(id,name)')
          .neq('status', 'Archived')

        if (!isMounted) {
          return
        }

        if (projectsError) {
          console.error(projectsError)
          setGlobalError('We ran into an issue loading pipeline insights. Please try again shortly.')
          setPipelineOverview([])
          setUpcomingProjects([])
        } else {
          type ProjectQuery = ProjectRow & { clients: Pick<ClientRow, 'id' | 'name'> | null }
          const typedProjects = (projectsData ?? []) as ProjectQuery[]

          const counts = new Map<ProjectStatus, number>()

          typedProjects.forEach((project) => {
            const status = project.status
            if (!status || status === 'Archived') {
              return
            }

            counts.set(status, (counts.get(status) ?? 0) + 1)
          })

          const pipelineData = PIPELINE_STATUS_ORDER.map((status) => ({
            stage: status,
            count: counts.get(status) ?? 0,
          })).filter((stage) => stage.count > 0)

          const normalizedUpcoming = typedProjects
            .map((project) => {
              const { dueInDays, dueLabel } = computeDueInfo(project.due_date)
              return {
                id: project.id,
                name: project.name,
                clientName: project.clients?.name ?? 'Unknown client',
                dueInDays,
                dueLabel,
                status: project.status,
              }
            })
            .filter(
              (
                project
              ): project is typeof project & { dueInDays: number; status: ProjectStatus } =>
                project.dueInDays !== null &&
                project.dueInDays >= 0 &&
                project.dueInDays <= UPCOMING_WINDOW_DAYS &&
                project.status !== null &&
                project.status !== 'Closed' &&
                project.status !== 'Archived' &&
                ACTIVE_PROJECT_STATUSES.includes(project.status)
            )
            .sort((a, b) => a.dueInDays - b.dueInDays)
            .slice(0, 5)
            .map(({ status: _status, ...rest }) => rest)

          setPipelineOverview(pipelineData)
          setUpcomingProjects(normalizedUpcoming)
        }

        const { data: activityData, error: activityFetchError } = await supabase
          .from(AUDIT_LOG)
          .select('id,action,entity_type,created_at,meta,actor:actor_profile_id(id,full_name)')
          .order('created_at', { ascending: false })
          .limit(ACTIVITY_LIMIT)

        if (!isMounted) {
          return
        }

        if (activityFetchError) {
          console.error(activityFetchError)
          setActivityError("We couldn't load recent activity.")
          setActivityFeed([])
        } else {
          type ActivityQuery = AuditLogRow & { actor: Pick<ProfileRow, 'id' | 'full_name'> | null }
          const typedActivity = (activityData ?? []) as ActivityQuery[]
          const normalizedActivity: ActivityItem[] = typedActivity.map((activity) => ({
            id: activity.id,
            author: activity.actor?.full_name?.trim() || 'System',
            description: extractActivityDescription(activity),
            timeAgo: formatRelativeTimeFromNow(activity.created_at),
          }))

          setActivityFeed(normalizedActivity)
        }

        const { data: stageEventsData, error: stageEventsError } = await supabase
          .from(STAGE_EVENTS)
          .select('project_id,to_status,changed_at')
          .order('changed_at', { ascending: false })
          .limit(STAGE_EVENT_LIMIT)

        if (!isMounted) {
          return
        }

        if (stageEventsError) {
          console.error(stageEventsError)
          setVelocityError("We couldn't load velocity insights.")
          setVelocityByStage([])
        } else {
          const eventsByProject = new Map<string, StageEventRow[]>()
          const typedStageEvents = (stageEventsData ?? []) as Pick<StageEventRow, 'project_id' | 'to_status' | 'changed_at'>[]

          typedStageEvents.forEach((event) => {
            if (!eventsByProject.has(event.project_id)) {
              eventsByProject.set(event.project_id, [])
            }
            eventsByProject.get(event.project_id)!.push(event as StageEventRow)
          })

          const transitionDurations = new Map<string, { totalMs: number; count: number }>()

          eventsByProject.forEach((events) => {
            events.sort((a, b) => {
              const aTime = a.changed_at ? new Date(a.changed_at).getTime() : Number.NEGATIVE_INFINITY
              const bTime = b.changed_at ? new Date(b.changed_at).getTime() : Number.NEGATIVE_INFINITY
              return aTime - bTime
            })

            let previousEvent: { status: ProjectStatus; timestamp: number } | null = null

            events.forEach((event) => {
              const toStatus = event.to_status
              const timestamp = event.changed_at ? new Date(event.changed_at).getTime() : NaN

              if (!PIPELINE_STATUS_SET.has(toStatus) || Number.isNaN(timestamp)) {
                previousEvent = null
                return
              }

              if (previousEvent && PIPELINE_STATUS_SET.has(previousEvent.status)) {
                const durationMs = timestamp - previousEvent.timestamp
                if (durationMs > 0) {
                  const transitionLabel = `${previousEvent.status} → ${toStatus}`
                  const current = transitionDurations.get(transitionLabel) ?? { totalMs: 0, count: 0 }
                  current.totalMs += durationMs
                  current.count += 1
                  transitionDurations.set(transitionLabel, current)
                }
              }

              previousEvent = { status: toStatus, timestamp }
            })
          })

          const velocityData = Array.from(transitionDurations.entries())
            .map(([stage, stats]) => ({
              stage,
              days: Number(((stats.totalMs / stats.count) / MS_PER_DAY).toFixed(1)),
            }))
            .filter((entry) => Number.isFinite(entry.days) && entry.days > 0)
            .sort((a, b) => {
              const orderA = computeTransitionOrder(a.stage)
              const orderB = computeTransitionOrder(b.stage)
              if (orderA === orderB) {
                return a.stage.localeCompare(b.stage)
              }
              return orderA - orderB
            })

          setVelocityByStage(velocityData)
        }
      } catch (error) {
        console.error(error)
        if (isMounted) {
          setGlobalError('We hit an unexpected issue loading dashboard insights. Please refresh the page.')
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    void fetchDashboardData()

    return () => {
      isMounted = false
    }
  }, [supabase])

  const totalPipeline = pipelineOverview.reduce((total, item) => total + item.count, 0)
  const winRatePercent = Math.round((winRate.paid / winRate.quotes) * 100)

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.3em] text-white/40">Operations</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Studio Dashboard</h1>
        <p className="mt-2 max-w-xl text-sm text-white/70">
          High-level insights across the studio pipeline, revenue motion, and delivery activity using the latest data sync.
        </p>
      </header>

      {globalError ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{globalError}</div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="rounded-lg border border-white/10 bg-base-900/40 p-6 shadow-sm backdrop-blur-xl">
          <header className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Pipeline overview</h2>
              <p className="text-xs text-white/60">Active work by delivery stage</p>
            </div>
            <span className="rounded-full bg-limeglow-500/10 px-3 py-1 text-xs font-medium text-limeglow-300">
              {loading ? 'Loading…' : `${totalPipeline} open`}
            </span>
          </header>
          <div className="mt-6 h-52">
            {loading ? (
              <div className="flex h-full items-center justify-center text-xs text-white/60">Loading pipeline data…</div>
            ) : pipelineOverview.length > 0 ? (
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
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-white/60">
                {globalError ? 'Pipeline data unavailable.' : 'No active pipeline items yet.'}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-white/10 bg-base-900/40 p-6 shadow-sm backdrop-blur-xl">
          <header className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Revenue</h2>
              <p className="text-xs text-white/60">Quoted vs invoiced vs paid</p>
            </div>
            <span className="text-xs text-white/60">Mock data</span>
          </header>
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
                  tickFormatter={(value) => `${value / 1000}k`}
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
        </section>

        <section className="rounded-lg border border-white/10 bg-base-900/40 p-6 shadow-sm backdrop-blur-xl">
          <header className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Velocity</h2>
              <p className="text-xs text-white/60">Avg days between milestones</p>
            </div>
            <span className="text-xs text-white/60">Audit log trend</span>
          </header>
          <div className="mt-6 h-52">
            {loading ? (
              <div className="flex h-full items-center justify-center text-xs text-white/60">Loading velocity…</div>
            ) : velocityByStage.length > 0 ? (
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
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-white/60">
                {velocityError ?? 'No stage transitions captured yet.'}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-white/10 bg-base-900/40 p-6 shadow-sm backdrop-blur-xl">
          <header className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Win rate</h2>
              <p className="text-xs text-white/60">Quotes converted to paid</p>
            </div>
            <span className="text-xs text-white/60">{winRate.quotes} quotes</span>
          </header>
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div>
              <p className="text-4xl font-semibold text-white">{winRatePercent}%</p>
              <p className="mt-1 text-xs text-white/60">{winRate.paid} paid of {winRate.quotes} quoted</p>
            </div>
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[{ label: 'Quotes', value: winRate.quotes }, { label: 'Paid', value: winRate.paid }]} barCategoryGap={30}>
                  <defs>
                    <linearGradient id="winGradient" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.2} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }} />
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
        </section>

        <section className="rounded-lg border border-white/10 bg-base-900/40 p-6 shadow-sm backdrop-blur-xl">
          <header className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Upcoming</h2>
              <p className="text-xs text-white/60">Projects due soon</p>
            </div>
            <span className="text-xs text-white/60">Next {UPCOMING_WINDOW_DAYS} days</span>
          </header>
          {loading ? (
            <p className="mt-6 text-xs text-white/60">Loading upcoming projects…</p>
          ) : upcomingProjects.length > 0 ? (
            <ul className="mt-6 space-y-4">
              {upcomingProjects.map((project) => (
                <li key={project.id} className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-white">{project.name}</p>
                    <p className="text-xs text-white/60">{project.clientName}</p>
                  </div>
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/80">{project.dueLabel}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-6 text-xs text-white/60">
              {globalError ? 'Upcoming projects unavailable right now.' : 'No projects due in the next 14 days.'}
            </p>
          )}
        </section>

        <section className="rounded-lg border border-white/10 bg-base-900/40 p-6 shadow-sm backdrop-blur-xl xl:col-span-2">
          <header className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Activity feed</h2>
              <p className="text-xs text-white/60">Latest collaboration across the team</p>
            </div>
            <span className="text-xs text-white/60">Updated hourly</span>
          </header>
          {loading ? (
            <div className="mt-6 flex h-40 items-center justify-center text-xs text-white/60">Loading activity…</div>
          ) : activityError ? (
            <p className="mt-6 text-xs text-white/60">{activityError}</p>
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
            <p className="mt-6 text-xs text-white/60">No recent activity captured yet.</p>
          )}
        </section>
      </div>
    </div>
  )
}
