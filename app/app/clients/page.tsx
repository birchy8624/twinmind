import Link from 'next/link'

const clients = [
  { name: 'Acme Robotics', status: 'Onboarding' },
  { name: 'Northwind Analytics', status: 'Active' },
  { name: 'Orbit Labs', status: 'Proposal Sent' }
]

export default function ClientsPage() {
  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Clients</h1>
          <p className="text-sm text-white/70">Manage client records and track engagement status.</p>
        </div>
        <Link
          href="/app/clients/new"
          className="inline-flex items-center rounded-md bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/20"
        >
          + New client
        </Link>
      </header>
      <div className="space-y-3">
        {clients.map((client) => (
          <article
            key={client.name}
            className="flex items-center justify-between rounded-lg border border-white/10 bg-base-900/40 p-4 backdrop-blur"
          >
            <div>
              <div className="text-sm font-medium">{client.name}</div>
              <div className="text-xs text-white/60">{client.status}</div>
            </div>
            <Link
              href={`/app/clients/${encodeURIComponent(client.name.toLowerCase().replace(/\s+/g, '-'))}`}
              className="text-xs font-medium text-white/70 underline-offset-4 hover:text-white hover:underline"
            >
              View
            </Link>
          </article>
        ))}
      </div>
    </div>
  )
}
