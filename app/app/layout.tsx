'use client'

import Link from 'next/link'
import type { Route } from 'next'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

import { ActiveProfileProvider, useActiveProfile } from './_components/active-profile-context'
import { ToastProvider } from './_components/toast-context'
import { TwinmindLogo } from './_components/twinmind-logo'
import { NotificationsMenu } from './_components/notifications-menu'
import { WorkspaceAccountMenu } from './_components/workspace-account-menu'
import { WorkspaceSearch } from './_components/workspace-search'

const navigation = [
  { href: '/app/dashboard', label: 'Dashboard', hint: 'Studio overview' },
  { href: '/app/clients', label: 'Clients', hint: 'Relationships and health' },
  { href: '/app/projects', label: 'Projects', hint: 'Delivery and assets' },
  { href: '/app/kanban', label: 'Kanban', hint: 'Pipeline view' },
  { href: '/app/settings', label: 'Settings', hint: 'Workspace preferences' }
] satisfies ReadonlyArray<{ href: Route; label: string; hint: string }>

type AppShellLayoutProps = {
  children: ReactNode
}

function AppShellLayoutInner({ children }: AppShellLayoutProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { loading: profileLoading, profile } = useActiveProfile()

  const isClient = profile?.role === 'client'

  const activeLabel = useMemo(() => {
    const match = navigation.find((item) => pathname?.startsWith(item.href))
    return match?.label ?? 'Workspace'
  }, [pathname])

  useEffect(() => {
    if (!isClient) {
      return
    }

    setMobileOpen(false)
  }, [isClient])

  useEffect(() => {
    if (profileLoading || !isClient || !pathname) {
      return
    }

    const isProjectsRoot = pathname === '/app/projects'
    const isProjectDetail = /^\/app\/projects\/[^/]+$/.test(pathname)
    const isSettings = pathname.startsWith('/app/settings')

    if (!(isProjectsRoot || isProjectDetail || isSettings)) {
      router.replace('/app/projects')
    }
  }, [isClient, profileLoading, pathname, router])

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

  const showNavigation = !isClient

  return (
    <ToastProvider>
      <div className="min-h-screen bg-base-950 text-white">
        {showNavigation ? (
          <aside className="hidden w-72 flex-col border-r border-white/10 bg-base-900/70 p-6 backdrop-blur lg:fixed lg:inset-y-0 lg:flex">
            <div className="mb-8">
              <span className="sr-only">TwinMind Studio Control Center</span>
              <TwinmindLogo />
            </div>
            {NavLinks}
            <div className="mt-auto pt-8" />
          </aside>
        ) : null}

        <div className={`flex min-h-screen flex-col ${showNavigation ? 'lg:ml-72' : ''}`}>
          <header className="sticky top-0 z-40 border-b border-white/10 bg-base-900/40 px-6 py-5 backdrop-blur">
            {isClient ? (
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <TwinmindLogo className="h-8 w-auto" />
                  <p className="text-lg font-semibold text-white">{activeLabel}</p>
                </div>
                <WorkspaceAccountMenu showOnMobile className="ml-0" />
              </div>
            ) : (
              <>
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
                  <WorkspaceSearch
                    wrapperClassName="ml-auto hidden w-full max-w-md md:block"
                    inputContainerClassName="md:flex"
                    placeholder="Search clients, projects, or assets"
                  />
                  <div className="hidden md:block">
                    <NotificationsMenu />
                  </div>
                  <WorkspaceAccountMenu />
                </div>
                <div className="mt-4 flex flex-col gap-3 md:hidden">
                  <WorkspaceSearch wrapperClassName="w-full" placeholder="Search workspace" />
                  <div className="flex items-center justify-between text-xs text-white/50">
                    <span>Team workspace</span>
                    <span className="font-medium text-white/70">TwinMind Studio</span>
                  </div>
                </div>
              </>
            )}
          </header>
          <main className="flex-1 space-y-6 overflow-y-auto bg-base-900/20 p-6">{children}</main>
        </div>

        {showNavigation ? (
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
        ) : null}
      </div>
    </ToastProvider>
  )
}

export default function AppShellLayout({ children }: AppShellLayoutProps) {
  return (
    <ActiveProfileProvider>
      <AppShellLayoutInner>{children}</AppShellLayoutInner>
    </ActiveProfileProvider>
  )
}
