import Link from 'next/link'

const projectSummaries = [
  { id: 'atlas-ui-refresh', name: 'Atlas UI Refresh', status: 'On Track', next: 'Sprint review Tuesday' },
  { id: 'helios-data-room', name: 'Helios Data Room', status: 'Needs Feedback', next: 'Approve revised data schema' }
]

export default function PortalProjectsPage() {
  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-xl font-semibold">Projects</h2>
        <p className="text-sm text-white/70">Stay aligned on timelines, files, and communication threads.</p>
      </header>
      <div className="space-y-3">
        {projectSummaries.map((project) => (
          <article
            key={project.id}
            className="rounded-lg border border-white/10 bg-base-900/30 p-4"
          >
            <h3 className="text-lg font-semibold text-white">{project.name}</h3>
            <p className="text-xs uppercase tracking-wide text-white/55">Status: {project.status}</p>
            <p className="mt-2 text-sm text-white/65">Next: {project.next}</p>
            <Link
              href={`/portal/projects/${project.id}`}
              className="mt-3 inline-flex text-xs font-medium text-white/70 underline-offset-4 hover:text-white hover:underline"
            >
              View details
            </Link>
          </article>
        ))}
      </div>
    </section>
  )
}
