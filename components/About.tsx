import Section from './Section'

export default function About(){
  return (
    <Section id="about" muted className="relative overflow-hidden border-y border-white/5">
      <div className="pointer-events-none absolute inset-x-0 -top-28 -z-10 flex justify-center">
        <div className="h-[28rem] w-[34rem] rounded-full bg-gradient-to-br from-limeglow-500/14 via-transparent to-transparent blur-3xl"></div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-[-10rem] -z-10 flex justify-center">
        <div className="h-[26rem] w-[30rem] rounded-full bg-gradient-to-t from-limeglow-700/10 via-transparent to-transparent blur-3xl"></div>
      </div>

      <div className="mx-auto max-w-3xl text-center lg:text-left">
        <span className="text-xs uppercase tracking-[0.28em] text-limeglow-500/70 sm:text-sm sm:tracking-[0.4em]">About TwinMinds</span>
        <h2 className="mt-4 text-3xl sm:text-4xl font-semibold tracking-tight">About TwinMinds</h2>
        <p className="mt-4 text-base text-white/80 sm:text-lg">
          TwinMinds is a startup studio that builds its own SaaS products for specific, underserved niches. Thanks to AI, we can validate ideas quickly, ship polished MVPs, and evolve them based on real-world feedback. We also offer a limited MVP-as-a-service for teams that need a fast, high-quality prototype.
        </p>
      </div>
    </Section>
  )
}
