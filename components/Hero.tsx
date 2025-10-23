'use client'
import { motion } from 'framer-motion'

export default function Hero(){
  return (
    <section className="relative overflow-hidden pt-28 pb-24">
      <div className="pointer-events-none absolute inset-0 -z-10 [mask-image:radial-gradient(60%_60%_at_50%_0%,black,transparent)]">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[120rem] h-[120rem] bg-gradient-to-br from-limeglow-500/14 to-limeglow-700/8 blur-3xl rounded-full"></div>
      </div>
      <div className="container flex flex-col items-center text-center max-w-5xl mx-auto">
        <motion.span
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-xs uppercase tracking-[0.32em] text-limeglow-500/70 sm:text-sm"
        >
          AI-driven startup studio
        </motion.span>
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.8 }}
          className="mt-4 text-4xl sm:text-6xl font-semibold tracking-tight text-balance"
        >
          Human creativity, AI speed
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.8 }}
          className="mt-6 max-w-2xl text-base text-white/80 sm:text-lg"
        >
          We use AI and rapid iteration to uncover niche markets and ship focused, high-quality web apps—fast.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.8 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-3 sm:gap-4"
        >
          <a href="#projects" className="btn btn-primary">Explore Projects</a>
          <a href="#contact" className="btn ring-1 ring-white/10 hover:ring-white/20">Work With Us</a>
        </motion.div>
      </div>
    </section>
  )
}
