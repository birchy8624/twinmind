'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'

import { createBrowserClient } from '@/lib/supabase/browser'
import type { Database } from '@/types/supabase'

type Client = Pick<Database['public']['Tables']['clients']['Row'], 'id' | 'name'>
type Project = Pick<Database['public']['Tables']['projects']['Row'], 'id' | 'name'>

type WorkspaceSearchProps = {
  wrapperClassName?: string
  inputContainerClassName?: string
  placeholder?: string
}

type SearchResults = {
  clients: Client[]
  projects: Project[]
}

const MIN_QUERY_LENGTH = 2
const MAX_RESULTS = 6

function escapeForILike(value: string) {
  return value.replace(/[%_]/g, '\\$&')
}

function isLikelyUuid(value: string) {
  return /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.test(value.trim())
}

export function WorkspaceSearch({
  wrapperClassName = '',
  inputContainerClassName = '',
  placeholder = 'Search clients or projects'
}: WorkspaceSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResults>({ clients: [], projects: [] })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)

  const requestIdRef = useRef(0)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const supabase = useMemo(createBrowserClient, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current) return
      if (event.target instanceof Node && containerRef.current.contains(event.target)) {
        return
      }
      setIsOpen(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  useEffect(() => {
    const trimmedQuery = query.trim()
    const shouldSearch = trimmedQuery.length >= MIN_QUERY_LENGTH

    if (!shouldSearch) {
      setResults({ clients: [], projects: [] })
      setError(null)
      setLoading(false)
      setIsOpen(false)
      return
    }

    const currentRequestId = ++requestIdRef.current

    setLoading(true)
    setError(null)

    const escapedQuery = escapeForILike(trimmedQuery)
    const pattern = `%${escapedQuery}%`

    const fetchClients = async () => {
      const { data: nameMatches, error: nameError } = await supabase
        .from('clients')
        .select('id, name')
        .ilike('name', pattern)
        .order('name', { ascending: true })
        .limit(MAX_RESULTS)

      if (nameError) {
        throw nameError
      }

      let combined = [...(nameMatches ?? [])]

      if (isLikelyUuid(trimmedQuery)) {
        const { data: idMatch, error: idError } = await supabase
          .from('clients')
          .select('id, name')
          .eq('id', trimmedQuery)
          .limit(1)

        if (idError) {
          throw idError
        }

        if (idMatch && idMatch.length > 0) {
          const existing = new Set(combined.map((client) => client.id))
          for (const client of idMatch) {
            if (!existing.has(client.id)) {
              combined.unshift(client)
            }
          }
        }
      }

      return combined.slice(0, MAX_RESULTS)
    }

    const fetchProjects = async () => {
      const { data: nameMatches, error: nameError } = await supabase
        .from('projects')
        .select('id, name')
        .ilike('name', pattern)
        .order('name', { ascending: true })
        .limit(MAX_RESULTS)

      if (nameError) {
        throw nameError
      }

      let combined = [...(nameMatches ?? [])]

      if (isLikelyUuid(trimmedQuery)) {
        const { data: idMatch, error: idError } = await supabase
          .from('projects')
          .select('id, name')
          .eq('id', trimmedQuery)
          .limit(1)

        if (idError) {
          throw idError
        }

        if (idMatch && idMatch.length > 0) {
          const existing = new Set(combined.map((project) => project.id))
          for (const project of idMatch) {
            if (!existing.has(project.id)) {
              combined.unshift(project)
            }
          }
        }
      }

      return combined.slice(0, MAX_RESULTS)
    }

    Promise.all([fetchClients(), fetchProjects()])
      .then(([clients, projects]) => {
        if (requestIdRef.current !== currentRequestId) {
          return
        }
        setResults({ clients, projects })
        setLoading(false)
        setIsOpen(true)
      })
      .catch((fetchError: Error) => {
        console.error(fetchError)
        if (requestIdRef.current !== currentRequestId) {
          return
        }
        setError('We couldn\'t load search results. Please try again.')
        setResults({ clients: [], projects: [] })
        setLoading(false)
        setIsOpen(true)
      })
  }, [query, supabase])

  const hasResults = results.clients.length > 0 || results.projects.length > 0

  return (
    <div ref={containerRef} className={`relative ${wrapperClassName}`}>
      <div
        className={`flex w-full items-center gap-3 rounded-full border border-white/10 bg-base-900/60 px-4 py-2 text-sm text-white/60 shadow-sm shadow-base-900/30 focus-within:border-white/30 focus-within:text-white/80 ${inputContainerClassName}`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z" />
        </svg>
        <input
          type="search"
          value={query}
          onFocus={() => {
            if (query.trim().length >= MIN_QUERY_LENGTH) {
              setIsOpen(true)
            }
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setIsOpen(false)
              event.currentTarget.blur()
            }
          }}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent text-sm text-white/80 placeholder:text-white/40 focus:outline-none"
        />
      </div>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 space-y-3 rounded-2xl border border-white/10 bg-base-950/90 p-4 text-sm text-white/70 shadow-2xl backdrop-blur">
          {loading ? (
            <div className="py-4 text-center text-xs uppercase tracking-wide text-white/40">Loading results…</div>
          ) : error ? (
            <div className="py-4 text-center text-xs uppercase tracking-wide text-white/40">{error}</div>
          ) : hasResults ? (
            <div className="space-y-3">
              {results.clients.length > 0 && (
                <div>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">Clients</div>
                  <div className="space-y-2">
                    {results.clients.map((client) => (
                      <Link
                        key={client.id}
                        href={`/app/clients/${client.id}`}
                        onClick={() => setIsOpen(false)}
                        className="group flex flex-col rounded-xl border border-white/5 bg-white/5 px-4 py-3 transition hover:border-white/20 hover:bg-white/10"
                      >
                        <span className="text-sm font-semibold text-white group-hover:text-white">{client.name}</span>
                        <span className="text-xs text-white/50">ID: {client.id}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              {results.projects.length > 0 && (
                <div>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">Projects</div>
                  <div className="space-y-2">
                    {results.projects.map((project) => (
                      <Link
                        key={project.id}
                        href={`/app/projects/${project.id}`}
                        onClick={() => setIsOpen(false)}
                        className="group flex flex-col rounded-xl border border-white/5 bg-white/5 px-4 py-3 transition hover:border-white/20 hover:bg-white/10"
                      >
                        <span className="text-sm font-semibold text-white group-hover:text-white">{project.name}</span>
                        <span className="text-xs text-white/50">ID: {project.id}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="py-4 text-center text-xs uppercase tracking-wide text-white/40">
              No clients or projects match “{query.trim()}”.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
