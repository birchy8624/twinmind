import Section from './Section'

const projectPlaceholders = [
  {
    name: 'Project A — “Working title”',
    description: 'One-line value prop for a specific niche.',
    status: 'Status: Private beta.'
  },
  {
    name: 'Project B — “Working title”',
    description: 'One-line value prop for a specific niche.',
    status: 'Status: Alpha testing.'
  },
  {
    name: 'Project C — “Working title”',
    description: 'One-line value prop for a specific niche.',
    status: 'Status: In discovery.'
  },
]

export default function Projects(){
  return (
    <Section id="projects">
      <div className="text-center md:text-left">
        <span className="text-xs uppercase tracking-[0.28em] text-limeglow-500/70 sm:text-sm sm:tracking-[0.4em]">Projects</span>
        <h2 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight">Projects</h2>
        <p className="mt-3 max-w-2xl text-base text-white/75 sm:text-lg">A rolling showcase of what we’re shipping.</p>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
        {projectPlaceholders.map((project) => (
          <div key={project.name} className="card flex flex-col gap-3 p-7 text-left">
            <h3 className="text-lg font-semibold text-white">{project.name}</h3>
            <p className="text-base leading-relaxed text-white/80 sm:text-[1.05rem]">{project.description}</p>
            <p className="text-sm font-medium text-limeglow-400">{project.status}</p>
          </div>
        ))}
      </div>
    </Section>
  )
}
