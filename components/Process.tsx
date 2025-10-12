import { ReactNode } from 'react'
import Section from './Section'

const steps = [
  {
    n: '01',
    title: 'Discover & scope',
    desc: 'Lightweight workshops to align on goals, users, and scope.',
    icon: (
      <svg viewBox="0 0 24 24" className="h-7 w-7">
        <circle cx="11" cy="11" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M15.5 15.5 19 19" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M11 7v2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M7 11h2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    n: '02',
    title: 'Build collaboratively with AI',
    desc: 'Rapid cycles using AI to accelerate coding, testing, and docs.',
    icon: (
      <svg viewBox="0 0 24 24" className="h-7 w-7">
        <circle cx="7.5" cy="8" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="16.5" cy="6.5" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="16" cy="16.5" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M9.7 10.4 13.8 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="m11 7 3.2-.8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="m9 12-1.2 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    n: '03',
    title: 'Refine UX & details',
    desc: 'Polish copy, UX flows, and edge cases. Human craft matters.',
    icon: (
      <svg viewBox="0 0 24 24" className="h-7 w-7">
        <path d="M13.25 6.25 17.5 10.5l-7 7H6.25v-4.25z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="m14.5 7.5 2 2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M6.25 17.5 4.5 19" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    n: '04',
    title: 'Launch & handover',
    desc: 'Deploy and transfer. Clear docs and maintainable code.',
    icon: (
      <svg viewBox="0 0 24 24" className="h-7 w-7">
        <path d="M12 3c3 2 5 5.5 5 9 0 2-1 4-3 6l-2 2-2-2c-2-2-3-4-3-6 0-3.5 2-7 5-9z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M9.5 13h5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="m10 17.5 2 1.5 2-1.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
] as const satisfies ReadonlyArray<{
  n: string
  title: string
  desc: string
  icon: ReactNode
}>

export default function Process(){
  return (
    <Section id="process" muted className="relative overflow-hidden border-y border-white/5">
      <div className="relative">
        <div className="pointer-events-none absolute inset-x-0 -top-36 -z-10 flex justify-center">
          <div className="h-[30rem] w-[30rem] rounded-full bg-gradient-to-br from-limeglow-500/18 via-transparent to-transparent blur-3xl"></div>
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-[-6rem] -z-10 flex justify-center">
          <div className="h-[24rem] w-[26rem] rounded-full bg-gradient-to-t from-limeglow-700/14 via-transparent to-transparent blur-3xl"></div>
        </div>
        <div className="flex flex-col items-center text-center md:items-start md:text-left">
          <span className="text-sm uppercase tracking-[0.4em] text-limeglow-500/70">Playbook</span>
          <h2 className="mt-4 text-3xl sm:text-4xl font-semibold tracking-tight">How we work</h2>
          <p className="text-white/70 mt-3 max-w-2xl">
            A four-stage process that keeps momentum high and collaboration seamless, from the first workshop to handover.
          </p>
        </div>

        <div className="relative mt-12 md:mt-16">
          <div className="pointer-events-none absolute inset-x-6 top-[3.5rem] hidden h-px bg-gradient-to-r from-transparent via-limeglow-500/30 to-transparent md:block"></div>
          <div className="pointer-events-none absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-gradient-to-b from-limeglow-500/30 via-white/5 to-transparent md:hidden"></div>
          <div className="grid grid-cols-1 gap-10 md:grid-cols-4 md:gap-8">
            {steps.map((s) => (
              <div
                key={s.n}
                className="card relative z-10 flex flex-col items-center gap-8 overflow-hidden pt-16 text-center hover:-translate-y-1 hover:ring-limeglow-500/45 hover:shadow-glow md:flex-row md:items-start md:gap-6 md:pt-12 md:text-left"
              >
                <div className="absolute inset-x-0 top-0 -z-10 h-24 bg-gradient-to-b from-limeglow-500/12 to-transparent" />
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-base-900/90 ring-1 ring-limeglow-500/30 shadow-[0_0_45px_-20px_rgba(163,255,18,0.9)] md:static md:translate-x-0">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-limeglow-500/25 via-limeglow-500/10 to-transparent text-limeglow-500">
                    {s.icon}
                  </span>
                </div>
                <div className="flex flex-col items-center gap-3 md:items-start">
                  <div className="text-2xl font-semibold tracking-[0.14em] text-limeglow-500">{s.n}</div>
                  <h3 className="font-semibold text-white">{s.title}</h3>
                  <p className="text-white/75 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Section>
  )
}
