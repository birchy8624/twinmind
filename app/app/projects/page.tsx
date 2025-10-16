import Link from 'next/link'

const projects = [
  { name: 'Atlas UI Refresh', status: 'Design QA', client: 'Acme Robotics' },
  { name: 'Helios Data Room', status: 'Development', client: 'Northwind Analytics' },
  { name: 'Orbit Marketing Site', status: 'Discovery', client: 'Orbit Labs' }
]

export default function ProjectsPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Projects</h1>
        <p className="text-sm text-white/70">Monitor delivery progress across the studio portfolio.</p>
      </header>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {projects.map((project) => (
          <article
            key={project.name}
            className="rounded-lg border border-white/10 bg-base-900/30 p-4 backdrop-blur"
          >
            <h2 className="text-lg font-semibold text-white">{project.name}</h2>
            <p className="text-xs uppercase tracking-wide text-white/50">{project.client}</p>
            <p className="mt-3 text-sm text-white/70">Current status: {project.status}</p>
            <Link
              href={`/app/projects/${encodeURIComponent(project.name.toLowerCase().replace(/\s+/g, '-'))}`}
              className="mt-4 inline-flex text-xs font-medium text-white/70 underline-offset-4 hover:text-white hover:underline"
            >
              View project
            </Link>
          </article>
        ))}
      </div>
    </div>
  )
}
