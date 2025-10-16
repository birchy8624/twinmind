import Link from 'next/link'
import type { Route } from 'next'
import type { ReactNode } from 'react'

const navigation = [
  { href: '/app/dashboard', label: 'Dashboard' },
  { href: '/app/clients', label: 'Clients' },
  { href: '/app/projects', label: 'Projects' },
  { href: '/app/kanban', label: 'Pipeline' },
  { href: '/app/settings', label: 'Settings' }
] satisfies ReadonlyArray<{ href: Route; label: string }>

export default function AppShellLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-base-950 text-white">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 border-r border-white/10 bg-base-900/60 p-6 backdrop-blur lg:block">
          <div className="mb-8 font-semibold tracking-wide text-white/90">TwinMinds Admin</div>
          <nav className="space-y-2 text-sm">
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-md px-3 py-2 text-white/80 transition hover:bg-white/10 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <div className="flex flex-1 flex-col">
          <header className="border-b border-white/10 bg-base-900/40 px-6 py-4 backdrop-blur">
            <div className="text-sm font-medium text-white/80">Team Workspace</div>
            <div className="text-xl font-semibold">TwinMinds Studio</div>
          </header>
          <main className="flex-1 space-y-6 bg-base-900/20 p-6">{children}</main>
        </div>
      </div>
    </div>
  )
}
