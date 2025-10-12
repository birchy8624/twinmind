import Section from './Section'

const services = [
  {
    title: 'MVP Development',
    desc: 'From idea to functional MVP in weeks, not months, guided by real product expertise and accelerated by AI.',
    icon: (
      <svg viewBox="0 0 24 24" className="h-7 w-7">
        <path d="M5 5h14v10H5z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M8 5V3h8v2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M7 11h4M7 8h6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M9 19h6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: 'Web Apps & Internal Tools',
    desc: 'Custom CRM tools, dashboards, and automation systems tailored to your workflows.',
    icon: (
      <svg viewBox="0 0 24 24" className="h-7 w-7">
        <rect x="3.75" y="5.75" width="16.5" height="12.5" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M7 10h3M7 13h2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="15.5" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M5 17.5h14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: 'AI Integrations',
    desc: 'Embed intelligent features: assistants, recommendations, summarization, and more.',
    icon: (
      <svg viewBox="0 0 24 24" className="h-7 w-7">
        <path d="M12 5c2 0 3.5 1.5 3.5 3.5S14 12 12 12s-3.5-1.5-3.5-3.5S10 5 12 5Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M6.5 13c0-1.1.9-2 2-2h7c1.1 0 2 .9 2 2v1a3.5 3.5 0 0 1-3.5 3.5h-4A3.5 3.5 0 0 1 6.5 14Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="m15 15 1.5 1.5M9 15 7.5 16.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
]

export default function Services(){
  return (
    <Section id="services" muted className="relative overflow-hidden border-y border-white/5">
      <div className="pointer-events-none absolute inset-x-0 -top-24 -z-10 flex justify-center">
        <div className="h-[28rem] w-[28rem] rounded-full bg-gradient-to-br from-limeglow-500/18 via-transparent to-transparent blur-3xl"></div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 -bottom-16 -z-10 flex justify-center">
        <div className="h-[24rem] w-[24rem] rounded-full bg-gradient-to-t from-limeglow-700/12 via-transparent to-transparent blur-3xl"></div>
      </div>

      <div className="flex flex-col items-center md:items-start">
        <span className="text-sm uppercase tracking-[0.4em] text-limeglow-500/70">What we ship</span>
        <h2 className="mt-4 text-3xl sm:text-4xl font-semibold tracking-tight text-center md:text-left">Services</h2>
        <p className="text-white/70 mt-3 max-w-2xl text-center md:text-left">
          We build and hand over production‑ready software you can run and grow.
        </p>
      </div>

      <div className="mt-14 grid grid-cols-1 gap-8 md:grid-cols-3">
        {services.map(s => (
          <div
            key={s.title}
            className="card relative flex flex-col gap-6 overflow-hidden p-8 hover:-translate-y-1.5 hover:ring-limeglow-500/40 hover:shadow-glow"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-base-900/80 text-limeglow-500 shadow-[0_0_45px_-20px_rgba(163,255,18,0.9)]">
              {s.icon}
            </div>
            <div className="flex flex-col gap-3">
              <h3 className="text-xl font-semibold text-white">{s.title}</h3>
              <p className="text-white/75 leading-relaxed">{s.desc}</p>
            </div>
            <div className="mt-auto flex items-center gap-2 text-sm font-medium text-limeglow-500">
              Learn more
              <svg viewBox="0 0 16 16" className="h-4 w-4">
                <path d="m6 4 4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-20 bg-gradient-to-b from-limeglow-500/10 to-transparent" />
          </div>
        ))}
      </div>
    </Section>
  )
}
