'use client'

import { useCallback, useMemo, useState, type DragEvent, type ReactNode } from 'react'
import { motion } from 'framer-motion'

import { StatusBadge } from '../_components/status-badge'

const PIPELINE_COLUMNS = [
  { status: 'Backlog', title: 'Backlog' },
  { status: 'Call Arranged', title: 'Call Arranged' },
  { status: 'Brief Gathered', title: 'Brief Gathered' },
  { status: 'UI Stage', title: 'UI Stage' },
  { status: 'DB Stage', title: 'DB Stage' },
  { status: 'Auth Stage', title: 'Auth Stage' },
  { status: 'Build', title: 'Build' },
  { status: 'QA', title: 'QA' },
  { status: 'Handover', title: 'Handover' },
  { status: 'Closed', title: 'Closed' }
] as const

type ColumnStatus = (typeof PIPELINE_COLUMNS)[number]['status']

type KanbanProject = {
  id: string
  name: string
  status: ColumnStatus
  client: { id: string; name: string } | null
  assignee: { id: string; full_name: string } | null
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

const MOCK_PROJECTS: KanbanProject[] = [
  {
    id: 'proj-backlog-1',
    name: 'Marketing Launch Plan',
    status: 'Backlog',
    client: { id: 'client-nova', name: 'Nova Systems' },
    assignee: { id: 'profile-amelia', full_name: 'Amelia Rivers' },
    value_quote: 42000,
    due_date: '2024-08-20',
    labels: ['Strategy'],
    tags: ['marketing', 'launch'],
    created_at: '2024-05-10T09:12:00Z'
  },
  {
    id: 'proj-ui-1',
    name: 'Atlas Portal Redesign',
    status: 'UI Stage',
    client: { id: 'client-atlas', name: 'Atlas Ventures' },
    assignee: { id: 'profile-jordan', full_name: 'Jordan Miles' },
    value_quote: 58500,
    due_date: '2024-07-05',
    labels: ['Design'],
    tags: ['ui', 'research'],
    created_at: '2024-04-28T11:45:00Z'
  },
  {
    id: 'proj-build-1',
    name: 'Aurora Mobile Build',
    status: 'Build',
    client: { id: 'client-aurora', name: 'Aurora Labs' },
    assignee: { id: 'profile-sasha', full_name: 'Sasha Lin' },
    value_quote: 73500,
    due_date: '2024-06-30',
    labels: ['Development'],
    tags: ['mobile', 'react native'],
    created_at: '2024-03-15T14:22:00Z'
  },
  {
    id: 'proj-qa-1',
    name: 'Helios QA Suite',
    status: 'QA',
    client: { id: 'client-helios', name: 'Helios Manufacturing' },
    assignee: { id: 'profile-diego', full_name: 'Diego Ramos' },
    value_quote: 31200,
    due_date: '2024-06-18',
    labels: ['QA'],
    tags: ['automation'],
    created_at: '2024-04-02T08:05:00Z'
  },
  {
    id: 'proj-closed-1',
    name: 'Beacon Analytics Delivery',
    status: 'Closed',
    client: { id: 'client-beacon', name: 'Beacon Analytics' },
    assignee: { id: 'profile-lena', full_name: 'Lena Patel' },
    value_quote: 81000,
    due_date: '2024-05-12',
    labels: ['Delivery'],
    tags: ['data', 'handover'],
    created_at: '2024-02-22T16:30:00Z'
  }
]

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
  const [projects, setProjects] = useState<Map<string, KanbanProject>>(() => {
    const map = new Map<string, KanbanProject>()
    for (const project of MOCK_PROJECTS) {
      map.set(project.id, project)
    }
    return map
  })
  const [columnOrders, setColumnOrders] = useState<ColumnOrders>(() => {
    const orders = createEmptyOrders()
    for (const project of MOCK_PROJECTS) {
      orders[project.status] = [...orders[project.status], project.id]
    }
    return orders
  })
  const [searchTerm, setSearchTerm] = useState('')
  const [clientFilter, setClientFilter] = useState<string>('all')
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all')
  const [labelFilter, setLabelFilter] = useState<string>('all')
  const [tagFilter, setTagFilter] = useState<string>('all')
  const [dragState, setDragState] = useState<DragState | null>(null)
  const [activeDrop, setActiveDrop] = useState<{ status: ColumnStatus; beforeId: string | null } | null>(null)
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
        if (typeof label === 'string' && label.trim()) {
          values.add(label.trim())
        }
      }
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b))
  }, [projectList])

  const tagOptions = useMemo(() => {
    const values = new Set<string>()
    for (const project of projectList) {
      for (const tag of project.tags) {
        if (typeof tag === 'string' && tag.trim()) {
          values.add(tag.trim())
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
    (targetStatus: ColumnStatus, insertBeforeId: string | null) => {
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
    },
    [columnOrders, dragState, projects]
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

