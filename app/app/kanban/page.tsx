'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode
} from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'

import {
  addProjectLabel,
  fetchKanbanProjects,
  updateProjectStatus,
  type KanbanProject as ApiKanbanProject,
} from '@/lib/api/projects'
import type { Database } from '@/types/supabase'

import { FilterDropdown } from '../_components/filter-dropdown'
import { StatusBadge } from '../_components/status-badge'
import { useToast } from '../_components/toast-context'

const PIPELINE_COLUMNS = [
  { status: 'Backlog', title: 'Backlog' },
  { status: 'Call Arranged', title: 'Call Arranged' },
  { status: 'Brief Gathered', title: 'Brief Gathered' },
  { status: 'Build', title: 'Build' },
  { status: 'Closed', title: 'Closed' }
] as const

type ColumnStatus = (typeof PIPELINE_COLUMNS)[number]['status']

type ProfileLite = Pick<Database['public']['Tables']['profiles']['Row'], 'id' | 'full_name'>
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

type LabelColors = Record<string, string>
type LabelComposerState = {
  projectId: string | null
  value: string
  isSubmitting: boolean
}

const LABEL_COLOR_STORAGE_KEY = 'twinmind-kanban-label-colors'
const PRESET_LABEL_COLORS = ['#F97316', '#F59E0B', '#10B981', '#3B82F6', '#A855F7'] as const
const DEFAULT_LABEL_COLOR = '#334155'
const MAX_LABEL_LENGTH = 20

function normalizeHexColor(value: string | null | undefined): string {
  if (typeof value !== 'string') {
    return DEFAULT_LABEL_COLOR
  }

  let hex = value.trim()
  if (!hex) {
    return DEFAULT_LABEL_COLOR
  }

  if (hex.startsWith('#')) {
    hex = hex.slice(1)
  }

  if (hex.length === 3) {
    hex = hex
      .split('')
      .map((char) => `${char}${char}`)
      .join('')
  }

  const isValid = /^[0-9A-Fa-f]{6}$/.test(hex)
  if (!isValid) {
    return DEFAULT_LABEL_COLOR
  }

  return `#${hex.toUpperCase()}`
}

function getReadableTextColor(value: string): string {
  const hex = normalizeHexColor(value)
  const red = Number.parseInt(hex.slice(1, 3), 16)
  const green = Number.parseInt(hex.slice(3, 5), 16)
  const blue = Number.parseInt(hex.slice(5, 7), 16)

  if ([red, green, blue].some((component) => Number.isNaN(component))) {
    return '#F8FAFC'
  }

  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255
  return luminance > 0.6 ? '#0F172A' : '#F8FAFC'
}

function getDefaultColorForLabel(label: string): string {
  if (!label) {
    return DEFAULT_LABEL_COLOR
  }

  let hash = 0
  const normalized = label.toLowerCase()
  for (let index = 0; index < normalized.length; index += 1) {
    hash = (hash + normalized.charCodeAt(index)) % PRESET_LABEL_COLORS.length
  }

  return PRESET_LABEL_COLORS[hash % PRESET_LABEL_COLORS.length]
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
        onDrop={(event) => {
          event.stopPropagation()
          onDrop(event)
        }}
        onDragOver={(event) => {
          event.stopPropagation()
          onDragOver(event)
        }}
        onDragEnter={(event) => {
          event.stopPropagation()
          onDragOver(event)
        }}
        onDragLeave={(event) => {
          event.stopPropagation()
          onDragLeave(event)
        }}
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
      onDrop={(event) => {
        event.stopPropagation()
        onDrop(event)
      }}
      onDragOver={(event) => {
        event.stopPropagation()
        onDragOver(event)
      }}
      onDragEnter={(event) => {
        event.stopPropagation()
        onDragOver(event)
      }}
      onDragLeave={(event) => {
        event.stopPropagation()
        onDragLeave(event)
      }}
      className={`${baseClasses} h-2 ${isDragging ? 'pointer-events-auto my-1' : 'pointer-events-none my-0'} ${activeClasses}`}
    />
  )
}

type LabelBadgeProps = {
  label: string
  color: string
  onColorChange: (color: string) => void
}

