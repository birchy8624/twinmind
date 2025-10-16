interface ProjectOverviewPageProps {
  params: {
    projectId: string
  }
}

const sections = [
  {
    title: 'Overview',
    description: 'Purpose, scope, and outcomes of the engagement.'
  },
  {
    title: 'Timeline',
    description: 'Milestones, sprints, and key delivery checkpoints.'
  },
  {
    title: 'Files & Assets',
    description: 'Contracts, design files, and shared resources.'
  }
]

export default function ProjectOverviewPage({ params }: ProjectOverviewPageProps) {
  const readableId = decodeURIComponent(params.projectId).replace(/-/g, ' ')

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold capitalize">{readableId}</h1>
        <p className="text-sm text-white/70">Centralize delivery context, decisions, and documentation.</p>
      </header>
      <div className="space-y-4">
        {sections.map((section) => (
          <section
            key={section.title}
            className="rounded-lg border border-white/10 bg-base-900/30 p-4"
          >
            <h2 className="text-sm font-semibold text-white/80">{section.title}</h2>
            <p className="mt-2 text-sm text-white/65">{section.description}</p>
          </section>
        ))}
      </div>
    </div>
  )
}
