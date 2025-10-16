import Link from 'next/link'
import type { Route } from 'next'
import type { ReactNode } from 'react'

const portalNavigation = [
  { href: '/portal', label: 'Overview' },
  { href: '/portal/projects', label: 'Projects' }
] satisfies ReadonlyArray<{ href: Route; label: string }>

export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-base-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-6 py-10">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-medium text-white/70">Client Portal</div>
            <h1 className="text-2xl font-semibold">TwinMinds Studio</h1>
          </div>
          <nav className="flex items-center gap-2 text-sm">
            {portalNavigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-2 text-white/75 transition hover:bg-white/10 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="flex-1 space-y-6">{children}</main>
      </div>
    </div>
  )
}
