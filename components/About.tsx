import Section from './Section'

const pillars = [
  {
    title: 'Human craft + AI speed',
    desc: 'We pair product strategy with generative build workflows to ship quality in weeks, not quarters.',
    icon: (
      <svg viewBox="0 0 24 24" className="h-7 w-7">
        <path d="M12 3c2.8 0 5 2.2 5 5s-2.2 5-5 5-5-2.2-5-5 2.2-5 5-5Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8.5 13h7c1.4 0 2.5 1.1 2.5 2.5V18c0 1.7-1.3 3-3 3h-6c-1.7 0-3-1.3-3-3v-2.5C6 14.1 7.1 13 8.5 13Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M15 13v-1.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M9 13v-1.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: 'Designed for outcomes',
    desc: 'Every iteration ends with something demo-ready. We keep stakeholders closely aligned and ship products that genuinely wow your clients.',
    icon: (
      <svg viewBox="0 0 24 24" className="h-7 w-7">
        <path d="M5 19.5V7.2c0-.7.5-1.3 1.2-1.5l6-1.6a1.5 1.5 0 0 1 1.8 1.4V18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="m5 12 3.5-1 4 1.5L19 11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M19 11v8.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: 'Build to hand over',
    desc: 'Clean systems, docs, and training so your team can scale post-launch without a black box.',
    icon: (
      <svg viewBox="0 0 24 24" className="h-7 w-7">
        <path d="M7 12h10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M12 7v10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M6 6h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
]

const stats = [
  { label: ' Products shipped ', value: '10+' },
  { label: ' Avg. sprint length ', value: '1 week' },
  { label: 'Time to first demo ', value: '10 days' },
]

export default function About(){
  return (
    <Section id="about" muted className="relative overflow-hidden border-y border-white/5">
      <div className="pointer-events-none absolute inset-x-0 -top-28 -z-10 flex justify-center">
        <div className="h-[28rem] w-[34rem] rounded-full bg-gradient-to-br from-limeglow-500/18 via-transparent to-transparent blur-3xl"></div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-[-10rem] -z-10 flex justify-center">
        <div className="h-[26rem] w-[30rem] rounded-full bg-gradient-to-t from-limeglow-700/14 via-transparent to-transparent blur-3xl"></div>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl text-center lg:text-left">
          <span className="text-xs uppercase tracking-[0.28em] text-limeglow-500/70 sm:text-sm sm:tracking-[0.4em]">Our DNA</span>
          <h2 className="mt-4 text-3xl sm:text-4xl font-semibold tracking-tight">About TwinMinds</h2>
          <p className="mt-4 text-base text-white/80 sm:text-lg">
            We’re a studio founded by a product leader who’s shipped countless products. By blending human intuition with AI-native tooling, we move fast without ever compromising quality. From the first workshop to product launch, we build, ship, and hand over so you can grow it from there.


          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 rounded-3xl bg-base-800/50 p-4 text-center ring-1 ring-white/10 backdrop-blur sm:grid-cols-3 sm:text-left">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col items-center gap-1 text-center sm:items-start sm:text-left">
              <div className="text-lg font-semibold text-white sm:text-xl">{stat.value}</div>
              <div className="text-[0.7rem] uppercase tracking-[0.2em] leading-snug text-white/60 sm:text-[0.68rem] sm:tracking-[0.24em]">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {pillars.map((item) => (
          <div
            key={item.title}
            className="card relative flex flex-col items-start gap-5 overflow-hidden p-8 text-left hover:-translate-y-1 hover:ring-limeglow-500/40 hover:shadow-glow"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-base-900/85 text-limeglow-500 shadow-[0_0_45px_-20px_rgba(163,255,18,0.9)]">
              {item.icon}
            </div>
            <div className="flex flex-col gap-3">
              <h3 className="text-lg font-semibold text-white sm:text-xl">{item.title}</h3>
              <p className="text-base leading-relaxed text-white/80 sm:text-[1.05rem]">{item.desc}</p>
            </div>
            <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-20 bg-gradient-to-b from-limeglow-500/10 to-transparent" />
          </div>
        ))}
      </div>
    </Section>
  )
}
