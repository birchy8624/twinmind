'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

import { StatusBadge } from '../_components/status-badge'

const projects = [
  {
    name: 'Atlas UI Refresh',
    client: 'Acme Robotics',
    status: 'In Delivery',
    owner: 'Sasha Greene',
    lastUpdate: 'Today',
    budget: '$48,000'
  },
  {
    name: 'Helios Data Room',
    client: 'Northwind Analytics',
    status: 'In Review',
    owner: 'Elijah Carter',
    lastUpdate: '2 days ago',
    budget: '$32,000'
  },
  {
    name: 'Orbit Marketing Site',
    client: 'Orbit Labs',
    status: 'Discovery',
    owner: 'Linh Tran',
    lastUpdate: '4 days ago',
    budget: '$18,000'
  },
  {
    name: 'Nova CRM Implementation',
    client: 'Cascade Ventures',
    status: 'In Delivery',
    owner: 'Mason Smith',
    lastUpdate: 'Yesterday',
    budget: '$27,500'
  },
  {
    name: 'Aurora Knowledge Base',
    client: 'Aurora Health',
    status: 'Blocked',
    owner: 'Evelyn Lopez',
    lastUpdate: '6 days ago',
    budget: '$22,400'
  },
  {
    name: 'Lumen Investor Deck',
    client: 'Lumen Finance',
    status: 'In Review',
    owner: 'Sasha Greene',
    lastUpdate: 'Yesterday',
    budget: '$9,500'
  }
] as const

const PAGE_SIZE = 4
const statusFilters = ['All statuses', 'Discovery', 'In Delivery', 'In Review', 'Blocked']

export default function ProjectsPage() {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('All statuses')
  const [page, setPage] = useState(1)

  const filteredProjects = useMemo(() => {
    const normalizedQuery = query.toLowerCase()
    return projects.filter((project) => {
      const matchesQuery =
        !normalizedQuery ||
        project.name.toLowerCase().includes(normalizedQuery) ||
        project.client.toLowerCase().includes(normalizedQuery) ||
        project.owner.toLowerCase().includes(normalizedQuery)
      const matchesStatus = statusFilter === 'All statuses' || project.status === statusFilter
      return matchesQuery && matchesStatus
    })
  }, [query, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filteredProjects.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageStart = (currentPage - 1) * PAGE_SIZE
  const pageProjects = filteredProjects.slice(pageStart, pageStart + PAGE_SIZE)

  return (
    <section className="space-y-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white">Projects</h1>
          <p className="mt-2 max-w-2xl text-sm text-white/65">
            Monitor project health across clients and quickly surface work that needs attention.
          </p>
        </div>
        <Link
          href="/app/projects/new"
          className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition btn-gradient"
        >
          + New project
        </Link>
      </header>

      <motion.div className="rounded-3xl border border-white/10 bg-base-900/40 p-6 shadow-lg shadow-base-900/30 backdrop-blur">
        <div className="flex flex-col gap-3 border-b border-white/10 pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex w-full flex-col gap-3 text-sm text-white/70 sm:flex-row">
            <label className="flex w-full items-center gap-3 rounded-full border border-white/10 bg-base-900/60 px-4 py-2 focus-within:border-white/30 focus-within:text-white/80">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z" />
              </svg>
              <input
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setPage(1)
                }}
                placeholder="Search by project, client, or owner"
                className="w-full bg-transparent text-sm text-white/80 placeholder:text-white/40 focus:outline-none"
              />
            </label>
            <label className="flex w-full items-center gap-3 rounded-full border border-white/10 bg-base-900/60 px-4 py-2 focus-within:border-white/30 focus-within:text-white/80 sm:w-56">
              <span className="text-xs uppercase tracking-wide text-white/40">Status</span>
              <select
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value)
                  setPage(1)
                }}
                className="w-full bg-transparent text-sm text-white/80 focus:outline-none"
              >
                {statusFilters.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </label>
          </div>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 self-start rounded-full border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/70 transition hover:border-white/30 hover:text-white"
          >
            Timeline view
          </button>
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl border border-white/5">
          <table className="min-w-full divide-y divide-white/5 text-left text-sm text-white/70">
            <thead className="bg-white/5 text-xs uppercase tracking-wide text-white/60">
              <tr>
                <th className="px-5 py-3 font-medium">Project</th>
                <th className="px-5 py-3 font-medium">Client</th>
                <th className="px-5 py-3 font-medium">Owner</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Last update</th>
                <th className="px-5 py-3 font-medium">Budget</th>
                <th className="px-5 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              <AnimatePresence initial={false}>
                {pageProjects.map((project) => (
                  <motion.tr
                    key={project.name}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    className="bg-base-900/40 transition hover:bg-base-900/60 hover:shadow-[0_0_30px_rgba(99,102,241,0.25)]"
                  >
                    <td className="px-5 py-4 text-sm font-medium text-white">
                      {project.name}
                      <p className="text-xs text-white/50">{project.client}</p>
                    </td>
                    <td className="px-5 py-4 text-sm">{project.client}</td>
                    <td className="px-5 py-4 text-sm">{project.owner}</td>
                    <td className="px-5 py-4">
                      <StatusBadge status={project.status} />
                    </td>
                    <td className="px-5 py-4 text-sm">{project.lastUpdate}</td>
                    <td className="px-5 py-4 text-sm">{project.budget}</td>
                    <td className="px-5 py-4 text-right text-sm">
                      <Link
                        href={`/app/projects/${encodeURIComponent(project.name.toLowerCase().replace(/\s+/g, '-'))}`}
                        className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-white/80 transition hover:bg-white/20 hover:text-white"
                      >
                        Open
                      </Link>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
              {pageProjects.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-sm text-white/50">
                    No projects match the current filters yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="mt-5 flex flex-col gap-3 text-xs text-white/60 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Showing <span className="font-semibold text-white">{pageProjects.length}</span> of{' '}
            <span className="font-semibold text-white">{filteredProjects.length}</span> projects
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/70 transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              disabled={currentPage === 1}
            >
              Prev
            </button>
            <div className="rounded-full bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-white">
              Page {currentPage} / {totalPages}
            </div>
            <button
              type="button"
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/70 transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              disabled={currentPage === totalPages}
            >
              Next
            </button>
          </div>
        </div>
      </motion.div>

    </section>
  )
}
