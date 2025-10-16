'use client'

import Link from 'next/link'
import type { Route } from 'next'
import { usePathname } from 'next/navigation'
import { useMemo, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

import { ToastProvider } from './_components/toast-context'

const navigation = [
  { href: '/app/dashboard', label: 'Dashboard', hint: 'Studio overview' },
  { href: '/app/clients', label: 'Clients', hint: 'Relationships and health' },
  { href: '/app/projects', label: 'Projects', hint: 'Delivery and assets' },
  { href: '/app/kanban', label: 'Kanban', hint: 'Pipeline view' },
  { href: '/app/settings', label: 'Settings', hint: 'Workspace preferences' }
] satisfies ReadonlyArray<{ href: Route; label: string; hint: string }>

const quickFilters = ['All work', 'Live builds', 'Discovery', 'Ready for review']

type AppShellLayoutProps = {
  children: ReactNode
}

export default function AppShellLayout({ children }: AppShellLayoutProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const activeLabel = useMemo(() => {
    const match = navigation.find((item) => pathname?.startsWith(item.href))
    return match?.label ?? 'Workspace'
  }, [pathname])

  const NavLinks = (
    <nav className="mt-10 space-y-1 text-sm">
      {navigation.map((item) => {
        const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`group flex flex-col gap-1 rounded-xl px-4 py-3 transition ${
              isActive
                ? 'bg-white/10 text-white shadow-[0_0_30px_rgba(255,255,255,0.08)]'
                : 'text-white/70 hover:bg-white/5 hover:text-white'
            }`}
            onClick={() => setMobileOpen(false)}
          >
            <span className="text-sm font-semibold">{item.label}</span>
            <span className="text-[11px] uppercase tracking-wide text-white/40">{item.hint}</span>
          </Link>
        )
      })}
    </nav>
  )

  return (
    <ToastProvider>
      <div className="min-h-screen bg-base-950 text-white">
        <div className="flex min-h-screen">
          <aside className="hidden w-72 flex-col border-r border-white/10 bg-base-900/70 p-6 backdrop-blur lg:flex">
            <div className="mb-8 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-sky-500 text-base-950 font-bold">
                TM
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-white/40">TwinMind Studio</p>
                <p className="text-sm font-semibold text-white">Control Center</p>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-base-900/60 p-4">
              <p className="text-xs text-white/50">Quick filters</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {quickFilters.map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    className="rounded-full bg-white/5 px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-white/60 transition hover:bg-white/10 hover:text-white"
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>
            {NavLinks}
            <div className="mt-auto pt-8">
              <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5 p-4 text-xs text-white/70">
                <p className="font-semibold text-white">Need a hand?</p>
                <p className="mt-2 leading-relaxed">
                  Explore the playbooks, service templates, and latest project retros in the knowledge base.
                </p>
                <Link
                  href="/portal"
                  className="mt-3 inline-flex text-[11px] font-semibold uppercase tracking-wide text-emerald-300 underline-offset-4 hover:text-emerald-200 hover:underline"
                >
                  Open knowledge base →
                </Link>
              </div>
            </div>
          </aside>

          <div className="flex flex-1 flex-col">
            <header className="border-b border-white/10 bg-base-900/40 px-6 py-5 backdrop-blur">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setMobileOpen((value) => !value)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-base-900/60 text-white/70 transition hover:border-white/20 hover:text-white lg:hidden"
                  aria-label="Toggle navigation"
                >
                  <span className="sr-only">Toggle navigation</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
                <div className="hidden lg:block">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/40">Currently viewing</p>
                  <p className="text-lg font-semibold text-white">{activeLabel}</p>
                </div>
                <div className="ml-auto hidden w-full max-w-md items-center gap-3 rounded-full border border-white/10 bg-base-900/60 px-4 py-2 text-sm text-white/60 shadow-sm shadow-base-900/30 focus-within:border-white/30 focus-within:text-white/80 md:flex">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z" />
                  </svg>
                  <input
                    type="search"
                    placeholder="Search clients, projects, or assets"
                    className="w-full bg-transparent text-sm text-white/80 placeholder:text-white/40 focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  className="hidden h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-base-900/60 text-white/70 transition hover:border-white/20 hover:text-white md:inline-flex"
                  aria-label="Notifications"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 18.5a3 3 0 0 1-6 0M5 9a7 7 0 1 1 14 0c0 5 1 6 1 6H4s1-1 1-6Z" />
                  </svg>
                </button>
                <details className="relative ml-2 hidden md:block">
                  <summary className="flex cursor-pointer list-none items-center gap-3 rounded-full border border-white/10 bg-base-900/60 px-3 py-1.5 text-left text-sm text-white/80 transition hover:border-white/20 hover:text-white">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-sky-500 text-sm font-semibold text-base-950">
                      EL
                    </span>
                    <span className="hidden text-xs uppercase tracking-wide text-white/60 lg:block">Evelyn Lopez</span>
                  </summary>
                  <div className="absolute right-0 mt-2 w-48 overflow-hidden rounded-xl border border-white/10 bg-base-900/80 p-2 shadow-lg">
                    <Link
                      href="/app/settings"
                      className="block rounded-lg px-3 py-2 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
                    >
                      View profile
                    </Link>
                    <button
                      type="button"
                      className="block w-full rounded-lg px-3 py-2 text-left text-sm text-rose-300 transition hover:bg-white/10 hover:text-rose-200"
                    >
                      Sign out
                    </button>
                  </div>
                </details>
              </div>
              <div className="mt-4 flex flex-col gap-3 md:hidden">
                <div className="flex w-full items-center gap-3 rounded-full border border-white/10 bg-base-900/60 px-4 py-2 text-sm text-white/60 shadow-sm focus-within:border-white/30 focus-within:text-white/80">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z" />
                  </svg>
                  <input
                    type="search"
                    placeholder="Search workspace"
                    className="w-full bg-transparent text-sm text-white/80 placeholder:text-white/40 focus:outline-none"
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-white/50">
                  <span>Team workspace</span>
                  <span className="font-medium text-white/70">TwinMind Studio</span>
                </div>
              </div>
            </header>
            <main className="flex-1 space-y-6 bg-base-900/20 p-6">
              <div className="grid gap-4 text-xs text-white/50 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/5 bg-base-900/40 p-4">
                  <p>Search across projects, clients, and the knowledge base instantly.</p>
                </div>
                <div className="rounded-2xl border border-white/5 bg-base-900/40 p-4">
                  <p>Hover cards, tables, and wizard flows echo the public site aesthetic.</p>
                </div>
              </div>
              {children}
            </main>
          </div>
        </div>

        <AnimatePresence>
          {mobileOpen ? (
            <motion.div
              key="mobile-nav"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur lg:hidden"
              onClick={() => setMobileOpen(false)}
            >
              <motion.aside
                initial={{ x: -40, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -40, opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="absolute left-4 top-8 bottom-8 right-20 rounded-3xl border border-white/10 bg-base-900/90 p-6 shadow-2xl"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-white/40">TwinMind Studio</p>
                    <p className="text-sm font-semibold text-white">Menu</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMobileOpen(false)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-white/70 transition hover:border-white/20 hover:text-white"
                    aria-label="Close navigation"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                {NavLinks}
              </motion.aside>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </ToastProvider>
  )
}
