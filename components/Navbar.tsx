'use client'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { useState } from 'react'

const links = [
  { href: '#services', label: 'Services' },
  { href: '#portfolio', label: 'Portfolio' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#about', label: 'About' },
  { href: '#contact', label: 'Contact' },
]

export default function Navbar(){
  const [open, setOpen] = useState(false)
  return (
    <motion.nav
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="sticky top-0 z-50 backdrop-blur supports-[backdrop-filter]:bg-base-900/50 border-b border-white/5"
    >
      <div className="container flex items-center justify-between h-16">
        <Link href="/" className="font-semibold tracking-tight">
          <span className="text-limeglow-500">Twin</span>Minds<span className="text-white/60"> Studio</span>
        </Link>
        <div className="hidden md:flex items-center gap-8">
          {links.map(l => (
            <a key={l.href} href={l.href} className="text-sm text-white/80 hover:text-white transition-colors">{l.label}</a>
          ))}
          <a href="#contact" className="btn btn-primary text-sm">Start your project</a>
        </div>
        <button className="md:hidden p-2 rounded-xl ring-1 ring-white/10" onClick={()=>setOpen(v=>!v)} aria-label="Toggle menu">
          <div className="w-5 h-0.5 bg-white mb-1"></div>
          <div className="w-5 h-0.5 bg-white"></div>
        </button>
      </div>
      {open && (
        <div className="md:hidden border-t border-white/5">
          <div className="container py-3 flex flex-col gap-3">
            {links.map(l => (
              <a key={l.href} href={l.href} onClick={()=>setOpen(false)} className="text-sm text-white/80 hover:text-white transition-colors">{l.label}</a>
            ))}
            <a href="#contact" className="btn btn-primary text-sm">Start your project</a>
          </div>
        </div>
      )}
    </motion.nav>
  )
}
