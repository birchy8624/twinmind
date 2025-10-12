'use client'
import { useRef } from 'react'
import Section from './Section'
import { projects } from '@/lib/projects'
import { motion } from 'framer-motion'

export default function Projects(){
  const railRef = useRef<HTMLDivElement>(null)

  function scroll(direction: 'left' | 'right'){
    const node = railRef.current
    if (!node) return
    const offset = node.clientWidth * 0.85
    node.scrollBy({ left: direction === 'left' ? -offset : offset, behavior: 'smooth' })
  }

  return (
    <Section id="portfolio">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="text-center md:text-left">
          <span className="text-sm uppercase tracking-[0.4em] text-limeglow-500/70">Selected work</span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight">Portfolio</h2>
          <p className="text-white/70 mt-3 max-w-2xl">A selection of our live, production-ready projects you can explore.</p>
        </div>
        <div className="flex justify-center gap-3 md:justify-end">
          <button
            type="button"
            onClick={()=>scroll('left')}
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-base-800/70 text-white/70 ring-1 ring-white/10 transition hover:text-white hover:ring-limeglow-500/40"
            aria-label="Scroll portfolio left"
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4">
              <path d="m10 4-4 4 4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            onClick={()=>scroll('right')}
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-base-800/70 text-white/70 ring-1 ring-white/10 transition hover:text-white hover:ring-limeglow-500/40"
            aria-label="Scroll portfolio right"
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4">
              <path d="m6 4 4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      <div className="relative mt-10">
        <div className="pointer-events-none absolute left-0 top-0 h-full w-12 bg-gradient-to-r from-base-900 via-base-900/80 to-transparent"></div>
        <div className="pointer-events-none absolute right-0 top-0 h-full w-12 bg-gradient-to-l from-base-900 via-base-900/80 to-transparent"></div>
        <div
          ref={railRef}
          className="flex snap-x snap-mandatory gap-6 overflow-x-auto px-6 py-6 scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          {projects.map((p) => (
            <motion.a
              href={p.url}
              key={p.name}
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ y: -4 }}
              className="card group min-w-[80%] flex-shrink-0 px-5 py-6 ring-white/15 ring-offset-1 ring-offset-base-900/80 hover:ring-limeglow-500/35 hover:ring-offset-limeglow-500/20 hover:shadow-glow sm:min-w-[18rem] md:min-w-[19rem] lg:min-w-[20rem]"
            >
              <div className="relative aspect-[1917/963] w-full overflow-hidden rounded-2xl ring-1 ring-white/10 transition-all group-hover:ring-limeglow-500/60">
                {p.image ? (
                  <img
                    src={p.image}
                    alt={`${p.name} preview`}
                    className="absolute inset-0 h-full w-full object-cover object-center"
                    loading="lazy"
                  />
                ) : (
                  <div className="absolute inset-0 bg-base-700/60"></div>
                )}
              </div>
              <h3 className="mt-3 font-semibold text-white">{p.name}</h3>
              <p className="text-white/75 text-xs mt-2 leading-relaxed sm:text-sm">{p.description}</p>
              <p className="text-white/50 text-[0.65rem] mt-3 uppercase tracking-[0.2em] sm:text-[0.7rem]">{p.tech.join(' • ')}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-limeglow-500 text-sm">
                View demo
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5">
                  <path d="m6 4 4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </motion.a>
          ))}
        </div>
      </div>
    </Section>
  )
}
