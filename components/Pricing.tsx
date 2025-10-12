import Section from './Section'

const plans = [
  { tier: 'Starter', name: 'Prototype', price: '€2,500', desc: 'Rapid 1‑week MVP build. Built by AI & experience.', features: ['Scoped MVP', 'Core screens & flows', 'Basic analytics'] },
  { tier: 'Focus', name: 'Growth', price: '€5,000', desc: 'Full‑feature MVP with polished UX & scalability.', features: ['End‑to‑end build', 'Design polish', 'CI/CD setup'], highlighted: true },
  { tier: 'Partner', name: 'Studio Partner', price: 'Custom', desc: 'Ongoing collaboration & optimization.', features: ['Weekly iterations', 'Roadmap', 'Priority support'] },
]

export default function Pricing(){
  return (
    <Section id="pricing" muted className="relative overflow-hidden border-y border-white/5">
      <div className="pointer-events-none absolute inset-x-0 -top-24 -z-10 flex justify-center">
        <div className="h-[26rem] w-[30rem] rounded-full bg-gradient-to-br from-limeglow-500/16 via-transparent to-transparent blur-3xl"></div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-[-8rem] -z-10 flex justify-center">
        <div className="h-[22rem] w-[26rem] rounded-full bg-gradient-to-t from-limeglow-700/12 via-transparent to-transparent blur-3xl"></div>
      </div>

      <div className="flex flex-col items-center text-center md:items-start md:text-left">
        <span className="text-sm uppercase tracking-[0.4em] text-limeglow-500/70">Tiers</span>
        <h2 className="mt-4 text-3xl sm:text-4xl font-semibold tracking-tight">Pricing</h2>
        <p className="text-white/70 mt-3 max-w-2xl">
          AI‑level speed. Human‑level quality. Choose the cadence that fits your budget.
        </p>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
        {plans.map(p => (
          <div
            key={p.name}
            className={`card relative flex flex-col gap-6 overflow-hidden p-8 transition-all hover:-translate-y-1.5 hover:ring-limeglow-500/45 hover:shadow-glow ${
              p.highlighted ? 'bg-base-800/45 ring-limeglow-500/35 shadow-[0_30px_80px_-40px_rgba(163,255,18,0.65)] scale-[1.02]' : ''
            }`}
          >
            {p.highlighted && (
              <div className="absolute right-6 top-6 rounded-full bg-limeglow-500/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-limeglow-200">
                Most chosen
              </div>
            )}
            <div>
              <div className="text-xs uppercase tracking-[0.4em] text-white/50">{p.tier}</div>
              <h3 className="mt-2 text-xl font-semibold text-white">{p.name}</h3>
              <div className="mt-3 text-3xl font-semibold bg-gradient-to-r from-limeglow-500 via-limeglow-600 to-limeglow-700 bg-clip-text text-transparent">
                {p.price}
              </div>
              <p className="text-white/75 mt-3 leading-relaxed">{p.desc}</p>
            </div>
            <ul className="space-y-2 text-sm text-white/70">
              {p.features.map(f => (
                <li key={f} className="flex items-center gap-2">
                  <span className="h-5 w-5 rounded-full bg-limeglow-500/15 text-limeglow-400 flex items-center justify-center text-xs font-semibold">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <a
              href="#contact"
              className={`btn mt-4 sm:mt-6 ${p.highlighted ? 'btn-primary' : 'ring-1 ring-white/15 text-white hover:ring-limeglow-500/40'}`}
            >
              {p.highlighted ? 'Start the Growth build' : `Choose ${p.name}`}
            </a>
          </div>
        ))}
      </div>
    </Section>
  )
}