function LabelBadge({ label, color, onColorChange }: LabelBadgeProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    const handlePointer = (event: globalThis.MouseEvent) => {
      if (containerRef.current && containerRef.current.contains(event.target as Node)) {
        return
      }
      setIsOpen(false)
    }

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const normalizedColor = normalizeHexColor(color)
  const textColor = getReadableTextColor(normalizedColor)

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        className="flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium uppercase tracking-wide shadow-sm transition hover:shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        style={{ backgroundColor: normalizedColor, color: textColor }}
        onClick={() => setIsOpen((current) => !current)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <span className="leading-none">{label}</span>
        <svg className="h-2.5 w-2.5 opacity-80" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M4 6.5 8 10.5 12 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {isOpen ? (
        <div className="absolute left-1/2 top-full z-20 mt-2 w-48 -translate-x-1/2 rounded-xl border border-white/10 bg-base-900/95 p-3 shadow-2xl backdrop-blur">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/60">Label color</p>
          <div className="flex flex-wrap gap-2">
            {PRESET_LABEL_COLORS.map((preset) => {
              const normalizedPreset = normalizeHexColor(preset)
              const isSelected = normalizedPreset === normalizedColor
              const presetTextColor = getReadableTextColor(normalizedPreset)

              return (
                <button
                  key={normalizedPreset}
                  type="button"
                  className={`flex h-7 w-7 items-center justify-center rounded-full border border-white/20 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 ${
                    isSelected ? 'ring-2 ring-white/90 ring-offset-2 ring-offset-base-900' : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: normalizedPreset, color: presetTextColor }}
                  onClick={() => {
                    onColorChange(normalizedPreset)
                    setIsOpen(false)
                  }}
                  aria-label={`Use ${normalizedPreset} for ${label}`}
                  aria-pressed={isSelected}
                >
                  {isSelected ? (
                    <svg className="h-3 w-3" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path
                        d="m4 8.5 2.5 2.5L12 5.5"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : null}
                </button>
              )
            })}
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-base-900/60 px-2 py-1">
            <span className="text-xs font-medium uppercase tracking-wide text-white/70">Custom</span>
            <input
              type="color"
              className="h-7 w-14 cursor-pointer appearance-none border-none bg-transparent p-0"
              value={normalizedColor}
              onChange={(event) => {
                const nextColor = normalizeHexColor(event.target.value)
                onColorChange(nextColor)
              }}
              aria-label={`Choose a custom color for ${label}`}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default function KanbanPage() {
  const router = useRouter()
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
  const [labelColors, setLabelColors] = useState<LabelColors>({})
  const [labelComposer, setLabelComposer] = useState<LabelComposerState>({
    projectId: null,
    value: '',
    isSubmitting: false,
  })

  const { pushToast } = useToast()

  const resetLabelComposer = useCallback(() => {
    setLabelComposer({ projectId: null, value: '', isSubmitting: false })
  }, [])

  const handleLabelComposerOpen = useCallback((projectId: string) => {
    setLabelComposer((current) => ({
      projectId,
      value: current.projectId === projectId ? current.value : '',
      isSubmitting: false,
    }))
  }, [])

  const handleLabelComposerInputChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target
    setLabelComposer((current) => ({ ...current, value }))
  }, [])

  const handleLabelComposerCancel = useCallback(() => {
    resetLabelComposer()
  }, [resetLabelComposer])

  const handleLabelComposerSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()

      if (!labelComposer.projectId) {
        return
      }

      const normalizedInput = labelComposer.value.trim().replace(/\s+/g, ' ')

      if (!normalizedInput) {
        pushToast({
          title: 'Label required',
          description: 'Enter a label name before saving.',
          variant: 'error',
        })
        return
      }

      if (normalizedInput.length > MAX_LABEL_LENGTH) {
        pushToast({
          title: 'Label too long',
          description: `Labels must be ${MAX_LABEL_LENGTH} characters or fewer.`,
          variant: 'error',
        })
        return
      }

      setLabelComposer((current) => ({ ...current, isSubmitting: true }))

      try {
        const { project } = await addProjectLabel(labelComposer.projectId, normalizedInput)

        const nextLabels = Array.isArray(project.labels)
          ? project.labels.filter((label): label is string => typeof label === 'string' && label.length > 0)
          : []

        setProjects((current) => {
          const updated = new Map(current)
          const existing = updated.get(project.id)
          if (existing) {
            updated.set(project.id, { ...existing, labels: nextLabels })
          }
          return updated
        })

        resetLabelComposer()

        pushToast({
          title: 'Label added',
          description: `Added "${normalizedInput}" to the project.`,
          variant: 'success',
        })
      } catch (cause) {
        const message =
          cause instanceof Error && cause.message
            ? cause.message
            : 'We could not update the project labels. Please try again.'

        console.error('Failed to add project label', cause)
        pushToast({
          title: 'Failed to add label',
          description: message,
          variant: 'error',
        })
        setLabelComposer((current) => ({ ...current, isSubmitting: false }))
      }
    },
    [labelComposer.projectId, labelComposer.value, pushToast, resetLabelComposer]
  )

  useEffect(() => {
    if (!labelComposer.projectId) {
      return
    }

    const project = projects.get(labelComposer.projectId)
    if (!project || project.labels.length > 0) {
      resetLabelComposer()
    }
  }, [labelComposer.projectId, projects, resetLabelComposer])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    try {
      const storedValue = window.localStorage.getItem(LABEL_COLOR_STORAGE_KEY)
      if (!storedValue) {
        return
      }

      const parsed = JSON.parse(storedValue) as Record<string, unknown>
      const sanitized = Object.entries(parsed).reduce<LabelColors>((acc, [key, value]) => {
        if (typeof value === 'string' && key) {
          acc[key] = normalizeHexColor(value)
        }
        return acc
      }, {})

      if (Object.keys(sanitized).length > 0) {
        setLabelColors((current) => ({ ...current, ...sanitized }))
      }
    } catch (cause) {
      console.error('Failed to read stored Kanban label colors', cause)
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    const loadProjects = async () => {
      setLoading(true)
      setError(null)
      setUpdateError(null)

      try {
        const { projects: fetchedProjects } = await fetchKanbanProjects()

        if (!isMounted) {
          return
        }

        const projectMap = new Map<string, KanbanProject>()
        const orders = createEmptyOrders()

        for (const project of fetchedProjects as ApiKanbanProject[]) {
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
            client: project.client ?? null,
            assignee: project.assignee ?? null,
            value_quote: typeof project.value_quote === 'number' ? project.value_quote : null,
            due_date: project.due_date,
            labels,
            tags,
            created_at: project.created_at ?? null,
          }

          projectMap.set(project.id, normalized)
          orders[project.status] = [...orders[project.status], project.id]
        }

        setProjects(projectMap)
        setColumnOrders(orders)
      } catch (cause) {
        console.error('Failed to load Kanban projects', cause)
        if (!isMounted) {
          return
        }
        setError('We ran into an issue loading projects. Please try again.')
        setProjects(new Map())
        setColumnOrders(createEmptyOrders())
      } finally {
        if (!isMounted) {
          return
        }
        setLoading(false)
      }
    }

    void loadProjects()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    try {
      window.localStorage.setItem(LABEL_COLOR_STORAGE_KEY, JSON.stringify(labelColors))
    } catch (cause) {
      console.error('Failed to store Kanban label colors', cause)
    }
  }, [labelColors])

  const projectList = useMemo(() => Array.from(projects.values()), [projects])

  useEffect(() => {
    setLabelColors((current) => {
      const labelSet = new Set<string>()
      for (const project of projectList) {
        for (const label of project.labels) {
          if (label) {
            labelSet.add(label)
          }
        }
      }

      const sortedLabels = Array.from(labelSet).sort((a, b) => a.localeCompare(b))
      const next = sortedLabels.reduce<LabelColors>((acc, label) => {
        if (current[label]) {
          acc[label] = normalizeHexColor(current[label])
        } else {
          acc[label] = getDefaultColorForLabel(label)
        }
        return acc
      }, {})

      if (sortedLabels.length !== Object.keys(current).length) {
        return next
      }

      for (const label of sortedLabels) {
        if (next[label] !== current[label]) {
          return next
        }
      }

      return current
    })
  }, [projectList])

  const handleLabelColorChange = useCallback((label: string, color: string) => {
    if (!label) {
      return
    }

    const normalized = normalizeHexColor(color)
    setLabelColors((current) => {
      if (current[label] === normalized) {
        return current
      }

      return { ...current, [label]: normalized }
    })
  }, [])

  const clientOptions = useMemo(() => {
    const entries = new Map<string, string>()
    for (const project of projectList) {
      if (project.client) {
        entries.set(project.client.id, project.client.name)
      }
    }

    const sortedClients = Array.from(entries.entries())
      .map(([id, name]) => ({ value: id, label: name }))
      .sort((a, b) => a.label.localeCompare(b.label))

    return [{ value: 'all', label: 'All clients' }, ...sortedClients]
  }, [projectList])

  const assigneeOptions = useMemo(() => {
    const entries = new Map<string, string>()
    for (const project of projectList) {
      if (project.assignee) {
        entries.set(project.assignee.id, project.assignee.full_name ?? 'Unassigned')
      }
    }

    const sortedAssignees = Array.from(entries.entries())
      .map(([id, name]) => ({ value: id, label: name || 'Unassigned' }))
      .sort((a, b) => a.label.localeCompare(b.label))

    return [{ value: 'all', label: 'All assignees' }, ...sortedAssignees]
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

    const sortedLabels = Array.from(values)
      .sort((a, b) => a.localeCompare(b))
      .map((label) => ({ value: label, label }))

    return [{ value: 'all', label: 'All labels' }, ...sortedLabels]
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

    const sortedTags = Array.from(values)
      .sort((a, b) => a.localeCompare(b))
      .map((tag) => ({ value: tag, label: tag }))

    return [{ value: 'all', label: 'All tags' }, ...sortedTags]
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

      try {
        await updateProjectStatus(projectId, nextStatus)
        setUpdateError(null)
      } catch (cause) {
        const message =
          cause instanceof Error && cause.message
            ? cause.message
            : 'We could not update the project status. Please try again.'

        console.error('Failed to update project status', cause)
        setUpdateError('We could not update the project status. Please try again.')
        pushToast({
          title: 'Failed to update project status',
          description: message,
          variant: 'error'
        })
        setProjects(previousProjects)
        setColumnOrders(previousOrders)
      }
    },
    [columnOrders, dragState, projects, pushToast]
  )

  const handleProjectActivate = useCallback(
    (
      event: ReactMouseEvent<HTMLElement> | ReactKeyboardEvent<HTMLElement>,
      projectId: string
    ) => {
      if (dragState) {
        return
      }

      const target = event.target as HTMLElement | null
      if (!('key' in event) && target?.closest('button, a, input, select, textarea')) {
        return
      }

      router.push(`/app/projects/${projectId}`)
    },
    [dragState, router]
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
        className="relative z-10 rounded-3xl border border-white/10 bg-base-900/40 p-5 shadow-lg shadow-base-900/30 backdrop-blur"
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-white/50">
            <span className="sr-only">Search projects</span>
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by project name"
              className="rounded-xl border border-white/10 bg-base-900/60 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none"
              type="search"
            />
          </label>
          <FilterDropdown
            label="Client"
            value={clientFilter}
            options={clientOptions}
            onChange={setClientFilter}
          />
          <FilterDropdown
            label="Assignee"
            value={assigneeFilter}
            options={assigneeOptions}
            onChange={setAssigneeFilter}
          />
          <FilterDropdown
            label="Label"
            value={labelFilter}
            options={labelOptions}
            onChange={setLabelFilter}
          />
          <FilterDropdown
            label="Tag"
            value={tagFilter}
            options={tagOptions}
            onChange={setTagFilter}
          />
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
                    className={`space-y-3 rounded-2xl border border-white/10 bg-base-900/60 p-4 shadow-sm transition hover:border-white/20 hover:bg-base-900/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 cursor-pointer ${
                      'opacity-100'
                    }`}
                    draggable
                    tabIndex={0}
                    role="button"
                    onDragStart={(event) => {
                      const dragEvent = event as unknown as DragEvent<HTMLDivElement>
                      if (dragEvent.dataTransfer) {
                        dragEvent.dataTransfer.setData('text/plain', id)
                        dragEvent.dataTransfer.effectAllowed = 'move'
                      }
                      handleDragStart(id, column.status)
                    }}
                    onDragEnd={handleDragEnd}
                    onClick={(event) => handleProjectActivate(event, id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        handleProjectActivate(event, id)
                      }
                    }}
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
                        <LabelBadge
                          key={`${id}-label-${label}`}
                          label={label}
                          color={labelColors[label] ?? getDefaultColorForLabel(label)}
                          onColorChange={(nextColor) => handleLabelColorChange(label, nextColor)}
                        />
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
                        labelComposer.projectId === id ? (
                          <form
                            className="flex items-center gap-1 rounded-full bg-white/5 px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-white/80"
                            onSubmit={handleLabelComposerSubmit}
                          >
                            <label className="sr-only" htmlFor={`${id}-label-input`}>
                              Add a label
                            </label>
                            <input
                              id={`${id}-label-input`}
                              type="text"
                              autoFocus
                              value={labelComposer.value}
                              onChange={handleLabelComposerInputChange}
                              onKeyDown={(event) => {
                                if (event.key === 'Escape') {
                                  event.preventDefault()
                                  handleLabelComposerCancel()
                                }
                              }}
                              maxLength={MAX_LABEL_LENGTH}
                              disabled={labelComposer.isSubmitting}
                              className="w-24 bg-transparent text-[11px] font-medium uppercase tracking-wide text-white placeholder:text-white/40 focus:outline-none"
                              placeholder="Add label"
                            />
                            <button
                              type="submit"
                              className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:cursor-not-allowed disabled:opacity-60"
                              disabled={labelComposer.isSubmitting}
                            >
                              Add
                            </button>
                            <button
                              type="button"
                              onClick={handleLabelComposerCancel}
                              className="rounded-full p-1 text-white/60 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                              aria-label="Cancel adding label"
                              disabled={labelComposer.isSubmitting}
                            >
                              <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                                <path
                                  d="m3 3 6 6M9 3 3 9"
                                  stroke="currentColor"
                                  strokeWidth="1.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                              <span className="sr-only">Cancel</span>
                            </button>
                          </form>
                        ) : (
                          <button
                            type="button"
                            className="rounded-full bg-white/5 px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-white/60 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                            onClick={() => handleLabelComposerOpen(id)}
                          >
                            No labels
                          </button>
                        )
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

              const isColumnDropTarget =
                !!activeDrop && activeDrop.status === column.status && activeDrop.beforeId === null

              return (
                <motion.div
                  key={column.status}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: columnIndex * 0.04, duration: 0.22, ease: 'easeOut' }}
                  onDrop={(event) => {
                    event.preventDefault()
                    void handleDrop(column.status, null)
                  }}
                  onDragOver={(event) => {
                    event.preventDefault()
                    event.dataTransfer.dropEffect = 'move'
                    setActiveDrop((current) => {
                      if (current && current.status === column.status && current.beforeId !== null) {
                        return current
                      }

                      return { status: column.status, beforeId: null }
                    })
                  }}
                  onDragEnter={(event) => {
                    event.preventDefault()
                    event.dataTransfer.dropEffect = 'move'
                    setActiveDrop((current) => {
                      if (current && current.status === column.status && current.beforeId !== null) {
                        return current
                      }

                      return { status: column.status, beforeId: null }
                    })
                  }}
                  onDragLeave={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                      setActiveDrop((current) => {
                        if (current && current.status === column.status && current.beforeId === null) {
                          return null
                        }

                        return current
                      })
                    }
                  }}
                  className={`flex min-h-[280px] flex-col gap-3 rounded-3xl border p-4 shadow-lg backdrop-blur transition-colors ${
                    isColumnDropTarget
                      ? 'border-limeglow-400/70 bg-limeglow-400/10 shadow-limeglow-500/20'
                      : 'border-white/10 bg-base-900/40 shadow-base-900/30'
                  }`}
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

