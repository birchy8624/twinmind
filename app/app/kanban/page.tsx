'use client'

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'

import { createClient } from '@/utils/supabaseBrowser'

type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[]

const PIPELINE_COLUMNS = [
  {
    id: 'Backlog',
    title: 'Backlog',
    description: 'Capture inbound opportunities and fresh leads.'
  },
  {
    id: 'Call Arranged',
    title: 'Call Arranged',
    description: 'Intro call scheduled and prep underway.'
  },
  {
    id: 'Brief Gathered',
    title: 'Brief Gathered',
    description: 'Requirements captured, scoping in motion.'
  },
  {
    id: 'UI Stage',
    title: 'UI Stage',
    description: 'Design explorations and component decisions.'
  },
  {
    id: 'DB Stage',
    title: 'DB Stage',
    description: 'Data modelling and integration planning.'
  },
  {
    id: 'Auth Stage',
    title: 'Auth Stage',
    description: 'Security flows and access scaffolding.'
  },
  {
    id: 'Build',
    title: 'Build',
    description: 'Implementation in progress across the stack.'
  },
  {
    id: 'QA',
    title: 'QA',
    description: 'Verification, feedback loops, and polish.'
  },
  {
    id: 'Handover',
    title: 'Handover',
    description: 'Enablement, documentation, and sign-off.'
  },
  {
    id: 'Closed',
    title: 'Closed',
    description: 'Delivered outcomes and archived notes.'
  }
] as const

type PipelineStatus = (typeof PIPELINE_COLUMNS)[number]['id']

type ProjectRecord = {
  id: string
  name: string
  status: PipelineStatus
  created_at: string
  due_date: string | null
  value_quote: number | null
  labels: string[]
  tags: string[]
  client: { id: string; name: string } | null
  assignee: { id: string; full_name: string | null } | null
}

type ProjectQuery = {
  id: string
  name: string
  status: string | null
  created_at: string
  due_date: string | null
  value_quote: number | null
  labels: string[] | null
  tags: string[] | null
  clients: { id: string; name: string } | null
  assignee_profile: { id: string; full_name: string | null } | null
}

type PipelineOrderRow = {
  pipeline_column: string
  sort: string[] | null
}

type ActiveDragState = {
  projectId: string
  fromColumn: PipelineStatus
}

type DropIndicator = {
  columnId: PipelineStatus
  index: number
}

const pipelineStatusSet = new Set<PipelineStatus>(PIPELINE_COLUMNS.map((column) => column.id))

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0
})

const dueDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric'
})

const createEmptyOrder = (): Record<PipelineStatus, string[]> => {
  return PIPELINE_COLUMNS.reduce((accumulator, column) => {
    accumulator[column.id] = []
    return accumulator
  }, {} as Record<PipelineStatus, string[]>)
}

const clone = <T,>(value: T): T => {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }

  return JSON.parse(JSON.stringify(value))
}

const normalizeStatus = (status: string | null): PipelineStatus => {
  if (status && pipelineStatusSet.has(status as PipelineStatus)) {
    return status as PipelineStatus
  }

  return 'Backlog'
}

const formatDueDate = (value: string | null) => {
  if (!value) {
    return 'No due date'
  }

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return 'No due date'
  }

  return dueDateFormatter.format(parsed)
}

const formatValueQuote = (value: number | null) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '—'
  }

  return currencyFormatter.format(value)
}

