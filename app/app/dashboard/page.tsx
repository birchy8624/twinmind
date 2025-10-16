'use client'

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

const pipelineOverview = [
  { stage: 'Backlog', count: 9 },
  { stage: 'Brief', count: 7 },
  { stage: 'Build', count: 5 },
  { stage: 'Review', count: 3 },
  { stage: 'Handover', count: 2 },
]

const revenuePerformance = [
  { period: 'This Month', quoted: 48000, invoiced: 36000, paid: 29000 },
  { period: 'Last Month', quoted: 42000, invoiced: 31000, paid: 26000 },
  { period: 'YTD Avg', quoted: 51000, invoiced: 38000, paid: 33000 },
]

const velocityByStage = [
  { stage: 'Backlog → Brief', days: 3.2 },
  { stage: 'Brief → Build', days: 5.1 },
  { stage: 'Build → Review', days: 4.4 },
  { stage: 'Review → Handover', days: 2.6 },
]

const winRate = { quotes: 28, paid: 17 }

const upcomingProjects = [
  { name: 'Aurora Rebrand', client: 'Lumen Labs', dueIn: 4 },
  { name: 'Orbit Mobile', client: 'Halo Systems', dueIn: 9 },
  { name: 'Summit Launch', client: 'Northwind', dueIn: 13 },
]

const activityFeed = [
  { id: 1, type: 'comment', author: 'Sasha', description: 'Left feedback on Orbit Mobile designs', timeAgo: '2h ago' },
  { id: 2, type: 'file', author: 'Mila', description: 'Uploaded handover package for Lumen Labs', timeAgo: '5h ago' },
  { id: 3, type: 'status', author: 'Kai', description: 'Moved Summit Launch to Build stage', timeAgo: 'Yesterday' },
  { id: 4, type: 'comment', author: 'Noah', description: 'Shared discovery notes with Halo Systems', timeAgo: 'Yesterday' },
]

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

export default function DashboardPage() {
  const winRatePercent = Math.round((winRate.paid / winRate.quotes) * 100)

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.3em] text-white/40">Operations</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Studio Dashboard</h1>
        <p className="mt-2 max-w-xl text-sm text-white/70">
          High-level insights across the studio pipeline, revenue motion, and delivery activity using the latest data
          sync.
        </p>
      </header>

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="rounded-lg border border-white/10 bg-base-900/40 p-6 shadow-sm backdrop-blur-xl">
          <header className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Pipeline overview</h2>
              <p className="text-xs text-white/60">Active work by delivery stage</p>
            </div>
            <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
              {pipelineOverview.reduce((total, item) => total + item.count, 0)} open
            </span>
          </header>
          <div className="mt-6 h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pipelineOverview} barSize={24}>
                <defs>
                  <linearGradient id="pipelineGradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#34d399" stopOpacity={0.9} />
                    <stop offset="95%" stopColor="#34d399" stopOpacity={0.2} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
                <XAxis dataKey="stage" tickLine={false} axisLine={false} tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }} />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.08)' }}
                  contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.75rem', color: 'white' }}
                />
                <Bar dataKey="count" fill="url(#pipelineGradient)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
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
                    <stop offset="0%" stopColor="#34d399" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#34d399" stopOpacity={0.2} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
                <XAxis dataKey="period" tickLine={false} axisLine={false} tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }} />
                <YAxis tickFormatter={(value) => `${value / 1000}k`} tickLine={false} axisLine={false} tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }} />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.08)' }}
                  formatter={(value: number | string) => currencyFormatter.format(Number(value))}
                  contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.75rem', color: 'white' }}
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
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={velocityByStage}>
                <defs>
                  <linearGradient id="velocityGradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#a855f7" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#a855f7" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
                <XAxis dataKey="stage" tickLine={false} axisLine={false} tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }} />
                <Tooltip
                  cursor={{ stroke: 'rgba(255,255,255,0.2)', strokeWidth: 1 }}
                  formatter={(value: number | string) => `${Number(value).toFixed(1)} days`}
                  contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.75rem', color: 'white' }}
                />
                <Area type="monotone" dataKey="days" stroke="#a855f7" fill="url(#velocityGradient)" strokeWidth={2.5} />
              </AreaChart>
            </ResponsiveContainer>
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
                    contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.75rem', color: 'white' }}
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
            <span className="text-xs text-white/60">7 & 14 day horizon</span>
          </header>
          <ul className="mt-6 space-y-4">
            {upcomingProjects.map((project) => (
              <li key={project.name} className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-white">{project.name}</p>
                  <p className="text-xs text-white/60">{project.client}</p>
                </div>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/80">
                  Due in {project.dueIn} days
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-lg border border-white/10 bg-base-900/40 p-6 shadow-sm backdrop-blur-xl xl:col-span-2">
          <header className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Activity feed</h2>
              <p className="text-xs text-white/60">Latest collaboration across the team</p>
            </div>
            <span className="text-xs text-white/60">Updated hourly</span>
          </header>
          <ul className="mt-6 space-y-4">
            {activityFeed.map((activity) => (
              <li key={activity.id} className="flex items-start gap-4 rounded-lg border border-white/5 bg-white/5 p-4">
                <div className="mt-1 h-2 w-2 rounded-full bg-emerald-300" />
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
        </section>
      </div>
    </div>
  )
}
