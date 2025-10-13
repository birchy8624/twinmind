'use client'
import { motion } from 'framer-motion'

export default function Hero(){
  return (
    <section className="relative overflow-hidden pt-28 pb-24">
      <div className="pointer-events-none absolute inset-0 -z-10 [mask-image:radial-gradient(60%_60%_at_50%_0%,black,transparent)]">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[120rem] h-[120rem] bg-gradient-to-br from-limeglow-500/20 to-limeglow-700/10 blur-3xl rounded-full"></div>
      </div>
      <div className="container flex flex-col items-center text-center max-w-5xl mx-auto">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-4xl sm:text-6xl font-semibold tracking-tight text-balance"
        >
          From Concept <span className="bg-gradient-to-r from-limeglow-500 to-limeglow-700 bg-clip-text text-transparent">to App.</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.8 }}
          className="mt-6 text-lg text-white/80 max-w-2xl mx-auto"
        >
          TwinMinds Studio blends human creativity with AI precision & speed to build beautiful, intelligent web apps, fast, affordable and built to scale.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.8 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-4"
        >
          <a href="#contact" className="btn btn-primary">Start your project</a>
          <a href="#portfolio" className="btn ring-1 ring-white/10 hover:ring-white/20">See our work</a>
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35, duration: 1 }}
          className="mt-16 grid w-full max-w-5xl grid-cols-1 gap-4 md:grid-cols-3 md:gap-6"
        >
          {[
            { title: 'Built Fast', desc: 'From idea to a live app faster than ever before.' },
            { title: 'Human Touch', desc: 'Because great products start with human understanding.' },
            { title: 'Design that Works', desc: 'Interfaces that feel effortless and deliver results.' },
          ].map((f)=> (
            <div
              key={f.title}
              className="card bg-base-800/35 ring-limeglow-500/25 shadow-[0_18px_40px_-24px_rgba(163,255,18,0.45)] transition-all hover:-translate-y-1 hover:ring-limeglow-500/40 hover:shadow-glow"
            >
              <h3 className="font-semibold text-white">{f.title}</h3>
              <p className="text-white/80 mt-2">{f.desc}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
