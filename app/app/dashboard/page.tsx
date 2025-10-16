const metrics = [
  { label: 'Active Clients', value: '12' },
  { label: 'Open Projects', value: '8' },
  { label: 'Avg. Response Time', value: '1.6h' },
  { label: 'Invoices Due', value: '3' }
]

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Studio Metrics</h1>
        <p className="text-sm text-white/70">Track the health of the studio at a glance.</p>
      </header>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="rounded-lg border border-white/10 bg-base-900/40 p-4 shadow-sm backdrop-blur"
          >
            <div className="text-xs uppercase tracking-wide text-white/60">{metric.label}</div>
            <div className="mt-2 text-2xl font-semibold">{metric.value}</div>
          </div>
        ))}
      </section>
    </div>
  )
}
