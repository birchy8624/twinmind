'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

import { createClient } from '@/utils/supabaseBrowser'
import type { Database } from '@/types/supabase'

import { StatusBadge } from '../_components/status-badge'

type Client = Database['public']['Tables']['clients']['Row']

const PAGE_SIZE = 8

const statuses = ['All statuses', 'Active', 'Inactive', 'Invited', 'Archived']

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

function formatRelativeTimeFromNow(value: string | null) {
  if (!value) return 'Unknown'
  const date = new Date(value)
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

function formatStatus(status: Client['account_status']) {
  if (!status) return 'Unknown'

  return status
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ')
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
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

    const fetchClients = async () => {
      if (!supabase) {
        setError('Supabase client unavailable. Please check your configuration.')
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from('clients')
        .select('id, name, website, account_status, created_at')
        .order('created_at', { ascending: false })

      if (!isMounted) return

      if (fetchError) {
        console.error(fetchError)
        setError('We ran into an issue loading clients. Please try again.')
        setClients([])
      } else {
        setClients(data ?? [])
      }

      setLoading(false)
    }

    void fetchClients()

    return () => {
      isMounted = false
    }
  }, [supabase])

  const filteredClients = useMemo(() => {
    const normalizedQuery = query.toLowerCase()
    return clients.filter((client) => {
      const matchesQuery =
        !normalizedQuery ||
        client.name.toLowerCase().includes(normalizedQuery) ||
        client.website?.toLowerCase().includes(normalizedQuery)
      const matchesStatus =
        statusFilter === 'All statuses' || formatStatus(client.account_status) === statusFilter
      return matchesQuery && matchesStatus
    })
  }, [clients, query, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filteredClients.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageStart = (currentPage - 1) * PAGE_SIZE
  const pageClients = filteredClients.slice(pageStart, pageStart + PAGE_SIZE)

  const handleQueryChange = (value: string) => {
    setQuery(value)
    setPage(1)
  }

  const handleStatusChange = (value: string) => {
    setStatusFilter(value)
    setPage(1)
  }

  return (
    <section className="space-y-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white">Clients</h1>
          <p className="mt-2 max-w-xl text-sm text-white/65">
            Search across every relationship, track the latest touchpoints, and view who is accountable for next steps.
          </p>
        </div>
        <Link
          href="/app/clients/new"
          className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition btn-gradient"
        >
          <span>+ New client</span>
        </Link>
      </header>

      <motion.div
        layout
        className="rounded-3xl border border-white/10 bg-base-900/40 p-6 shadow-lg shadow-base-900/30 backdrop-blur"
      >
        <div className="flex flex-col gap-3 border-b border-white/10 pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex w-full flex-col gap-3 text-sm text-white/70 sm:flex-row">
            <label className="flex w-full items-center gap-3 rounded-full border border-white/10 bg-base-900/60 px-4 py-2 focus-within:border-white/30 focus-within:text-white/80">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z" />
              </svg>
              <input
                type="search"
                value={query}
                placeholder="Search by name or website"
                onChange={(event) => handleQueryChange(event.target.value)}
                className="w-full bg-transparent text-sm text-white/80 placeholder:text-white/40 focus:outline-none"
              />
            </label>
            <label className="flex w-full items-center gap-3 rounded-full border border-white/10 bg-base-900/60 px-4 py-2 focus-within:border-white/30 focus-within:text-white/80 sm:w-56">
              <span className="text-xs uppercase tracking-wide text-white/40">Status</span>
              <select
                value={statusFilter}
                onChange={(event) => handleStatusChange(event.target.value)}
                className="w-full bg-transparent text-sm text-white/80 focus:outline-none"
              >
                {statuses.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </label>
          </div>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 self-start rounded-full border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/70 transition hover:border-white/30 hover:text-white"
          >
            Export CSV
          </button>
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl border border-white/5">
          <table className="min-w-full divide-y divide-white/5 text-left text-sm text-white/70">
            <thead className="bg-white/5 text-xs uppercase tracking-wide text-white/60">
              <tr>
                <th className="px-5 py-3 font-medium">Client</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Website</th>
                <th className="px-5 py-3 font-medium">Created</th>
                <th className="px-5 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              <AnimatePresence initial={false}>
                {pageClients.map((client) => {
                  const createdAt = client.created_at ? new Date(client.created_at) : null

                  return (
                    <motion.tr
                      key={client.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.18, ease: 'easeOut' }}
                      className="bg-base-900/40 transition hover:bg-base-900/60 hover:shadow-[0_0_30px_rgba(59,130,246,0.25)]"
                    >
                      <td className="px-5 py-4 text-sm font-medium text-white">
                        <div>{client.name}</div>
                        <div className="text-xs text-white/50">{client.website || 'No website yet'}</div>
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge status={formatStatus(client.account_status)} />
                      </td>
                      <td className="px-5 py-4 text-sm">{client.website ? client.website.replace(/^https?:\/\//, '') : '—'}</td>
                      <td className="px-5 py-4 text-sm">
                        <span title={createdAt ? createdAt.toLocaleString() : undefined}>
                          {formatRelativeTimeFromNow(client.created_at)}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right text-sm">
                        <Link
                          href={`/app/clients/${client.id}`}
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
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-white/50">
                    Loading clients...
                  </td>
                </tr>
              ) : null}
              {!loading && error ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-rose-300">
                    {error}
                  </td>
                </tr>
              ) : null}
              {!loading && !error && pageClients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-white/50">
                    No clients match your filters yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="mt-5 flex flex-col gap-3 text-xs text-white/60 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Showing <span className="font-semibold text-white">{pageClients.length}</span> of{' '}
            <span className="font-semibold text-white">{filteredClients.length}</span> clients
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
