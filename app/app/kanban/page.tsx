'use client'

import { useCallback, useEffect, useMemo, useState, type DragEvent, type ReactNode } from 'react'
import { motion } from 'framer-motion'

import { createBrowserClient } from '@/lib/supabaseClient'
import type { Database } from '@/types/supabase'

import { StatusBadge } from '../_components/status-badge'
import { useToast } from '../_components/toast-context'

const PIPELINE_COLUMNS = [
  { status: 'Backlog', title: 'Backlog' },
  { status: 'Call Arranged', title: 'Call Arranged' },
  { status: 'Brief Gathered', title: 'Brief Gathered' },
  { status: 'Build', title: 'Build' },
  { status: 'Closed', title: 'Closed' }
] as const

const PROJECTS = 'projects' as const

type ColumnStatus = (typeof PIPELINE_COLUMNS)[number]['status']

type ProjectRow = Database['public']['Tables']['projects']['Row']
type ClientRow = Database['public']['Tables']['clients']['Row']
type ProfileLite = Pick<Database['public']['Tables']['profiles']['Row'], 'id' | 'full_name'>
type ProjectUpdate = Database['public']['Tables']['projects']['Update']
type ProjectStatus = Database['public']['Enums']['project_status']

const statusMap: Record<ColumnStatus, ProjectStatus> = {
  Backlog: 'Backlog',
  'Call Arranged': 'Call Arranged',
  'Brief Gathered': 'Brief Gathered',
  Build: 'Build',
  Closed: 'Closed'
}

type KanbanProject = {
  id: string
  name: string
  status: ColumnStatus
  client: { id: string; name: string } | null
  assignee: ProfileLite | null
  value_quote: number | null
  due_date: string | null
  labels: string[]
  tags: string[]
  created_at: string | null
}

type ColumnOrders = Record<ColumnStatus, string[]>

type DragState = {
  projectId: string
  fromStatus: ColumnStatus
}

function createEmptyOrders(): ColumnOrders {
  return PIPELINE_COLUMNS.reduce((acc, column) => {
    acc[column.status] = []
    return acc
  }, {} as ColumnOrders)
}

function formatCurrency(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return 'Unquoted'
  }

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0
    }).format(value)
  } catch {
    return `${value}`
  }
}

function formatDate(value: string | null): string {
  if (!value) {
    return 'No due date'
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return 'No due date'
  }

  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) {
    return false
  }

  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) {
      return false
    }
  }

  return true
}

function isColumnStatus(value: string | null | undefined): value is ColumnStatus {
  if (!value) {
    return false
  }

  return PIPELINE_COLUMNS.some((column) => column.status === value)
}

type DropZoneProps = {
  isActive: boolean
  isDragging: boolean
  onDrop: (event: DragEvent<HTMLDivElement>) => void
  onDragOver: (event: DragEvent<HTMLDivElement>) => void
  onDragLeave: (event: DragEvent<HTMLDivElement>) => void
  children?: ReactNode
  variant?: 'between' | 'empty'
}

function DropZone({ isActive, isDragging, onDrop, onDragOver, onDragLeave, children, variant = 'between' }: DropZoneProps) {
  const baseClasses =
    'transition-all duration-150 ease-out rounded-2xl border border-dashed border-transparent text-xs text-white/60'
  const activeClasses = isActive
    ? 'border-limeglow-400/70 bg-limeglow-400/10 text-limeglow-200'
    : 'border-white/5 bg-transparent'

  if (variant === 'empty') {
    return (
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragEnter={onDragOver}
        onDragLeave={onDragLeave}
        className={`${baseClasses} flex min-h-[120px] items-center justify-center bg-base-900/40 ${
          isDragging ? 'pointer-events-auto' : 'pointer-events-none'
        } ${activeClasses}`}
      >
        {children}
      </div>
    )
  }

  return (
    <div
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragEnter={onDragOver}
      onDragLeave={onDragLeave}
      className={`${baseClasses} h-2 ${isDragging ? 'pointer-events-auto my-1' : 'pointer-events-none my-0'} ${activeClasses}`}
    />
  )
}

