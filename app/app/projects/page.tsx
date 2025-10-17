'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

import { createClient } from '@/utils/supabaseBrowser'
import type { Database } from '@/types/supabase'

import { StatusBadge } from '../_components/status-badge'

type ProjectRow = Database['public']['Tables']['projects']['Row']
type ClientRow = Database['public']['Tables']['clients']['Row']
type ProfileRow = Database['public']['Tables']['profiles']['Row']

type Project = ProjectRow & {
  client: Pick<ClientRow, 'id' | 'name'> | null
  assignee: Pick<ProfileRow, 'id' | 'full_name'> | null
}

const PAGE_SIZE = 8
const statusFilters = [
  'All statuses',
  'Backlog',
  'Call Arranged',
  'Brief Gathered',
  'UI Stage',
  'DB Stage',
  'Auth Stage',
  'Build',
  'QA',
  'Handover',
  'Closed'
]

const relativeTimeFormatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

const relativeTimeDivisions: { amount: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { amount: 60, unit: 'second' },
  { amount: 60, unit: 'minute' },
  { amount: 24, unit: 'hour' },
  { amount: 7, unit: 'day' },
  { amount: 4.34524, unit: 'week' },
  { amount: 12, unit: 'month' },
  { amount: Number.POSITIVE_INFINITY, unit: 'year' }
]

function formatRelativeTimeFromNow(value: string | Date | null) {
  if (!value) return 'Unknown'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown'

  let duration = (date.getTime() - Date.now()) / 1000

  for (const division of relativeTimeDivisions) {
    if (Math.abs(duration) < division.amount) {
      return relativeTimeFormatter.format(Math.round(duration), division.unit)
    }
    duration /= division.amount
  }

  return 'Unknown'
}

function formatStatus(status: ProjectRow['status'] | null) {
  if (!status) return 'Unknown'

  return status
    .toString()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
    .join(' ')
}

function formatDueDate(value: string | null) {
  if (!value) return 'No due date'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'No due date'

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('All statuses')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const supabase = useMemo(() => {
    try {
      return createClient()
    } catch (clientError) {
      console.error(clientError)
      return null
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    const fetchProjects = async () => {
      if (!supabase) {
        setError('Supabase client unavailable. Please verify your configuration.')
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from('projects')
        .select(
          `
            id,
            name,
            status,
            description,
            due_date,
            created_at,
            clients:client_id ( id, name ),
            assignee_profile:assignee_profile_id ( id, full_name )
          `
        )
        .order('created_at', { ascending: false })

      if (!isMounted) return

      if (fetchError) {
        console.error(fetchError)
        setError('We ran into an issue loading projects. Please try again.')
        setProjects([])
      } else {
        type ProjectQuery = ProjectRow & {
          clients: Pick<ClientRow, 'id' | 'name'> | null
          assignee_profile: Pick<ProfileRow, 'id' | 'full_name'> | null
        }

        const typedProjects = (data ?? []) as ProjectQuery[]
        const normalizedProjects: Project[] = typedProjects.map(
          ({ clients, assignee_profile, ...rest }) => ({
            ...rest,
            client: clients ?? null,
            assignee: assignee_profile ?? null
          })
        )

        setProjects(normalizedProjects)
      }

      setLoading(false)
    }

    void fetchProjects()

    return () => {
      isMounted = false
    }
  }, [supabase])

  const filteredProjects = useMemo(() => {
    const normalizedQuery = query.toLowerCase()
    return projects.filter((project) => {
      const descriptionText = project.description ? project.description.toLowerCase() : ''
      const clientName = project.client?.name ? project.client.name.toLowerCase() : ''
      const assigneeName = project.assignee?.full_name ? project.assignee.full_name.toLowerCase() : ''
      const matchesQuery =
        !normalizedQuery ||
        project.name.toLowerCase().includes(normalizedQuery) ||
        descriptionText.includes(normalizedQuery) ||
        clientName.includes(normalizedQuery) ||
        assigneeName.includes(normalizedQuery)
      const matchesStatus =
        statusFilter === 'All statuses' || formatStatus(project.status) === statusFilter
      return matchesQuery && matchesStatus
    })
  }, [projects, query, statusFilter])

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
                <th className="px-5 py-3 font-medium">Due date</th>
                <th className="px-5 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              <AnimatePresence initial={false}>
                {pageProjects.map((project) => {
                  const readableStatus = formatStatus(project.status)
                  const createdAtDate = project.created_at
                    ? new Date(project.created_at)
                    : null
                  const createdAt =
                    createdAtDate && !Number.isNaN(createdAtDate.getTime())
                      ? createdAtDate
                      : null
                  return (
                  <motion.tr
                    key={project.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    className="bg-base-900/40 transition hover:bg-base-900/60 hover:shadow-[0_0_30px_rgba(99,102,241,0.25)]"
                  >
                    <td className="px-5 py-4 text-sm font-medium text-white">
                      {project.name}
                      <p className="text-xs text-white/50 line-clamp-2">
                        {project.description ?? 'No description available'}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-sm">{project.client?.name ?? 'Unknown client'}</td>
                    <td className="px-5 py-4 text-sm">{project.assignee?.full_name ?? 'Unassigned'}</td>
                    <td className="px-5 py-4">
                      <StatusBadge status={readableStatus} />
                    </td>
                    <td className="px-5 py-4 text-sm">
                      {createdAt ? (
                        <span title={createdAt.toLocaleString()}>
                          {formatRelativeTimeFromNow(createdAt)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-5 py-4 text-sm">
                      <span title={project.due_date ? new Date(project.due_date).toLocaleDateString() : undefined}>
                        {formatDueDate(project.due_date)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right text-sm">
                      <Link
                        href={`/app/projects/${project.id}`}
                        className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-white/80 transition hover:bg-white/20 hover:text-white"
                      >
                        Open
                      </Link>
                    </td>
                  </motion.tr>
                  )
                })}
              </AnimatePresence>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-sm text-white/50">
                    Loading projects...
                  </td>
                </tr>
              ) : null}
              {!loading && error ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-sm text-rose-300">
                    {error}
                  </td>
                </tr>
              ) : null}
              {!loading && !error && pageProjects.length === 0 ? (
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
            {loading ? (
              <span className="text-white/70">Loading projects...</span>
            ) : error ? (
              <span className="text-rose-300">Unable to display project counts.</span>
            ) : (
              <>
                Showing <span className="font-semibold text-white">{pageProjects.length}</span> of{' '}
                <span className="font-semibold text-white">{filteredProjects.length}</span> projects
              </>
            )}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/70 transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              disabled={loading || currentPage === 1}
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
              disabled={loading || currentPage === totalPages}
            >
              Next
            </button>
          </div>
        </div>
      </motion.div>

    </section>
  )
}
