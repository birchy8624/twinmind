import Section from './Section'

const pillars = [
  {
    title: 'AI-First Workflow',
    description: 'Research, ideation, scaffolding, and QA accelerated by AI.'
  },
  {
    title: 'Human Taste',
    description: 'Product sense, design polish, and copy that resonates.'
  },
  {
    title: 'Tight Feedback Loops',
    description: 'Instrumentation, user interviews, and rapid releases.'
  },
  {
    title: 'Sustainable Focus',
    description: 'Small, purposeful apps that solve one job exceptionally well.'
  },
]

export default function Approach(){
  return (
    <Section id="approach" className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 -top-32 -z-10 flex justify-center">
        <div className="h-[28rem] w-[32rem] rounded-full bg-gradient-to-br from-limeglow-500/16 via-transparent to-transparent blur-3xl"></div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-[-8rem] -z-10 flex justify-center">
        <div className="h-[24rem] w-[28rem] rounded-full bg-gradient-to-t from-limeglow-700/12 via-transparent to-transparent blur-3xl"></div>
      </div>

      <div className="flex flex-col items-center text-center md:items-start md:text-left">
        <span className="text-xs uppercase tracking-[0.28em] text-limeglow-500/70 sm:text-sm sm:tracking-[0.4em]">Our Approach</span>
        <h2 className="mt-4 text-3xl sm:text-4xl font-semibold tracking-tight">Our Approach</h2>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2">
        {pillars.map((pillar) => (
          <div
            key={pillar.title}
            className="card flex flex-col gap-3 p-8 text-left hover:-translate-y-1 hover:ring-limeglow-500/40 hover:shadow-glow"
          >
            <h3 className="text-lg font-semibold text-white sm:text-xl">{pillar.title}</h3>
            <p className="text-base leading-relaxed text-white/80 sm:text-[1.05rem]">{pillar.description}</p>
          </div>
        ))}
      </div>
    </Section>
  )
}