function KanbanCard({
  project,
  columnId,
  index,
  draggingAllowed,
  isActive,
  onDragStart,
  onDragEnd,
  onDrop
}: {
  project: ProjectRecord
  columnId: PipelineStatus
  index: number
  draggingAllowed: boolean
  isActive: boolean
  onDragStart: (projectId: string, columnId: PipelineStatus) => void
  onDragEnd: () => void
  onDrop: (columnId: PipelineStatus, index: number) => void
}) {
  return (
    <motion.article
      layout
      layoutRoot
      layoutScroll
      whileHover={draggingAllowed ? { y: -2, boxShadow: '0 12px 30px rgba(59,130,246,0.22)' } : undefined}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      draggable={draggingAllowed}
      onDragStart={(event) => {
        if (!draggingAllowed) {
          return
        }
        event.dataTransfer.effectAllowed = 'move'
        onDragStart(project.id, columnId)
      }}
      onDragEnd={() => {
        onDragEnd()
      }}
      onDragOver={(event) => {
        if (!draggingAllowed) {
          return
        }
        event.preventDefault()
      }}
      onDrop={(event) => {
        if (!draggingAllowed) {
          return
        }
        event.preventDefault()
        onDrop(columnId, index)
      }}
      className={[
        'space-y-3 rounded-2xl border border-white/10 bg-base-900/60 p-4 transition',
        isActive ? 'border-limeglow-400/40 ring-1 ring-inset ring-limeglow-400/50 opacity-70' : ''
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">{project.name}</p>
          <p className="text-xs text-white/60">{project.client?.name ?? 'No client'}</p>
        </div>
        <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/60">
          {formatValueQuote(project.value_quote)}
        </span>
      </div>
      {(project.labels.length > 0 || project.tags.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {project.labels.map((label, labelIndex) => (
            <span
              key={`${project.id}-label-${label}-${labelIndex}`}
              className="rounded-full bg-sky-500/10 px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-sky-200"
            >
              {label}
            </span>
          ))}
          {project.tags.map((tag, tagIndex) => (
            <span
              key={`${project.id}-tag-${tag}-${tagIndex}`}
              className="rounded-full border border-white/15 px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-white/70"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between text-xs text-white/60">
        <span>Due {formatDueDate(project.due_date)}</span>
        <span>{project.assignee?.full_name ?? 'Unassigned'}</span>
      </div>
    </motion.article>
  )
}

export default function KanbanPage() {
  const [projects, setProjects] = useState<Record<string, ProjectRecord>>({})
  const [columnOrder, setColumnOrder] = useState<Record<PipelineStatus, string[]>>(createEmptyOrder)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeDrag, setActiveDrag] = useState<ActiveDragState | null>(null)
  const [hoveredDrop, setHoveredDrop] = useState<DropIndicator | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [clientFilter, setClientFilter] = useState('all')
  const [assigneeFilter, setAssigneeFilter] = useState('all')
  const [labelFilter, setLabelFilter] = useState('all')
  const [tagFilter, setTagFilter] = useState('all')
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null)
  const [isPersisting, setIsPersisting] = useState(false)

  const previousStateRef = useRef<{
    projects: Record<string, ProjectRecord>
    columnOrder: Record<PipelineStatus, string[]>
  } | null>(null)

  const supabase = useMemo(() => {
    try {
      return createClient()
    } catch (clientError) {
      console.error('Failed to create Supabase client', clientError)
      return null
    }
  }, [])

  useEffect(() => {
    if (!supabase) {
      setError('Supabase client unavailable. Check your environment configuration.')
      setLoading(false)
      return
    }

    let isMounted = true

    const loadPipeline = async () => {
      setLoading(true)
      setError(null)

      try {
        const [{ data: projectRows, error: projectError }, { data: orderRows, error: orderError }] = await Promise.all([
          supabase
            .from('projects')
            .select(
              `
                id,
                name,
                status,
                created_at,
                due_date,
                value_quote,
                labels,
                tags,
                clients:client_id ( id, name ),
                assignee_profile:assignee_profile_id ( id, full_name )
              `
            )
            .eq('archived', false)
            .returns<ProjectQuery[]>(),
          supabase
            .from('pipeline_order')
            .select('pipeline_column, sort')
            .returns<PipelineOrderRow[]>()
        ])

        if (projectError) {
          throw projectError
        }

        if (orderError) {
          throw orderError
        }

        const mappedProjects = (projectRows ?? []).reduce<Record<string, ProjectRecord>>((accumulator, item) => {
          const normalizedStatus = normalizeStatus(item.status)

          const labels = Array.isArray(item.labels)
            ? item.labels.filter((label): label is string => typeof label === 'string')
            : []
          const tags = Array.isArray(item.tags)
            ? item.tags.filter((tag): tag is string => typeof tag === 'string')
            : []

          accumulator[item.id] = {
            id: item.id,
            name: item.name,
            status: normalizedStatus,
            created_at: item.created_at,
            due_date: item.due_date,
            value_quote: item.value_quote,
            labels,
            tags,
            client: item.clients ? { id: item.clients.id, name: item.clients.name } : null,
            assignee: item.assignee_profile
              ? { id: item.assignee_profile.id, full_name: item.assignee_profile.full_name ?? null }
              : null
          }

          return accumulator
        }, {})

        const initialOrder = createEmptyOrder()

        for (const row of orderRows ?? []) {
          const normalizedStatus = normalizeStatus(row.pipeline_column)
          const ids = Array.isArray(row.sort) ? row.sort : []
          const uniqueIds: string[] = []

          for (const id of ids) {
            if (typeof id === 'string' && mappedProjects[id] && !uniqueIds.includes(id)) {
              uniqueIds.push(id)
            }
          }

          initialOrder[normalizedStatus] = uniqueIds
        }

        const projectsArray = Object.values(mappedProjects)

        projectsArray.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

        for (const project of projectsArray) {
          const order = initialOrder[project.status]
          if (!order.includes(project.id)) {
            order.push(project.id)
          }
        }

        if (isMounted) {
          setProjects(mappedProjects)
          setColumnOrder(initialOrder)
        }
      } catch (loadError) {
        console.error('Unable to load pipeline', loadError)
        if (isMounted) {
          setError('We ran into an issue loading the kanban pipeline. Please try again.')
          setProjects({})
          setColumnOrder(createEmptyOrder())
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    void loadPipeline()

    return () => {
      isMounted = false
    }
  }, [supabase])

  useEffect(() => {
    if (!supabase) {
      return
    }

    let isMounted = true

    const resolveProfile = async () => {
      try {
        const {
          data: { user },
          error: authError
        } = await supabase.auth.getUser()

        if (authError) {
          throw authError
        }

        if (isMounted) {
          setActiveProfileId(user?.id ?? null)
        }
      } catch (profileError) {
        console.error('Failed to resolve active profile for kanban audit logging', profileError)
        if (isMounted) {
          setActiveProfileId(null)
        }
      }
    }

    void resolveProfile()

    return () => {
      isMounted = false
    }
  }, [supabase])

  const filteredColumns = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()
    const useClient = clientFilter !== 'all'
    const useAssignee = assigneeFilter !== 'all'
    const useLabel = labelFilter !== 'all'
    const useTag = tagFilter !== 'all'

    const shouldInclude = (project: ProjectRecord) => {
      if (normalizedQuery && !project.name.toLowerCase().includes(normalizedQuery)) {
        return false
      }

      if (useClient && project.client?.id !== clientFilter) {
        return false
      }

      if (useAssignee && project.assignee?.id !== assigneeFilter) {
        return false
      }

      if (useLabel && !(project.labels ?? []).includes(labelFilter)) {
        return false
      }

      if (useTag && !(project.tags ?? []).includes(tagFilter)) {
        return false
      }

      return true
    }

    const results = PIPELINE_COLUMNS.reduce((accumulator, column) => {
      accumulator[column.id] = [] as ProjectRecord[]
      return accumulator
    }, {} as Record<PipelineStatus, ProjectRecord[]>)

    for (const [status, ids] of Object.entries(columnOrder)) {
      const typedStatus = status as PipelineStatus

      for (const id of ids) {
        const project = projects[id]
        if (project && shouldInclude(project)) {
          results[typedStatus].push(project)
        }
      }
    }

    return results
  }, [projects, columnOrder, searchQuery, clientFilter, assigneeFilter, labelFilter, tagFilter])

  const availableClients = useMemo(() => {
    const entries = new Map<string, string>()
    for (const project of Object.values(projects)) {
      if (project.client) {
        entries.set(project.client.id, project.client.name)
      }
    }
    return Array.from(entries.entries()).sort(([, nameA], [, nameB]) => nameA.localeCompare(nameB))
  }, [projects])

  const availableAssignees = useMemo(() => {
    const entries = new Map<string, string>()
    for (const project of Object.values(projects)) {
      if (project.assignee?.id) {
        entries.set(project.assignee.id, project.assignee.full_name ?? 'Unassigned')
      }
    }
    return Array.from(entries.entries()).sort(([, nameA], [, nameB]) => nameA.localeCompare(nameB))
  }, [projects])

  const availableLabels = useMemo(() => {
    const values = new Set<string>()
    for (const project of Object.values(projects)) {
      for (const label of project.labels ?? []) {
        values.add(label)
      }
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b))
  }, [projects])

  const availableTags = useMemo(() => {
    const values = new Set<string>()
    for (const project of Object.values(projects)) {
      for (const tag of project.tags ?? []) {
        values.add(tag)
      }
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b))
  }, [projects])

  const persistMove = useCallback(
    async (
      projectId: string,
      fromStatus: PipelineStatus,
      toStatus: PipelineStatus,
      nextOrder: Record<PipelineStatus, string[]>
    ) => {
      if (!supabase) {
        throw new Error('Supabase client unavailable.')
      }

      if (fromStatus !== toStatus) {
        const { error: statusError } = await supabase
          .from('projects')
          .update({ status: toStatus })
          .eq('id', projectId)

        if (statusError) {
          throw statusError
        }
      }

      const rowsToUpsert: { pipeline_column: PipelineStatus; sort: string[] }[] = []

      const sourceOrder = nextOrder[fromStatus]
      const destinationOrder = nextOrder[toStatus]

      if (fromStatus === toStatus) {
        rowsToUpsert.push({ pipeline_column: fromStatus, sort: destinationOrder })
      } else {
        rowsToUpsert.push(
          { pipeline_column: fromStatus, sort: sourceOrder },
          { pipeline_column: toStatus, sort: destinationOrder }
        )
      }

      const { error: orderError } = await supabase
        .from('pipeline_order')
        .upsert(rowsToUpsert, { onConflict: 'pipeline_column' })

      if (orderError) {
        throw orderError
      }

      const metaPayload = {
        from_status: fromStatus,
        to_status: toStatus,
        pipeline_order: nextOrder,
        timestamp: new Date().toISOString()
      } as unknown as Json

      const { error: auditError } = await supabase.from('audit_log').insert({
        actor_profile_id: activeProfileId,
        action: 'pipeline.updated',
        entity_type: 'project',
        entity_id: projectId,
        meta: metaPayload
      })

      if (auditError) {
        throw auditError
      }
    },
    [supabase, activeProfileId]
  )

  const handleProjectReorder = useCallback(
    async (projectId: string, sourceStatus: PipelineStatus, targetStatus: PipelineStatus, targetIndex: number) => {
      const project = projects[projectId]
      if (!project) {
        return
      }

      const currentOrder = columnOrder
      const sourceList = currentOrder[sourceStatus] ?? []
      const sourceIndex = sourceList.indexOf(projectId)

      if (sourceIndex === -1) {
        return
      }

      const adjustedIndex =
        sourceStatus === targetStatus && targetIndex > sourceIndex ? targetIndex - 1 : targetIndex

      if (sourceStatus === targetStatus && adjustedIndex === sourceIndex) {
        return
      }

      const nextOrder = clone(currentOrder)

      const updatedSource = nextOrder[sourceStatus].filter((id) => id !== projectId)

      if (sourceStatus === targetStatus) {
        const safeIndex = Math.min(Math.max(adjustedIndex, 0), updatedSource.length)
        updatedSource.splice(safeIndex, 0, projectId)
        nextOrder[sourceStatus] = updatedSource
      } else {
        nextOrder[sourceStatus] = updatedSource
        const destination = nextOrder[targetStatus]?.filter((id) => id !== projectId) ?? []
        const safeIndex = Math.min(Math.max(targetIndex, 0), destination.length)
        destination.splice(safeIndex, 0, projectId)
        nextOrder[targetStatus] = destination
      }

      previousStateRef.current = {
        projects: clone(projects),
        columnOrder: clone(columnOrder)
      }

      setProjects((prev) => ({
        ...prev,
        [projectId]: {
          ...prev[projectId],
          status: targetStatus
        }
      }))
      setColumnOrder(nextOrder)
      setIsPersisting(true)
      setError(null)

      try {
        await persistMove(projectId, sourceStatus, targetStatus, nextOrder)
      } catch (persistError) {
        console.error('Failed to persist kanban reorder', persistError)
        const previous = previousStateRef.current
        if (previous) {
          setProjects(previous.projects)
          setColumnOrder(previous.columnOrder)
        }
        setError('Unable to save kanban changes. Your board has been restored.')
      } finally {
        setIsPersisting(false)
        previousStateRef.current = null
      }
    },
    [projects, columnOrder, persistMove]
  )

  const handleDrop = useCallback(
    (columnId: PipelineStatus, index: number) => {
      if (!activeDrag) {
        return
      }

      setActiveDrag(null)
      setHoveredDrop(null)

      void handleProjectReorder(activeDrag.projectId, activeDrag.fromColumn, columnId, index)
    },
    [activeDrag, handleProjectReorder]
  )

  const handleDragStart = useCallback((projectId: string, columnId: PipelineStatus) => {
    setActiveDrag({ projectId, fromColumn: columnId })
    setHoveredDrop(null)
  }, [])

  const handleDragEnd = useCallback(() => {
    setActiveDrag(null)
    setHoveredDrop(null)
  }, [])

  const dragDisabled = Boolean(
    searchQuery.trim() ||
      clientFilter !== 'all' ||
      assigneeFilter !== 'all' ||
      labelFilter !== 'all' ||
      tagFilter !== 'all'
  )

  const draggingAllowed = !dragDisabled && !isPersisting

  const dropZoneVisible = Boolean(activeDrag) && draggingAllowed

  const renderDropZone = (columnId: PipelineStatus, index: number) => {
    if (!draggingAllowed) {
      return null
    }

    const isActive = hoveredDrop?.columnId === columnId && hoveredDrop.index === index

    return (
      <div
        key={`dropzone-${columnId}-${index}`}
        onDragEnter={(event) => {
          if (!activeDrag) {
            return
          }
          event.preventDefault()
          setHoveredDrop({ columnId, index })
        }}
        onDragOver={(event) => {
          if (!activeDrag) {
            return
          }
          event.preventDefault()
        }}
        onDragLeave={() => {
          if (hoveredDrop?.columnId === columnId && hoveredDrop.index === index) {
            setHoveredDrop(null)
          }
        }}
        onDrop={(event) => {
          if (!activeDrag) {
            return
          }
          event.preventDefault()
          handleDrop(columnId, index)
        }}
        className={[
          'h-3 rounded-full transition-all',
          dropZoneVisible ? 'my-1 opacity-70' : 'pointer-events-none my-0 opacity-0',
          isActive ? 'bg-limeglow-500/70 shadow-lg shadow-limeglow-500/40' : 'bg-white/10'
        ]
          .filter(Boolean)
          .join(' ')}
      />
    )
  }

  return (
    <section className="space-y-8">
      <header className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold text-white">Kanban</h1>
          <p className="mt-2 max-w-2xl text-sm text-white/65">
            Keep pulse on the delivery pipeline. Drag cards to rebalance workloads and align the team in real-time.
          </p>
        </div>
        <div className="space-y-4 rounded-3xl border border-white/10 bg-base-900/40 p-4 shadow-lg shadow-base-900/30 backdrop-blur">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <label className="flex items-center gap-2 rounded-full border border-white/10 bg-base-900/60 px-4 py-2 text-xs text-white/60 focus-within:border-white/30 focus-within:text-white/80">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z" />
              </svg>
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search projects"
                className="w-52 bg-transparent text-sm text-white outline-none placeholder:text-white/40"
              />
            </label>
            <div className="flex items-center gap-3 text-xs text-white/60">
              {dragDisabled ? (
                <span className="rounded-full bg-amber-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-200">
                  Filters active — drag disabled
                </span>
              ) : isPersisting ? (
                <span className="rounded-full bg-sky-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-sky-200">
                  Saving changes…
                </span>
              ) : (
                <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/40">
                  Drag to update pipeline
                </span>
              )}
            </div>
          </div>
          <div className="grid gap-2 text-xs text-white/70 sm:grid-cols-2 lg:grid-cols-4">
            <select
              value={clientFilter}
              onChange={(event) => setClientFilter(event.target.value)}
              className="rounded-full border border-white/10 bg-base-900/60 px-3 py-2 text-sm text-white/70 outline-none transition focus:border-white/30 focus:text-white"
            >
              <option value="all">All clients</option>
              {availableClients.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
            <select
              value={assigneeFilter}
              onChange={(event) => setAssigneeFilter(event.target.value)}
              className="rounded-full border border-white/10 bg-base-900/60 px-3 py-2 text-sm text-white/70 outline-none transition focus:border-white/30 focus:text-white"
            >
              <option value="all">All assignees</option>
              {availableAssignees.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
            <select
              value={labelFilter}
              onChange={(event) => setLabelFilter(event.target.value)}
              className="rounded-full border border-white/10 bg-base-900/60 px-3 py-2 text-sm text-white/70 outline-none transition focus:border-white/30 focus:text-white"
            >
              <option value="all">All labels</option>
              {availableLabels.map((label) => (
                <option key={label} value={label}>
                  {label}
                </option>
              ))}
            </select>
            <select
              value={tagFilter}
              onChange={(event) => setTagFilter(event.target.value)}
              className="rounded-full border border-white/10 bg-base-900/60 px-3 py-2 text-sm text-white/70 outline-none transition focus:border-white/30 focus:text-white"
            >
              <option value="all">All tags</option>
              {availableTags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </div>
        </div>
        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-base-900/50 px-4 py-2 text-xs text-white/60">
            Loading pipeline…
          </div>
        ) : null}
        {error ? (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-200">
            {error}
          </div>
        ) : null}
      </header>

      <motion.div layout className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {PIPELINE_COLUMNS.map((column, columnIndex) => {
          const cards = filteredColumns[column.id] ?? []
          const totalCards = columnOrder[column.id]?.length ?? 0

          return (
            <motion.div
              key={column.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: columnIndex * 0.05, duration: 0.22, ease: 'easeOut' }}
              className="flex h-full flex-col gap-3 rounded-3xl border border-white/10 bg-base-900/40 p-4 shadow-lg shadow-base-900/30 backdrop-blur"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-white">{column.title}</h2>
                  <p className="text-xs text-white/60">{column.description}</p>
                </div>
                <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/60">
                  {dragDisabled ? `${cards.length} / ${totalCards}` : cards.length}
                </span>
              </div>
              <div className="flex flex-1 flex-col">
                {renderDropZone(column.id, 0)}
                {cards.map((project, index) => (
                  <Fragment key={project.id}>
                    <KanbanCard
                      project={project}
                      columnId={column.id}
                      index={index}
                      draggingAllowed={draggingAllowed}
                      isActive={activeDrag?.projectId === project.id}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      onDrop={handleDrop}
                    />
                    {renderDropZone(column.id, index + 1)}
                  </Fragment>
                ))}
                {!loading && cards.length === 0 ? (
                  <div className="mt-2 flex flex-1 items-center justify-center rounded-2xl border border-dashed border-white/15 bg-base-900/50 p-6 text-center text-xs text-white/40">
                    {dragDisabled
                      ? 'No projects match the current filters.'
                      : 'No projects in this stage yet.'}
                  </div>
                ) : null}
              </div>
            </motion.div>
          )
        })}
      </motion.div>
    </section>
  )
}
