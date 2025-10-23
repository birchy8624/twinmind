import Section from './Section'

export default function Contact(){
  return (
    <Section id="contact" muted className="relative overflow-hidden border-y border-white/5">
      <div className="pointer-events-none absolute inset-x-0 -top-24 -z-10 flex justify-center">
        <div className="h-[24rem] w-[30rem] rounded-full bg-gradient-to-br from-limeglow-500/14 via-transparent to-transparent blur-3xl"></div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-[-8rem] -z-10 flex justify-center">
        <div className="h-[22rem] w-[26rem] rounded-full bg-gradient-to-t from-limeglow-700/10 via-transparent to-transparent blur-3xl"></div>
      </div>

      <div className="card relative mx-auto max-w-3xl text-center sm:text-left">
        <div className="absolute inset-x-0 top-0 -z-10 h-20 bg-gradient-to-b from-limeglow-500/15 to-transparent" />
        <h2 className="mt-4 text-3xl sm:text-4xl font-semibold tracking-tight text-white">Want to collaborate or need an MVP fast?</h2>
        <p className="mt-4 text-base leading-relaxed text-white/80 sm:text-lg">
          We selectively partner on rapid MVPs if there’s a clear niche and tight scope.
        </p>
        <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-start">
          <a href="mailto:hello@twinminds.studio" className="btn btn-primary sm:w-auto">Contact Us</a>
        </div>
      </div>
    </Section>
  )
}
