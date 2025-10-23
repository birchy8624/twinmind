import Section from './Section'

const items = [
  {
    title: 'Find Niches',
    desc: 'Identify real problems in overlooked markets.'
  },
  {
    title: 'Build Fast',
    desc: 'Use AI tooling and lean engineering to ship in days, not months.'
  },
  {
    title: 'Iterate Weekly',
    desc: 'Ship, measure, learn, repeat.'
  },
  {
    title: 'Own Products',
    desc: 'We primarily build and operate our own SaaS.'
  },
  {
    title: 'MVP-as-a-Service (limited)',
    desc: 'Selected engagements for rapid prototypes.'
  },
]

export default function WhatWeDo(){
  return (
    <Section id="what-we-do" muted className="relative overflow-hidden border-y border-white/5">
      <div className="pointer-events-none absolute inset-x-0 -top-24 -z-10 flex justify-center">
        <div className="h-[28rem] w-[28rem] rounded-full bg-gradient-to-br from-limeglow-500/14 via-transparent to-transparent blur-3xl"></div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 -bottom-16 -z-10 flex justify-center">
        <div className="h-[24rem] w-[24rem] rounded-full bg-gradient-to-t from-limeglow-700/10 via-transparent to-transparent blur-3xl"></div>
      </div>

      <div className="flex flex-col items-center text-center md:items-start md:text-left">
        <span className="text-xs uppercase tracking-[0.28em] text-limeglow-500/70 sm:text-sm sm:tracking-[0.4em]">What We Do</span>
        <h2 className="mt-4 text-3xl sm:text-4xl font-semibold tracking-tight">What We Do</h2>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-6 sm:gap-8 md:grid-cols-2">
        {items.map((item) => (
          <div
            key={item.title}
            className="card flex flex-col gap-3 p-7 text-left hover:-translate-y-1 hover:ring-limeglow-500/35 hover:shadow-glow"
          >
            <div className="flex items-center gap-3 text-limeglow-400">
              <svg viewBox="0 0 16 16" className="h-5 w-5">
                <path d="m3.5 8 3 3L12.5 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <h3 className="text-lg font-semibold text-white">{item.title}</h3>
            </div>
            <p className="text-base leading-relaxed text-white/80 sm:text-[1.05rem]">{item.desc}</p>
          </div>
        ))}
      </div>
    </Section>
  )
}
