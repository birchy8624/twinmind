interface ClientOverviewPageProps {
  params: {
    clientId: string
  }
}

const overviewSections = [
  {
    heading: 'Summary',
    body: 'High-level overview of current initiatives, health, and alignment.'
  },
  {
    heading: 'Active projects',
    body: 'List of ongoing workstreams, responsible leads, and timelines.'
  },
  {
    heading: 'Collaboration notes',
    body: 'Meeting recaps, decisions, and upcoming milestones for the client team.'
  }
]

export default function ClientOverviewPage({ params }: ClientOverviewPageProps) {
  const readableId = decodeURIComponent(params.clientId).replace(/-/g, ' ')

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold capitalize">{readableId}</h1>
        <p className="text-sm text-white/70">A hub for everything related to this client account.</p>
      </header>
      <div className="grid gap-4 lg:grid-cols-3">
        {overviewSections.map((section) => (
          <section
            key={section.heading}
            className="rounded-lg border border-white/10 bg-base-900/30 p-4"
          >
            <h2 className="text-sm font-semibold text-white/80">{section.heading}</h2>
            <p className="mt-2 text-sm text-white/65">{section.body}</p>
          </section>
        ))}
      </div>
    </div>
  )
}