export default function KanbanPage() {
  const [projects, setProjects] = useState<Map<string, KanbanProject>>(new Map())
  const [columnOrders, setColumnOrders] = useState<ColumnOrders>(() => createEmptyOrders())
  const [searchTerm, setSearchTerm] = useState('')
  const [clientFilter, setClientFilter] = useState<string>('all')
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all')
  const [labelFilter, setLabelFilter] = useState<string>('all')
  const [tagFilter, setTagFilter] = useState<string>('all')
  const [dragState, setDragState] = useState<DragState | null>(null)
  const [activeDrop, setActiveDrop] = useState<{ status: ColumnStatus; beforeId: string | null } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updateError, setUpdateError] = useState<string | null>(null)

  const { pushToast } = useToast()

  const supabase = useMemo(createBrowserClient, [])

  useEffect(() => {
    let isMounted = true

    const fetchProjects = async () => {
      setLoading(true)
      setError(null)
      setUpdateError(null)

      const { data, error: fetchError } = await supabase
        .from(PROJECTS)
        .select(
          `
            id,
            name,
            status,
            value_quote,
            due_date,
            created_at,
            labels,
            tags,
            clients:client_id ( id, name ),
            assignee_profile:assignee_profile_id ( id, full_name )
          `
        )
        .in(
          'status',
          PIPELINE_COLUMNS.map((column) => column.status)
        )
        .order('created_at', { ascending: false })

      if (!isMounted) return

      if (fetchError) {
        console.error(fetchError)
        setError('We ran into an issue loading projects. Please try again.')
        setProjects(new Map())
        setColumnOrders(createEmptyOrders())
      } else {
        type ProjectQuery = ProjectRow & {
          clients: Pick<ClientRow, 'id' | 'name'> | null
          assignee_profile: ProfileLite | null
        }

        const typedProjects = (data ?? []) as ProjectQuery[]

        const projectMap = new Map<string, KanbanProject>()
        const orders = createEmptyOrders()

        for (const project of typedProjects) {
          if (!isColumnStatus(project.status)) {
            continue
          }

          const labels = Array.isArray(project.labels)
            ? project.labels
                .map((label) => (typeof label === 'string' ? label.trim() : ''))
                .filter((label): label is string => label.length > 0)
            : []

          const tags = Array.isArray(project.tags)
            ? project.tags
                .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
                .filter((tag): tag is string => tag.length > 0)
            : []

          const normalized: KanbanProject = {
            id: project.id,
            name: project.name,
            status: project.status,
            client: project.clients ?? null,
            assignee: project.assignee_profile ?? null,
            value_quote: typeof project.value_quote === 'number' ? project.value_quote : null,
            due_date: project.due_date,
            labels,
            tags,
            created_at: project.created_at
          }

          projectMap.set(project.id, normalized)
          orders[project.status] = [...orders[project.status], project.id]
        }

        setProjects(projectMap)
        setColumnOrders(orders)
      }

      setLoading(false)
    }

    void fetchProjects()

    return () => {
      isMounted = false
    }
  }, [supabase])

  const projectList = useMemo(() => Array.from(projects.values()), [projects])

  const clientOptions = useMemo(() => {
    const entries = new Map<string, string>()
    for (const project of projectList) {
      if (project.client) {
        entries.set(project.client.id, project.client.name)
      }
    }
    return Array.from(entries.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [projectList])

  const assigneeOptions = useMemo(() => {
    const entries = new Map<string, string>()
    for (const project of projectList) {
      if (project.assignee) {
        entries.set(project.assignee.id, project.assignee.full_name ?? 'Unassigned')
      }
    }
    return Array.from(entries.entries())
      .map(([id, name]) => ({ id, name: name || 'Unassigned' }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [projectList])

  const labelOptions = useMemo(() => {
    const values = new Set<string>()
    for (const project of projectList) {
      for (const label of project.labels) {
        if (label) {
          values.add(label)
        }
      }
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b))
  }, [projectList])

  const tagOptions = useMemo(() => {
    const values = new Set<string>()
    for (const project of projectList) {
      for (const tag of project.tags) {
        if (tag) {
          values.add(tag)
        }
      }
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b))
  }, [projectList])

  const matchesFilters = useCallback(
    (project: KanbanProject) => {
      const normalizedQuery = searchTerm.trim().toLowerCase()
      const matchesQuery =
        !normalizedQuery || project.name.toLowerCase().includes(normalizedQuery)

      if (!matchesQuery) {
        return false
      }

      if (clientFilter !== 'all' && project.client?.id !== clientFilter) {
        return false
      }

      if (assigneeFilter !== 'all' && project.assignee?.id !== assigneeFilter) {
        return false
      }

      if (labelFilter !== 'all') {
        const hasLabel = project.labels.some((label) => label === labelFilter)
        if (!hasLabel) {
          return false
        }
      }

      if (tagFilter !== 'all') {
        const hasTag = project.tags.some((tag) => tag === tagFilter)
        if (!hasTag) {
          return false
        }
      }

      return true
    },
    [assigneeFilter, clientFilter, labelFilter, searchTerm, tagFilter]
  )

  const handleDragStart = useCallback((projectId: string, fromStatus: ColumnStatus) => {
    setDragState({ projectId, fromStatus })
  }, [])

  const handleDragEnd = useCallback(() => {
    setDragState(null)
    setActiveDrop(null)
  }, [])

  const handleDrop = useCallback(
    async (targetStatus: ColumnStatus, insertBeforeId: string | null) => {
      if (!dragState) {
        setActiveDrop(null)
        return
      }

      const { projectId, fromStatus } = dragState
      if (insertBeforeId === projectId && fromStatus === targetStatus) {
        setActiveDrop(null)
        setDragState(null)
        return
      }
      const previousOrders = PIPELINE_COLUMNS.reduce((acc, column) => {
        acc[column.status] = [...(columnOrders[column.status] ?? [])]
        return acc
      }, {} as ColumnOrders)

      const previousProjects = new Map(projects)

      const nextOrders = PIPELINE_COLUMNS.reduce((acc, column) => {
        acc[column.status] = [...(columnOrders[column.status] ?? [])]
        return acc
      }, {} as ColumnOrders)

      for (const column of PIPELINE_COLUMNS) {
        nextOrders[column.status] = nextOrders[column.status].filter((id) => id !== projectId)
      }

      const targetList = nextOrders[targetStatus] ?? []
      const insertionIndex = insertBeforeId ? targetList.indexOf(insertBeforeId) : targetList.length
      const targetInsertionIndex = insertionIndex >= 0 ? insertionIndex : targetList.length

      targetList.splice(targetInsertionIndex, 0, projectId)

      nextOrders[targetStatus] = targetList

      const affectedStatuses = new Set<ColumnStatus>([targetStatus, fromStatus])

      const hasOrderChanged = Array.from(affectedStatuses).some((status) => {
        const before = previousOrders[status] ?? []
        const after = nextOrders[status] ?? []
        return !arraysEqual(before, after)
      })

      const statusChanged = fromStatus !== targetStatus

      if (!hasOrderChanged && !statusChanged) {
        setActiveDrop(null)
        setDragState(null)
        return
      }

      const updatedProjects = new Map(projects)
      const project = updatedProjects.get(projectId)
      if (project) {
        updatedProjects.set(projectId, { ...project, status: targetStatus })
      }

      setProjects(updatedProjects)
      setColumnOrders(nextOrders)
      setActiveDrop(null)
      setDragState(null)

      if (!statusChanged) {
        return
      }

      const nextStatus = statusMap[targetStatus]
      const patch: ProjectUpdate = { status: nextStatus }

      const { error: updateStatusError } = await supabase
        .from(PROJECTS)
        .update(patch)
        .eq('id', projectId)

      if (updateStatusError) {
        console.error(updateStatusError)
        setUpdateError('We could not update the project status. Please try again.')
        pushToast({
          title: 'Failed to update project status',
          description: updateStatusError.message,
          variant: 'error'
        })
        setProjects(previousProjects)
        setColumnOrders(previousOrders)
      } else {
        setUpdateError(null)
      }
    },
    [columnOrders, dragState, projects, supabase, pushToast]
  )

  const visibleCounts = useMemo(() => {
    const counts = new Map<ColumnStatus, number>()
    for (const column of PIPELINE_COLUMNS) {
      const ids = columnOrders[column.status] ?? []
      let count = 0
      for (const id of ids) {
        const project = projects.get(id)
        if (project && matchesFilters(project)) {
          count += 1
        }
      }
      counts.set(column.status, count)
    }
    return counts
  }, [columnOrders, matchesFilters, projects])

  return (
    <section className="space-y-8">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold text-white">Kanban</h1>
        <p className="max-w-2xl text-sm text-white/65">
          Drag cards across the delivery pipeline to rebalance workloads and keep everyone aligned.
        </p>
      </header>

      {error ? (
        <div className="rounded-2xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      {updateError && !error ? (
        <div className="rounded-2xl border border-amber-300/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
          {updateError}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-white/10 bg-base-900/40 px-4 py-3 text-sm text-white/60">
          Loading projects…
        </div>
      ) : null}

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="rounded-3xl border border-white/10 bg-base-900/40 p-5 shadow-lg shadow-base-900/30 backdrop-blur"
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-white/50">
            <span>Search projects</span>
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by project name"
              className="rounded-xl border border-white/10 bg-base-900/60 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none"
              type="search"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-white/50">
            <span>Client</span>
            <select
              value={clientFilter}
              onChange={(event) => setClientFilter(event.target.value)}
              className="rounded-xl border border-white/10 bg-base-900/60 px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none"
            >
              <option value="all">All clients</option>
              {clientOptions.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-white/50">
            <span>Assignee</span>
            <select
              value={assigneeFilter}
              onChange={(event) => setAssigneeFilter(event.target.value)}
              className="rounded-xl border border-white/10 bg-base-900/60 px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none"
            >
              <option value="all">All assignees</option>
              {assigneeOptions.map((assignee) => (
                <option key={assignee.id} value={assignee.id}>
                  {assignee.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-white/50">
            <span>Label</span>
            <select
              value={labelFilter}
              onChange={(event) => setLabelFilter(event.target.value)}
              className="rounded-xl border border-white/10 bg-base-900/60 px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none"
            >
              <option value="all">All labels</option>
              {labelOptions.map((label) => (
                <option key={label} value={label}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-white/50">
            <span>Tag</span>
            <select
              value={tagFilter}
              onChange={(event) => setTagFilter(event.target.value)}
              className="rounded-xl border border-white/10 bg-base-900/60 px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none"
            >
              <option value="all">All tags</option>
              {tagOptions.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </label>
        </div>
      </motion.div>

      <div
        className="grid gap-4 xl:grid-cols-5 2xl:grid-cols-5"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}
      >
          {PIPELINE_COLUMNS.map((column, columnIndex) => {
            const projectIds = columnOrders[column.status] ?? []
            const totalProjectsInColumn = projectIds.filter((id) => projects.has(id)).length

            const columnElements: ReactNode[] = []

            if (projectIds.length === 0) {
              columnElements.push(
                <DropZone
                  key={`${column.status}-empty-drop`}
                  isActive={!!activeDrop && activeDrop.status === column.status}
                  isDragging={!!dragState}
                  onDrop={(event) => {
                    event.preventDefault()
                    void handleDrop(column.status, null)
                  }}
                  onDragOver={(event) => {
                    event.preventDefault()
                    event.dataTransfer.dropEffect = 'move'
                    setActiveDrop({ status: column.status, beforeId: null })
                  }}
                  onDragLeave={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                      setActiveDrop((current) =>
                        current && current.status === column.status && current.beforeId === null ? null : current
                      )
                    }
                  }}
                  variant="empty"
                >
                  <span className="text-sm text-white/50">Drop work here</span>
                </DropZone>
              )
            } else {
              let hasVisibleProjects = false

              for (const id of projectIds) {
                columnElements.push(
                  <DropZone
                    key={`${column.status}-drop-before-${id}`}
                    isActive={
                      !!activeDrop && activeDrop.status === column.status && activeDrop.beforeId === id
                    }
                    isDragging={!!dragState}
                    onDrop={(event) => {
                      event.preventDefault()
                      void handleDrop(column.status, id)
                    }}
                    onDragOver={(event) => {
                      event.preventDefault()
                      event.dataTransfer.dropEffect = 'move'
                      setActiveDrop({ status: column.status, beforeId: id })
                    }}
                    onDragLeave={(event) => {
                      if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                        setActiveDrop((current) =>
                          current && current.status === column.status && current.beforeId === id ? null : current
                        )
                      }
                    }}
                  />
                )

                const project = projects.get(id)
                if (!project || !matchesFilters(project)) {
                  continue
                }

                hasVisibleProjects = true
                columnElements.push(
                  <motion.article
                    key={id}
                    layout
                    layoutId={id}
                    className={`space-y-3 rounded-2xl border border-white/10 bg-base-900/60 p-4 shadow-sm transition ${
                      'opacity-100'
                    }`}
                    draggable
                    onDragStart={(event) => {
                      const dragEvent = event as unknown as DragEvent<HTMLDivElement>
                      if (dragEvent.dataTransfer) {
                        dragEvent.dataTransfer.setData('text/plain', id)
                        dragEvent.dataTransfer.effectAllowed = 'move'
                      }
                      handleDragStart(id, column.status)
                    }}
                    onDragEnd={handleDragEnd}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{project.name}</p>
                        <p className="text-xs text-white/60">
                          {project.client?.name ? project.client.name : 'Unknown client'}
                        </p>
                      </div>
                      <StatusBadge status={project.status} />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {project.labels.map((label) => (
                        <span
                          key={`${id}-label-${label}`}
                          className="rounded-full bg-white/10 px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-white/70"
                        >
                          {label}
                        </span>
                      ))}
                      {project.tags.map((tag) => (
                        <span
                          key={`${id}-tag-${tag}`}
                          className="rounded-full bg-base-800/80 px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-white/60"
                        >
                          {tag}
                        </span>
                      ))}
                      {project.labels.length === 0 && project.tags.length === 0 ? (
                        <span className="rounded-full bg-white/5 px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-white/40">
                          No labels
                        </span>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-white/60">
                      <div className="flex items-center gap-2">
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M3 7h18M3 12h18M3 17h18" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span>{formatCurrency(project.value_quote)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path
                            d="M6.75 4.5v2.25M17.25 4.5v2.25M4.5 9.75h15M5.25 7.5h13.5a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5v-9a1.5 1.5 0 0 1 1.5-1.5Z"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        <span>{formatDate(project.due_date)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path
                            d="M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M12 12.75a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        <span>{project.assignee?.full_name ?? 'Unassigned'}</span>
                      </div>
                    </div>
                  </motion.article>
                )
              }

              if (!hasVisibleProjects) {
                columnElements.push(
                  <div
                    key={`${column.status}-no-visible`}
                    className="rounded-2xl border border-dashed border-white/10 bg-base-900/40 px-4 py-6 text-center text-xs text-white/50"
                  >
                    No projects match the current filters.
                  </div>
                )
              }

              columnElements.push(
                <DropZone
                  key={`${column.status}-drop-end`}
                  isActive={
                    !!activeDrop && activeDrop.status === column.status && activeDrop.beforeId === null
                  }
                  isDragging={!!dragState}
                  onDrop={(event) => {
                    event.preventDefault()
                    void handleDrop(column.status, null)
                  }}
                  onDragOver={(event) => {
                    event.preventDefault()
                    event.dataTransfer.dropEffect = 'move'
                    setActiveDrop({ status: column.status, beforeId: null })
                  }}
                  onDragLeave={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                      setActiveDrop((current) =>
                        current && current.status === column.status && current.beforeId === null ? null : current
                      )
                    }
                  }}
                />
              )
            }

              const visibleCount = visibleCounts.get(column.status) ?? 0

              return (
                <motion.div
                  key={column.status}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: columnIndex * 0.04, duration: 0.22, ease: 'easeOut' }}
                  className="flex min-h-[280px] flex-col gap-3 rounded-3xl border border-white/10 bg-base-900/40 p-4 shadow-lg shadow-base-900/30 backdrop-blur"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h2 className="text-sm font-semibold text-white">{column.title}</h2>
                      <p className="text-xs text-white/60">{visibleCount} project{visibleCount === 1 ? '' : 's'}</p>
                    </div>
                    <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/60">
                      {totalProjectsInColumn}
                    </span>
                  </div>
                  <div className="space-y-2">{columnElements}</div>
                </motion.div>
              )
            })}
      </div>
    </section>
  )
}

