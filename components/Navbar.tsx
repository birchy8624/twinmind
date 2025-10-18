'use client'
import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'

const links = [
  { href: '#services', label: 'Services' },
  { href: '#portfolio', label: 'Portfolio' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#about', label: 'About' },
  { href: '#contact', label: 'Contact' },
]

export default function Navbar(){
  const [open, setOpen] = useState(false)

  useEffect(()=>{
    function handleResize(){
      if (window.innerWidth >= 768){
        setOpen(false)
      }
    }
    window.addEventListener('resize', handleResize)
    return ()=>window.removeEventListener('resize', handleResize)
  }, [])
  return (
    <motion.nav
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="sticky top-0 z-50 border-b border-white/5 bg-base-900/80 backdrop-blur supports-[backdrop-filter]:bg-base-900/60"
    >
      <div className="container flex h-16 items-center justify-between gap-3 sm:gap-6">
        <Link href="/" className="flex items-center gap-3 font-semibold tracking-tight text-white">
          <Image
            src="/logo.svg"
            alt="TwinMinds logo"
            width={1154}
            height={273}
            priority
            className="h-8 w-auto sm:h-9"
          />
        </Link>
        <div className="hidden items-center gap-6 md:flex lg:gap-8">
          {links.map(l => (
            <a key={l.href} href={l.href} className="text-sm text-white/80 hover:text-white transition-colors">{l.label}</a>
          ))}
          <Link href="/sign_in" className="text-sm text-white/80 hover:text-white transition-colors">
            Sign in
          </Link>
          <a href="#contact" className="btn btn-primary text-sm">Start your project</a>
        </div>
        <button
          className="md:hidden rounded-xl p-2 ring-1 ring-white/10"
          onClick={()=>setOpen(v=>!v)}
          aria-label="Toggle menu"
          aria-expanded={open}
        >
          <div className="mb-1 h-0.5 w-5 bg-white"></div>
          <div className="h-0.5 w-5 bg-white"></div>
        </button>
      </div>
      {open && (
        <div className="border-t border-white/5 bg-base-900/95 md:hidden">
          <div className="container flex flex-col gap-4 py-4">
            {links.map(l => (
              <a key={l.href} href={l.href} onClick={()=>setOpen(false)} className="text-sm text-white/80 hover:text-white transition-colors">{l.label}</a>
            ))}
            <Link
              href="/sign_in"
              onClick={()=>setOpen(false)}
              className="text-sm text-white/80 hover:text-white transition-colors"
            >
              Sign in
            </Link>
            <a href="#contact" className="btn btn-primary w-full text-sm sm:w-auto">Start your project</a>
          </div>
        </div>
      )}
    </motion.nav>
  )
}
