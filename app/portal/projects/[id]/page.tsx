interface PortalProjectPageProps {
  params: {
    id: string
  }
}

const tabs = ['Status', 'Files', 'Comments']

export default function PortalProjectDetailPage({ params }: PortalProjectPageProps) {
  const readableId = decodeURIComponent(params.id).replace(/-/g, ' ')

  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-xl font-semibold capitalize">{readableId}</h2>
        <p className="text-sm text-white/70">Review delivery progress, shared resources, and message threads.</p>
      </header>
      <nav className="flex flex-wrap gap-2 text-xs font-medium text-white/70">
        {tabs.map((tab) => (
          <span key={tab} className="rounded-full bg-white/10 px-3 py-1">
            {tab}
          </span>
        ))}
      </nav>
      <div className="rounded-lg border border-white/10 bg-base-900/30 p-4">
        <h3 className="text-sm font-semibold text-white/80">Latest update</h3>
        <p className="mt-2 text-sm text-white/65">
          Sprint deliverables are ready for review. Please leave comments directly on the Figma file and drop any
          questions in the comments tab.
        </p>
      </div>
    </section>
  )
}
