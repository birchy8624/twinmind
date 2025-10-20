'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'

import type { FileObject } from '@supabase/storage-js'

import { useActiveProfile } from '../../_components/active-profile-context'
import { StatusBadge } from '../../_components/status-badge'
import { useToast } from '../../_components/toast-context'
import type { Database } from '@/types/supabase'
import { createBrowserClient } from '@/lib/supabase/browser'

type ProjectRow = Database['public']['Tables']['projects']['Row']
type ClientRow = Database['public']['Tables']['clients']['Row']
type ProfileRow = Database['public']['Tables']['profiles']['Row']
type InvoiceRow = Database['public']['Tables']['invoices']['Row']

type Project = ProjectRow & {
  client: Pick<ClientRow, 'id' | 'name'> | null
  assignee: Pick<ProfileRow, 'id' | 'full_name'> | null
  budget: string | null
}

type EditableProject = {
  name: string
  description: string
  status: ProjectRow['status'] | ''
  dueDate: string
  clientId: string
  assigneeId: string
  budget: string
  valueQuote: string
  valueInvoiced: string
  valuePaid: string
  labels: string
  tags: string
}

type BriefAnswers = {
  goals: string | null
  personas: string[]
  features: string[]
  integrations: string[]
  timeline: string | null
  successMetrics: string | null
  competitors: string[]
  risks: string | null
}

type InvoiceInfo = Pick<
  InvoiceRow,
  'id' | 'amount' | 'currency' | 'status' | 'issued_at' | 'due_at' | 'external_url' | 'paid_at' | 'created_at' | 'updated_at'
>

const PROJECTS = 'projects' as const
const INVOICES = 'invoices' as const
const CLIENTS = 'clients' as const
const PROFILES = 'profiles' as const
const COMMENTS = 'comments' as const
const BRIEFS = 'briefs' as const
const STORAGE_BUCKET = 'project-files' as const

type ProjectUpdate = Database['public']['Tables']['projects']['Update']
type ProjectStatus = Database['public']['Enums']['project_status']
type InvoiceUpdate = Database['public']['Tables']['invoices']['Update']
type InvoiceInsert = Database['public']['Tables']['invoices']['Insert']

const INVOICE_STAGE_OPTIONS = ['Quote', 'Sent', 'Paid'] as const
type InvoiceStage = (typeof INVOICE_STAGE_OPTIONS)[number]

const INVOICE_STAGE_BADGE_VARIANTS: Record<InvoiceStage, string> = {
  Quote: 'border border-white/15 bg-white/5 text-white/70',
  Sent: 'border border-amber-400/40 bg-amber-500/10 text-amber-200',
  Paid: 'border border-limeglow-500/40 bg-limeglow-500/10 text-limeglow-100'
}

const normalizeInvoiceStage = (
  status: Database['public']['Enums']['invoice_status'] | null | undefined
): InvoiceStage => {
  const candidate = status ?? 'Quote'
  return INVOICE_STAGE_OPTIONS.includes(candidate as InvoiceStage)
    ? (candidate as InvoiceStage)
    : 'Quote'
}

type InvoiceEditorState = {
  stage: InvoiceStage
  amount: string
  currency: string
  dueDate: string
}

type BriefFormState = {
  goals: string
  personas: string
  features: string
  integrations: string
  timeline: string
  successMetrics: string
  competitors: string
  risks: string
}

type ProjectComment = {
  id: string
  body: string
  created_at: string | null
  visibility: Database['public']['Enums']['visibility_enum']
  author: Pick<ProfileRow, 'id' | 'full_name' | 'role'> | null
}

type ProjectFileObject = {
  path: string
  name: string
  id: string | null
  created_at: string | null
  updated_at: string | null
  last_accessed_at: string | null
  size: number | null
}

type RecentActivityItem = {
  id: string
  label: string
  description: string
  timestamp: string | null
}

type TabKey = 'overview' | 'brief' | 'files' | 'comments' | 'billing'

const createEmptyBriefFormState = (): BriefFormState => ({
  goals: '',
  personas: '',
  features: '',
  integrations: '',
  timeline: '',
  successMetrics: '',
  competitors: '',
  risks: ''
})

const mapBriefAnswersToFormState = (answers: BriefAnswers | null): BriefFormState => ({
  goals: answers?.goals ?? '',
  personas: answers ? answers.personas.join('\n') : '',
  features: answers ? answers.features.join('\n') : '',
  integrations: answers ? answers.integrations.join('\n') : '',
  timeline: answers?.timeline ?? '',
  successMetrics: answers?.successMetrics ?? '',
  competitors: answers ? answers.competitors.join('\n') : '',
  risks: answers?.risks ?? ''
})

const mapBriefFormStateToAnswers = (state: BriefFormState): BriefAnswers => {
  const normalizeList = (input: string): string[] =>
    input
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0)

  const normalizeString = (value: string): string | null => {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }

  return {
    goals: normalizeString(state.goals),
    personas: normalizeList(state.personas),
    features: normalizeList(state.features),
    integrations: normalizeList(state.integrations),
    timeline: normalizeString(state.timeline),
    successMetrics: normalizeString(state.successMetrics),
    competitors: normalizeList(state.competitors),
    risks: normalizeString(state.risks)
  }
}

const hasBriefContent = (answers: BriefAnswers): boolean =>
  Boolean(
    (answers.goals && answers.goals.trim().length > 0) ||
      answers.personas.length > 0 ||
      answers.features.length > 0 ||
      answers.integrations.length > 0 ||
      (answers.timeline && answers.timeline.trim().length > 0) ||
      (answers.successMetrics && answers.successMetrics.trim().length > 0) ||
      answers.competitors.length > 0 ||
      (answers.risks && answers.risks.trim().length > 0)
  )

type ParsedBudget = { amount: number; currency: string }

const detectCurrencyCode = (value: string, fallback?: string): string => {
  const matchers: Array<{ pattern: RegExp; code: string }> = [
    { pattern: /A\$|AUD/i, code: 'AUD' },
    { pattern: /C\$|CAD/i, code: 'CAD' },
    { pattern: /€|EUR/i, code: 'EUR' },
    { pattern: /£|GBP/i, code: 'GBP' },
    { pattern: /¥|JPY/i, code: 'JPY' },
    { pattern: /₹|INR/i, code: 'INR' },
    { pattern: /₽|RUB/i, code: 'RUB' },
    { pattern: /₩|KRW/i, code: 'KRW' },
    { pattern: /₺|TRY/i, code: 'TRY' },
    { pattern: /₦|NGN/i, code: 'NGN' },
    { pattern: /₱|PHP/i, code: 'PHP' },
    { pattern: /\$|USD/i, code: 'USD' }
  ]

  for (const candidate of matchers) {
    if (candidate.pattern.test(value)) {
      return candidate.code
    }
  }

  const codeMatch = value.match(/\b([A-Z]{3})\b/)
  if (codeMatch) {
    return codeMatch[1]
  }

  return fallback ?? 'EUR'
}

const parseBudgetInput = (value: string, fallbackCurrency?: string): ParsedBudget | null => {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  const numericPortion = trimmed.replace(/[^0-9.,-]/g, '')
  if (!numericPortion) {
    return null
  }

  const lastComma = numericPortion.lastIndexOf(',')
  const lastDot = numericPortion.lastIndexOf('.')

  let normalizedNumber = numericPortion

  if (lastComma !== -1 && lastDot !== -1) {
    if (lastComma > lastDot) {
      normalizedNumber = numericPortion.replace(/\./g, '').replace(',', '.')
    } else {
      normalizedNumber = numericPortion.replace(/,/g, '')
    }
  } else if (lastComma !== -1) {
    normalizedNumber = numericPortion.replace(',', '.')
  }

  const amount = Number(normalizedNumber)
  if (!Number.isFinite(amount) || amount <= 0) {
    return null
  }

  const currency = detectCurrencyCode(trimmed, fallbackCurrency)

  return { amount, currency }
}

const parseNumberInput = (value: string): number | null => {
  const trimmed = value.trim()
  if (!trimmed) return null

  const numericPortion = trimmed.replace(/[^0-9.,-]/g, '')
  if (!numericPortion) {
    return null
  }

  const lastComma = numericPortion.lastIndexOf(',')
  const lastDot = numericPortion.lastIndexOf('.')

  let normalizedNumber = numericPortion

  if (lastComma !== -1 && lastDot !== -1) {
    if (lastComma > lastDot) {
      normalizedNumber = numericPortion.replace(/\./g, '').replace(',', '.')
    } else {
      normalizedNumber = numericPortion.replace(/,/g, '')
    }
  } else if (lastComma !== -1) {
    normalizedNumber = numericPortion.replace(',', '.')
  }

  const amount = Number(normalizedNumber)
  if (!Number.isFinite(amount)) {
    return null
  }

  return amount
}

const normalizeTextArrayInput = (value: string): string[] | null => {
  const tokens = value
    .split(/[\n,]/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0)

  return tokens.length > 0 ? tokens : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeBriefAnswers(value: unknown): BriefAnswers | null {
  if (!isRecord(value)) return null

  const extractString = (input: unknown): string | null => (typeof input === 'string' && input.trim() ? input : null)
  const extractStringArray = (input: unknown): string[] =>
    Array.isArray(input)
      ? input.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : []

  return {
    goals: extractString(value.goals),
    personas: extractStringArray(value.personas),
    features: extractStringArray(value.features),
    integrations: extractStringArray(value.integrations),
    timeline: extractString(value.timeline),
    successMetrics: extractString(value.successMetrics),
    competitors: extractStringArray(value.competitors),
    risks: extractString(value.risks)
  }
}

const statusOptions: ProjectRow['status'][] = [
  'Backlog',
  'Call Arranged',
  'Brief Gathered',
  'UI Stage',
  'DB Stage',
  'Auth Stage',
  'Build',
  'QA',
  'Handover',
  'Closed',
  'Archived'
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

function formatDisplayDate(value: string | null) {
  if (!value) return 'No due date set'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'No due date set'

  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  })
}

function formatBudgetFromInvoice(amount: InvoiceRow['amount'] | null | undefined, currency: InvoiceRow['currency'] | null | undefined) {
  if (amount === null || amount === undefined) {
    return null
  }

  const numericAmount = typeof amount === 'number' ? amount : Number(amount)
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return null
  }

  const normalizedCurrency = currency && currency.trim().length > 0 ? currency.trim().toUpperCase() : 'EUR'

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: normalizedCurrency
    }).format(numericAmount)
  } catch (error) {
    console.error('Failed to format invoice amount as currency', error)
    return `${numericAmount.toFixed(2)} ${normalizedCurrency}`
  }
}

const formatNumericValue = (value: number | null | undefined) => {
  if (value === null || value === undefined) {
    return 'Not set'
  }

  if (!Number.isFinite(value)) {
    return 'Not set'
  }

  try {
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 2
    }).format(value)
  } catch (error) {
    console.error('Failed to format numeric value', error)
    return String(value)
  }
}

const formatFileSize = (bytes: number | null) => {
  if (bytes === null || bytes === undefined) return 'Unknown size'
  if (bytes === 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const size = bytes / Math.pow(1024, exponent)
  return `${size.toFixed(size < 10 ? 1 : 0)} ${units[exponent]}`
}

const formatTimestamp = (value: string | null) => {
  if (!value) return 'Unknown'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown'

  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
}

function formatDateInput(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return date.toISOString().slice(0, 10)
}

const normalizeDateColumnInput = (value: string): string | null => {
  if (!value.trim()) return null

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed.toISOString().slice(0, 10)
}

interface ProjectOverviewPageProps {
  params: {
    projectId: string
  }
}

export default function ProjectOverviewPage({ params }: ProjectOverviewPageProps) {
  const [project, setProject] = useState<Project | null>(null)
  const [formState, setFormState] = useState<EditableProject | null>(null)
  const [clients, setClients] = useState<Array<Pick<ClientRow, 'id' | 'name'>>>([])
  const [assignees, setAssignees] = useState<Array<Pick<ProfileRow, 'id' | 'full_name'>>>([])
  const [loadingProject, setLoadingProject] = useState(true)
  const [loadingOptions, setLoadingOptions] = useState(true)
  const [briefFormState, setBriefFormState] = useState<BriefFormState>(() => createEmptyBriefFormState())
  const [error, setError] = useState<string | null>(null)
  const [invoiceDetails, setInvoiceDetails] = useState<InvoiceInfo | null>(null)
  const [saving, setSaving] = useState(false)
  const [storedBriefAnswers, setStoredBriefAnswers] = useState<BriefAnswers | null>(null)
  const [invoices, setInvoices] = useState<InvoiceInfo[]>([])
  const [activeInvoice, setActiveInvoice] = useState<InvoiceInfo | null>(null)
  const [invoiceEditor, setInvoiceEditor] = useState<InvoiceEditorState | null>(null)
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false)
  const [savingInvoice, setSavingInvoice] = useState(false)
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<string | null>(null)
  const [comments, setComments] = useState<ProjectComment[]>([])
  const [commentBody, setCommentBody] = useState('')
  const [commentVisibility, setCommentVisibility] = useState<Database['public']['Enums']['visibility_enum']>('both')
  const [commentFilter, setCommentFilter] = useState<'both' | 'client' | 'internal'>('both')
  const [loadingComments, setLoadingComments] = useState(true)
  const [files, setFiles] = useState<ProjectFileObject[]>([])
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [activeTab, setActiveTab] = useState<TabKey>('overview')
  const [currentProfile, setCurrentProfile] = useState<Pick<ProfileRow, 'id' | 'full_name' | 'role'> | null>(null)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [submittingComment, setSubmittingComment] = useState(false)

  const { pushToast } = useToast()

  const supabase = useMemo(createBrowserClient, [])
  const { profile: activeProfile, account, loading: profileLoading } = useActiveProfile()
  const accountId = account?.id ?? null
  const isMountedRef = useRef(true)

  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const fetchProjectData = useCallback(async () => {
    if (profileLoading || !accountId) {
      return
    }

    setLoadingProject(true)
    setLoadingOptions(true)
    setError(null)

    try {
      const projectQuery = supabase
        .from(PROJECTS)
        .select(
          `
            id,
            name,
            status,
            description,
            due_date,
            created_at,
            updated_at,
            archived,
            labels,
            tags,
            priority,
            client_id,
            account_id,
            assignee_profile_id,
            value_invoiced,
            value_paid,
            value_quote,
            clients:client_id ( id, name ),
            assignee_profile:assignee_profile_id ( id, full_name )
          `
        )
        .eq('id', params.projectId)
        .eq('account_id', accountId)

      const projectPromise = projectQuery.maybeSingle()

      const clientsPromise = supabase
        .from(CLIENTS)
        .select('id, name')
        .eq('account_id', accountId)
        .order('name', { ascending: true })
      const assigneesPromise = supabase
        .from('account_members')
        .select('profile:profile_id ( id, full_name )')
        .eq('account_id', accountId)
      const invoicesPromise = supabase
        .from(INVOICES)
        .select(
          'id, amount, currency, status, issued_at, due_at, external_url, paid_at, created_at, updated_at'
        )
        .eq('project_id', params.projectId)
        .order('created_at', { ascending: false })
      const briefPromise = supabase.from(BRIEFS).select('answers').eq('project_id', params.projectId).maybeSingle()

      const [projectResult, clientsResult, assigneesResult, invoicesResult, briefResult] = await Promise.all([
        projectPromise,
        clientsPromise,
        assigneesPromise,
        invoicesPromise,
        briefPromise
      ])

      if (!isMountedRef.current) {
        return
      }

      const { data: clientsData, error: clientsError } = clientsResult
      if (clientsError) {
        console.error('Failed to load clients', clientsError)
      }
      setClients((clientsData ?? []) as Array<Pick<ClientRow, 'id' | 'name'>>)

      const { data: assigneesData, error: assigneesError } = assigneesResult
      if (assigneesError) {
        console.error('Failed to load workspace members', assigneesError)
      }
      const resolvedAssignees = (assigneesData ?? [])
        .map((row) => (row as { profile: Pick<ProfileRow, 'id' | 'full_name'> | null }).profile)
        .filter((profile): profile is Pick<ProfileRow, 'id' | 'full_name'> => !!profile)
        .sort((a, b) => (a.full_name ?? '').localeCompare(b.full_name ?? ''))
      setAssignees(resolvedAssignees)

      const { data: invoicesData, error: invoicesError } = invoicesResult
      if (invoicesError) {
        console.error('Failed to load invoices', invoicesError)
      }
      const typedInvoices = (invoicesData ?? []) as InvoiceInfo[]
      setInvoices(typedInvoices)
      const invoiceRecord = typedInvoices.length > 0 ? typedInvoices[0] : null
      setInvoiceDetails(invoiceRecord ?? null)

      const { data: projectData, error: projectError } = projectResult

      if (projectError) {
        console.error('Failed to load project', projectError)
        setProject(null)
        setFormState(null)
        setStoredBriefAnswers(null)
        setBriefFormState(createEmptyBriefFormState())
        setError('We could not load this project. Please try again.')
        return
      }

      if (!projectData) {
        setProject(null)
        setFormState(null)
        setStoredBriefAnswers(null)
        setBriefFormState(createEmptyBriefFormState())
        setError('We could not find this project.')
        return
      }

      type ProjectQuery = ProjectRow & {
        clients: Pick<ClientRow, 'id' | 'name'> | null
        assignee_profile: Pick<ProfileRow, 'id' | 'full_name'> | null
      }

      const { clients: projectClient, assignee_profile: projectAssignee, ...projectRest } = projectData as ProjectQuery

      const formattedBudget = invoiceRecord
        ? formatBudgetFromInvoice(invoiceRecord.amount, invoiceRecord.currency)
        : null

      const normalizedProject: Project = {
        ...projectRest,
        client: projectClient ?? null,
        assignee: projectAssignee ?? null,
        budget: formattedBudget
      }

      setProject(normalizedProject)
      setFormState({
        name: normalizedProject.name ?? '',
        description: normalizedProject.description ?? '',
        status: normalizedProject.status ?? '',
        dueDate: formatDateInput(normalizedProject.due_date),
        clientId: normalizedProject.client?.id ?? normalizedProject.client_id ?? '',
        assigneeId: normalizedProject.assignee?.id ?? normalizedProject.assignee_profile_id ?? '',
        budget: formattedBudget ?? '',
        valueQuote:
          normalizedProject.value_quote !== null && normalizedProject.value_quote !== undefined
            ? String(normalizedProject.value_quote)
            : '',
        valueInvoiced:
          normalizedProject.value_invoiced !== null && normalizedProject.value_invoiced !== undefined
            ? String(normalizedProject.value_invoiced)
            : '',
        valuePaid:
          normalizedProject.value_paid !== null && normalizedProject.value_paid !== undefined
            ? String(normalizedProject.value_paid)
            : '',
        labels: normalizedProject.labels ? normalizedProject.labels.join('\n') : '',
        tags: normalizedProject.tags ? normalizedProject.tags.join('\n') : ''
      })

      const { data: briefData, error: briefError } = briefResult
      if (briefError) {
        console.error('Failed to load brief answers', briefError)
      }

      const normalizedBriefAnswers = normalizeBriefAnswers(briefData?.answers ?? null)
      if (normalizedBriefAnswers) {
        setStoredBriefAnswers(normalizedBriefAnswers)
        setBriefFormState(mapBriefAnswersToFormState(normalizedBriefAnswers))
      } else {
        setStoredBriefAnswers(null)
        setBriefFormState(createEmptyBriefFormState())
      }
    } catch (cause) {
      console.error('Failed to load project data', cause)
      if (!isMountedRef.current) {
        return
      }
      setProject(null)
      setFormState(null)
      setInvoices([])
      setInvoiceDetails(null)
      setStoredBriefAnswers(null)
      setBriefFormState(createEmptyBriefFormState())
      setError('We ran into an issue loading this project. Please try again.')
    } finally {
      if (!isMountedRef.current) {
        return
      }
      setLoadingOptions(false)
      setLoadingProject(false)
    }
  }, [accountId, params.projectId, profileLoading, supabase])

  const fetchProjectComments = useCallback(async () => {
    if (profileLoading || !accountId) {
      return
    }

    setLoadingComments(true)

    const { data, error } = await supabase
      .from(COMMENTS)
      .select(
        `
          id,
          body,
          created_at,
          visibility,
          author_profile:author_profile_id ( id, full_name, role )
        `
      )
      .eq('project_id', params.projectId)
      .order('created_at', { ascending: false })

    if (!isMountedRef.current) {
      return
    }

    if (error) {
      console.error('Failed to load project comments', error)
      setComments([])
      setLoadingComments(false)
      return
    }

    type CommentQuery = Database['public']['Tables']['comments']['Row'] & {
      author_profile: Pick<ProfileRow, 'id' | 'full_name' | 'role'> | null
    }

    const typedComments = (data ?? []).map((comment) => {
      const { author_profile, ...rest } = comment as CommentQuery
      return {
        ...rest,
        author: author_profile ?? null
      }
    })

    setComments(typedComments)
    setLoadingComments(false)
  }, [accountId, params.projectId, profileLoading, supabase])

  const fetchProjectFiles = useCallback(async () => {
    if (profileLoading || !accountId) {
      return
    }

    setLoadingFiles(true)

    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .list(params.projectId, {
        limit: 100,
        sortBy: { column: 'updated_at', order: 'desc' }
      })

    if (!isMountedRef.current) {
      return
    }

    if (error) {
      console.error('Failed to load project files', error)
      pushToast({
        title: 'Unable to load files',
        description: 'We could not load the project files just now. Please try again.',
        variant: 'error'
      })
      setFiles([])
      setLoadingFiles(false)
      return
    }

    const typedFiles = (data ?? []).map((fileObject) => {
      const metadata = (fileObject.metadata ?? {}) as { size?: number | string }
      let normalizedSize: number | null = null
      if (typeof metadata.size === 'number') {
        normalizedSize = metadata.size
      } else if (typeof metadata.size === 'string') {
        const parsed = Number.parseInt(metadata.size, 10)
        normalizedSize = Number.isNaN(parsed) ? null : parsed
      }

      return {
        path: `${params.projectId}/${fileObject.name}`,
        name: fileObject.name,
        id: fileObject.id ?? null,
        created_at: fileObject.created_at ?? null,
        updated_at: fileObject.updated_at ?? null,
        last_accessed_at: fileObject.last_accessed_at ?? null,
        size: normalizedSize
      }
    })

    setFiles(typedFiles)
    setLoadingFiles(false)
  }, [accountId, params.projectId, profileLoading, pushToast, supabase])

  useEffect(() => {
    void fetchProjectData()
  }, [fetchProjectData])

  useEffect(() => {
    void fetchProjectComments()
  }, [fetchProjectComments])

  useEffect(() => {
    void fetchProjectFiles()
  }, [fetchProjectFiles])

  useEffect(() => {
    let isCancelled = false

    const loadProfile = async () => {
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) {
          console.error('Failed to fetch session', sessionError)
        }

        const userId = sessionData?.session?.user?.id ?? null

        if (!userId) {
          if (!isCancelled && isMountedRef.current) {
            setCurrentProfile(null)
            setLoadingProfile(false)
          }
          return
        }

        const { data: profileData, error: profileError } = await supabase
          .from(PROFILES)
          .select('id, full_name, role')
          .eq('id', userId)
          .maybeSingle()

        if (!isMountedRef.current || isCancelled) {
          return
        }

        if (profileError) {
          console.error('Failed to load profile', profileError)
          setCurrentProfile(null)
        } else {
          setCurrentProfile((profileData ?? null) as Pick<ProfileRow, 'id' | 'full_name' | 'role'> | null)
        }
      } catch (cause) {
        console.error('Unexpected error loading profile', cause)
        if (!isCancelled && isMountedRef.current) {
          setCurrentProfile(null)
        }
      } finally {
        if (!isCancelled && isMountedRef.current) {
          setLoadingProfile(false)
        }
      }
    }

    void loadProfile()

    return () => {
      isCancelled = true
    }
  }, [supabase])

  useEffect(() => {
    if (currentProfile?.role !== 'owner' && commentVisibility === 'internal') {
      setCommentVisibility('both')
    }
  }, [commentVisibility, currentProfile])

  const handleFieldChange = <Key extends keyof EditableProject>(field: Key, value: EditableProject[Key]) => {
    setFormState((previous) => {
      if (!previous) return previous
      return {
        ...previous,
        [field]: value
      }
    })
  }

  const handleBriefFieldChange = <Key extends keyof BriefFormState>(field: Key, value: BriefFormState[Key]) => {
    setBriefFormState((previous) => ({
      ...previous,
      [field]: value
    }))
  }

  const handleSaveChanges = async () => {
    if (!formState) {
      return
    }

    const trimmedName = formState.name.trim()
    const trimmedDescription = formState.description.trim()
    const selectedStatus = formState.status
    const selectedClientId = formState.clientId.trim()

    if (!trimmedName || !trimmedDescription || !selectedStatus || !selectedClientId) {
      pushToast({
        title: 'Check required fields',
        description: 'Project name, client, status, and description must be provided.',
        variant: 'error'
      })
      return
    }

    const trimmedBudgetInput = formState.budget.trim()
    const parsedBudget =
      trimmedBudgetInput.length > 0 ? parseBudgetInput(trimmedBudgetInput, invoiceDetails?.currency) : null

    if (trimmedBudgetInput.length > 0 && !parsedBudget) {
      pushToast({
        title: 'Invalid budget amount',
        description: 'Enter a numeric amount such as €25,000 or 25000 USD.',
        variant: 'error'
      })
      return
    }

    const trimmedQuoteInput = formState.valueQuote.trim()
    const parsedValueQuote =
      trimmedQuoteInput.length > 0 ? parseNumberInput(trimmedQuoteInput) : null
    if (trimmedQuoteInput.length > 0 && parsedValueQuote === null) {
      pushToast({
        title: 'Invalid quote value',
        description: 'Use numbers only for the quoted amount (for example 25000).',
        variant: 'error'
      })
      return
    }

    const trimmedInvoicedInput = formState.valueInvoiced.trim()
    const parsedValueInvoiced =
      trimmedInvoicedInput.length > 0 ? parseNumberInput(trimmedInvoicedInput) : null
    if (trimmedInvoicedInput.length > 0 && parsedValueInvoiced === null) {
      pushToast({
        title: 'Invalid invoiced value',
        description: 'Use numbers only for the invoiced amount (for example 12500).',
        variant: 'error'
      })
      return
    }

    const trimmedPaidInput = formState.valuePaid.trim()
    const parsedValuePaid = trimmedPaidInput.length > 0 ? parseNumberInput(trimmedPaidInput) : null
    if (trimmedPaidInput.length > 0 && parsedValuePaid === null) {
      pushToast({
        title: 'Invalid paid value',
        description: 'Use numbers only for the paid amount (for example 5000).',
        variant: 'error'
      })
      return
    }

    const normalizedLabels = normalizeTextArrayInput(formState.labels)
    const normalizedTagsRaw = normalizeTextArrayInput(formState.tags)
    const normalizedTags = normalizedTagsRaw ? normalizedTagsRaw.map((tag) => tag.replace(/^#/, '')) : null

    try {
      setSaving(true)
      setError(null)

      const assigneeValue = formState.assigneeId.trim() ? formState.assigneeId : null

      const normalizedDueDate = normalizeDateColumnInput(formState.dueDate)
      const normalizedBriefAnswers = mapBriefFormStateToAnswers(briefFormState)

      await new Promise((resolve) => {
        setTimeout(resolve, 300)
      })

      const projectPatch: ProjectUpdate = {
        name: trimmedName,
        description: trimmedDescription,
        status: selectedStatus as ProjectStatus,
        client_id: selectedClientId,
        assignee_profile_id: assigneeValue,
        due_date: normalizedDueDate,
        value_quote: parsedValueQuote,
        value_invoiced: parsedValueInvoiced,
        value_paid: parsedValuePaid,
        labels: normalizedLabels,
        tags: normalizedTags
      }

      const { error: projectUpdateError } = await supabase
        .from(PROJECTS)
        .update(projectPatch)
        .eq('id', params.projectId)

      if (projectUpdateError) {
        console.error('Failed to update project in Supabase', projectUpdateError)
        throw new Error(projectUpdateError.message)
      }

      let nextInvoiceDetails: InvoiceInfo | null = invoiceDetails

      if (parsedBudget) {
        if (invoiceDetails?.id) {
          const invoiceUpdate: InvoiceUpdate = {
            amount: parsedBudget.amount,
            currency: parsedBudget.currency
          }

          const { data: updatedInvoice, error: invoiceUpdateError } = await supabase
            .from(INVOICES)
            .update(invoiceUpdate)
            .eq('id', invoiceDetails.id)
            .select('id, amount, currency, status, issued_at, due_at, external_url, paid_at, created_at, updated_at')
            .maybeSingle()

          if (invoiceUpdateError) {
            console.error('Failed to update invoice in Supabase', invoiceUpdateError)
            throw new Error(invoiceUpdateError.message)
          }

          nextInvoiceDetails = updatedInvoice ?? {
            id: invoiceDetails.id,
            amount: parsedBudget.amount,
            currency: parsedBudget.currency,
            status: invoiceDetails.status,
            issued_at: invoiceDetails.issued_at,
            due_at: invoiceDetails.due_at,
            external_url: invoiceDetails.external_url,
            paid_at: invoiceDetails.paid_at,
            created_at: invoiceDetails.created_at,
            updated_at: invoiceDetails.updated_at
          }
        } else {
          const invoiceInsert: InvoiceInsert = {
            project_id: params.projectId,
            amount: parsedBudget.amount,
            currency: parsedBudget.currency
          }

          const { data: createdInvoice, error: invoiceInsertError } = await supabase
            .from(INVOICES)
            .insert(invoiceInsert)
            .select('id, amount, currency, status, issued_at, due_at, external_url, paid_at, created_at, updated_at')
            .single()

          if (invoiceInsertError) {
            console.error('Failed to create invoice in Supabase', invoiceInsertError)
            throw new Error(invoiceInsertError.message)
          }

          nextInvoiceDetails = createdInvoice
        }
      } else if (invoiceDetails?.id) {
        const { error: invoiceDeleteError } = await supabase.from(INVOICES).delete().eq('id', invoiceDetails.id)

        if (invoiceDeleteError) {
          console.error('Failed to delete invoice in Supabase', invoiceDeleteError)
          throw new Error(invoiceDeleteError.message)
        }

        nextInvoiceDetails = null
      }

      if (normalizedBriefAnswers) {
        const { error: briefUpsertError } = await supabase
          .from(BRIEFS)
          .upsert({ project_id: params.projectId, answers: normalizedBriefAnswers })

        if (briefUpsertError) {
          console.error('Failed to store brief answers', briefUpsertError)
          throw new Error(briefUpsertError.message)
        }
      } else {
        const { error: briefDeleteError } = await supabase
          .from(BRIEFS)
          .delete()
          .eq('project_id', params.projectId)

        if (briefDeleteError) {
          console.error('Failed to clear brief answers', briefDeleteError)
          throw new Error(briefDeleteError.message)
        }
      }

      const updatedClient = clients.find((client) => client.id === selectedClientId) ?? null
      const updatedAssignee = assigneeValue
        ? assignees.find((assignee) => assignee.id === assigneeValue) ?? null
        : null
      const formattedBudget = nextInvoiceDetails
        ? formatBudgetFromInvoice(nextInvoiceDetails.amount, nextInvoiceDetails.currency)
        : null

      setInvoiceDetails(nextInvoiceDetails)
      setInvoices((previous) => {
        if (!nextInvoiceDetails) {
          return previous.filter((invoice) => invoice.id !== (invoiceDetails?.id ?? ''))
        }

        const nextInvoices = [...previous]
        const existingIndex = nextInvoices.findIndex((invoice) => invoice.id === nextInvoiceDetails?.id)
        if (existingIndex === -1) {
          nextInvoices.unshift(nextInvoiceDetails)
        } else {
          nextInvoices[existingIndex] = nextInvoiceDetails
        }
        return nextInvoices
      })

      setProject((previous) => {
        const reference = previous ?? project
        if (!reference) return previous
        return {
          ...reference,
          name: trimmedName,
          description: trimmedDescription,
          status: selectedStatus as ProjectStatus,
          due_date: normalizedDueDate,
          client_id: selectedClientId,
          assignee_profile_id: assigneeValue,
          client: updatedClient,
          assignee: updatedAssignee,
          budget: formattedBudget,
          value_quote: parsedValueQuote,
          value_invoiced: parsedValueInvoiced,
          value_paid: parsedValuePaid,
          labels: normalizedLabels,
          tags: normalizedTags,
          updated_at: new Date().toISOString()
        }
      })

      setFormState((previous) => {
        if (!previous) return previous
        return {
          ...previous,
          name: trimmedName,
          description: trimmedDescription,
          status: selectedStatus as ProjectStatus,
          dueDate: normalizedDueDate ?? '',
          clientId: selectedClientId,
          assigneeId: assigneeValue ?? '',
          budget: formattedBudget ?? '',
          valueQuote: trimmedQuoteInput,
          valueInvoiced: trimmedInvoicedInput,
          valuePaid: trimmedPaidInput,
          labels: previous.labels,
          tags: previous.tags
        }
      })

      setStoredBriefAnswers(normalizedBriefAnswers)
      setBriefFormState(normalizedBriefAnswers ? mapBriefAnswersToFormState(normalizedBriefAnswers) : createEmptyBriefFormState())

      pushToast({
        title: 'Project updated',
        description: `${trimmedName} is now up to date.`,
        variant: 'success'
      })
    } catch (cause) {
      console.error('Failed to save project changes', cause)
      const message =
        cause instanceof Error && cause.message
          ? cause.message
          : 'We could not save your changes. Please try again.'
      setError('We hit an issue saving your changes. Please try again.')
      pushToast({
        title: 'Unable to save project',
        description: message,
        variant: 'error'
      })
    } finally {
      setSaving(false)
    }
  }

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const { files: selectedFiles } = event.target
    if (!selectedFiles || selectedFiles.length === 0) {
      return
    }

    setUploadingFile(true)

    try {
      const uploads = Array.from(selectedFiles).map(async (file) => {
        const filePath = `${params.projectId}/${file.name}`
        const { error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(filePath, file, { upsert: true })

        if (uploadError) {
          throw uploadError
        }
      })

      const results = await Promise.allSettled(uploads)
      const failed = results.filter((result) => result.status === 'rejected')

      if (failed.length > 0) {
        pushToast({
          title: 'Upload incomplete',
          description: 'Some files could not be uploaded. Please try again.',
          variant: 'error'
        })
      } else {
        pushToast({
          title: 'Files uploaded',
          description: `${selectedFiles.length} file${selectedFiles.length === 1 ? '' : 's'} uploaded successfully.`,
          variant: 'success'
        })
      }

      await fetchProjectFiles()
    } catch (cause) {
      console.error('Failed to upload project files', cause)
      pushToast({
        title: 'Upload failed',
        description: 'We could not upload these files. Please try again.',
        variant: 'error'
      })
    } finally {
      setUploadingFile(false)
      event.target.value = ''
    }
  }

  const handleDownloadFile = async (file: ProjectFileObject) => {
    const { data, error } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(file.path, 60)

    if (error || !data?.signedUrl) {
      console.error('Failed to create download URL', error)
      pushToast({
        title: 'Download failed',
        description: 'We could not download this file. Please try again.',
        variant: 'error'
      })
      return
    }

    if (typeof window !== 'undefined') {
      window.open(data.signedUrl, '_blank')
    }
  }

  const handleDeleteFile = async (file: ProjectFileObject) => {
    const { error } = await supabase.storage.from(STORAGE_BUCKET).remove([file.path])

    if (error) {
      console.error('Failed to delete file', error)
      pushToast({
        title: 'Could not delete file',
        description: 'We were unable to remove this file. Please try again.',
        variant: 'error'
      })
      return
    }

    setFiles((previous) => previous.filter((item) => item.path !== file.path))
    pushToast({
      title: 'File deleted',
      description: `${file.name} has been removed.`,
      variant: 'success'
    })
  }

  const openInvoiceModal = (invoice: InvoiceInfo) => {
    setActiveInvoice(invoice)
    setInvoiceEditor({
      stage: normalizeInvoiceStage(invoice.status),
      amount: String(invoice.amount),
      currency: invoice.currency ? invoice.currency.toUpperCase() : '',
      dueDate: formatDateInput(invoice.due_at)
    })
    setInvoiceModalOpen(true)
  }

  const closeInvoiceModal = () => {
    setInvoiceModalOpen(false)
    setActiveInvoice(null)
    setInvoiceEditor(null)
  }

  const handleInvoiceEditorChange = <Key extends keyof InvoiceEditorState>(
    field: Key,
    value: InvoiceEditorState[Key]
  ) => {
    setInvoiceEditor((previous) => {
      if (!previous) return previous
      return {
        ...previous,
        [field]: value
      }
    })
  }

  const handleInvoiceSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!activeInvoice || !invoiceEditor) {
      return
    }

    const trimmedAmount = invoiceEditor.amount.trim()
    const parsedAmount = parseNumberInput(trimmedAmount)

    if (!trimmedAmount || parsedAmount === null || parsedAmount <= 0) {
      pushToast({
        title: 'Invalid invoice amount',
        description: 'Enter a positive amount such as 12500 or 12,500.50.',
        variant: 'error'
      })
      return
    }

    const trimmedCurrency = invoiceEditor.currency.trim().toUpperCase()
    if (!trimmedCurrency || !/^[A-Z]{3}$/.test(trimmedCurrency)) {
      pushToast({
        title: 'Invalid currency',
        description: 'Use a three-letter ISO currency code such as USD or EUR.',
        variant: 'error'
      })
      return
    }

    const trimmedDueDate = invoiceEditor.dueDate.trim()
    const normalizedDueDate =
      trimmedDueDate.length > 0 ? normalizeDateColumnInput(trimmedDueDate) : null

    if (trimmedDueDate.length > 0 && !normalizedDueDate) {
      pushToast({
        title: 'Invalid due date',
        description: 'Choose a valid due date for the invoice or leave the field empty.',
        variant: 'error'
      })
      return
    }

    try {
      setSavingInvoice(true)

      const nextPaidAt =
        invoiceEditor.stage === 'Paid'
          ? activeInvoice.paid_at ?? new Date().toISOString()
          : null

      const invoiceUpdate: InvoiceUpdate = {
        amount: parsedAmount,
        currency: trimmedCurrency,
        status: invoiceEditor.stage,
        due_at: normalizedDueDate,
        paid_at: nextPaidAt
      }

      const { data: updatedInvoice, error: invoiceUpdateError } = await supabase
        .from(INVOICES)
        .update(invoiceUpdate)
        .eq('id', activeInvoice.id)
        .select(
          'id, amount, currency, status, issued_at, due_at, external_url, paid_at, created_at, updated_at'
        )
        .single()

      if (invoiceUpdateError) {
        throw new Error(invoiceUpdateError.message)
      }

      if (!updatedInvoice) {
        throw new Error('Invoice update did not return a record.')
      }

      const formattedBudget = formatBudgetFromInvoice(updatedInvoice.amount, updatedInvoice.currency)

      setInvoices((previous) =>
        previous.map((invoice) => (invoice.id === activeInvoice.id ? updatedInvoice : invoice))
      )
      setInvoiceDetails((previous) =>
        previous?.id === activeInvoice.id ? updatedInvoice : previous
      )

      setProject((previous) => {
        if (!previous) return previous
        return {
          ...previous,
          budget: formattedBudget
        }
      })

      setFormState((previous) => {
        if (!previous) return previous
        return {
          ...previous,
          budget: formattedBudget ?? ''
        }
      })

      closeInvoiceModal()

      pushToast({
        title: 'Invoice updated',
        description: 'The invoice details were saved successfully.',
        variant: 'success'
      })
    } catch (cause) {
      console.error('Failed to update invoice', cause)
      const message =
        cause instanceof Error && cause.message
          ? cause.message
          : 'We could not update this invoice. Please try again.'
      pushToast({
        title: 'Could not update invoice',
        description: message,
        variant: 'error'
      })
    } finally {
      setSavingInvoice(false)
    }
  }

  const handleDownloadInvoice = (invoice: InvoiceInfo) => {
    setDownloadingInvoiceId(invoice.id)

    try {
      if (typeof window === 'undefined') {
        throw new Error('PDF downloads are only available in the browser.')
      }

      const toRgb = (value: number) => (value / 255).toFixed(3)
      const escapePdfText = (value: string) =>
        value.replace(/\\/g, '\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
      const addText = (
        value: string,
        x: number,
        y: number,
        fontSize: number,
        color: [number, number, number]
      ) => {
        streamCommands.push('BT')
        streamCommands.push(`/F1 ${fontSize} Tf`)
        streamCommands.push(`${toRgb(color[0])} ${toRgb(color[1])} ${toRgb(color[2])} rg`)
        streamCommands.push(`${x} ${y} Td`)
        streamCommands.push(`(${escapePdfText(value)}) Tj`)
        streamCommands.push('ET')
      }

      const currencyCode = (invoice.currency ?? 'USD').toUpperCase()
      const formatCurrencyValue = (value: number) => {
        try {
          return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currencyCode,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          }).format(value)
        } catch (error) {
          console.error('Failed to format currency for invoice PDF', error)
          return `${value.toFixed(2)} ${currencyCode}`
        }
      }

      const invoiceNumber = invoice.id.slice(0, 8).toUpperCase()
      const todayLabel = new Intl.DateTimeFormat('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      }).format(new Date())
      const dueDateLabel = invoice.due_at
        ? new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          }).format(new Date(invoice.due_at))
        : 'Upon receipt'
      const issuedDateLabel = invoice.issued_at
        ? new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          }).format(new Date(invoice.issued_at))
        : todayLabel
      const invoiceStageLabel = normalizeInvoiceStage(invoice.status)

      const billedTo = {
        label: 'Billed to',
        lines: ['Studio Showdwe', '123 Anywhere St., Any City', 'hello@reallygreatsite.com']
      }
      const billedFrom = {
        label: 'From',
        lines: ['Twinmind HQ', '55 Innovation Way, Metropolis', 'billing@twinmind.app']
      }

      const projectName = project?.name ?? 'Untitled project'
      const quantity = 1
      const amountFormatted = formatCurrencyValue(invoice.amount)
      const totalFormatted = formatCurrencyValue(invoice.amount * quantity)

      const streamCommands: string[] = []
      const brandGreen: [number, number, number] = [143, 198, 63]
      const brandDark: [number, number, number] = [15, 23, 42]
      const brandMid: [number, number, number] = [30, 41, 59]
      const brandSlate: [number, number, number] = [71, 85, 105]
      const brandSilver: [number, number, number] = [156, 163, 175]
      const accentMint: [number, number, number] = [94, 234, 212]
      const softSky: [number, number, number] = [244, 247, 252]

      const addRightAlignedText = (
        value: string,
        rightX: number,
        y: number,
        fontSize: number,
        color: [number, number, number]
      ) => {
        const approximateWidth = value.length * (fontSize * 0.52)
        const originX = rightX - approximateWidth
        addText(value, originX, y, fontSize, color)
      }

      const addMultilineBlock = (
        heading: string,
        lines: string[],
        x: number,
        y: number,
        lineHeight: number,
        headingColor: [number, number, number],
        bodyColor: [number, number, number]
      ) => {
        addText(heading, x, y, 12, headingColor)
        for (let index = 0; index < lines.length; index += 1) {
          addText(lines[index], x, y - lineHeight * (index + 1), 12, bodyColor)
        }
      }

      streamCommands.push('q')
      streamCommands.push('1 1 1 rg')
      streamCommands.push('0 0 612 792 re f')
      streamCommands.push('Q')

      streamCommands.push('q')
      streamCommands.push(`${toRgb(brandDark[0])} ${toRgb(brandDark[1])} ${toRgb(brandDark[2])} rg`)
      streamCommands.push('0 660 612 132 re f')
      streamCommands.push('Q')

      streamCommands.push('q')
      streamCommands.push(`${toRgb(brandGreen[0])} ${toRgb(brandGreen[1])} ${toRgb(brandGreen[2])} rg`)
      streamCommands.push('0 660 m')
      streamCommands.push('260 660 l')
      streamCommands.push('360 792 l')
      streamCommands.push('0 792 l')
      streamCommands.push('h f')
      streamCommands.push('Q')

      streamCommands.push('q')
      streamCommands.push(`${toRgb(accentMint[0])} ${toRgb(accentMint[1])} ${toRgb(accentMint[2])} rg`)
      streamCommands.push('340 660 m')
      streamCommands.push('612 660 l')
      streamCommands.push('612 792 l')
      streamCommands.push('420 792 l')
      streamCommands.push('h f')
      streamCommands.push('Q')

      const logoCardLeft = 72
      const logoCardBottom = 716
      const logoCardWidth = 250
      const logoCardHeight = 52

      streamCommands.push('q')
      streamCommands.push(`${toRgb(255)} ${toRgb(255)} ${toRgb(255)} rg`)
      streamCommands.push(`${logoCardLeft} ${logoCardBottom} ${logoCardWidth} ${logoCardHeight} re f`)
      streamCommands.push('Q')

      streamCommands.push('q')
      streamCommands.push('1.5 w')
      streamCommands.push(`${toRgb(brandGreen[0])} ${toRgb(brandGreen[1])} ${toRgb(brandGreen[2])} RG`)
      streamCommands.push(`${logoCardLeft} ${logoCardBottom} ${logoCardWidth} ${logoCardHeight} re S`)
      streamCommands.push('Q')

      addText('Twin', logoCardLeft + 14, logoCardBottom + 20, 22, brandGreen)
      addText('Minds', logoCardLeft + 88, logoCardBottom + 20, 22, [18, 24, 32])
      addText('Studio', logoCardLeft + 172, logoCardBottom + 20, 22, [107, 114, 128])

      addText('INVOICE', 420, 732, 30, [18, 24, 32])

      streamCommands.push('q')
      streamCommands.push('2 w')
      streamCommands.push(`${toRgb(brandGreen[0])} ${toRgb(brandGreen[1])} ${toRgb(brandGreen[2])} RG`)
      streamCommands.push('420 720 m 540 720 l S')
      streamCommands.push('Q')

      addText(`No. ${invoiceNumber}`, 420, 702, 12, [36, 42, 55])
      addText(`Issued ${issuedDateLabel}`, 420, 684, 12, [36, 42, 55])
      addText(`Due ${dueDateLabel}`, 420, 666, 12, [36, 42, 55])
      addText(`Status ${invoiceStageLabel}`, 420, 648, 12, [36, 42, 55])

      const headingY = 640
      addText('Project summary', logoCardLeft, headingY, 14, [76, 87, 110])
      addText(`Prepared ${todayLabel}`, logoCardLeft, headingY - 18, 11, [107, 114, 128])

      const billingTop = headingY - 32
      const billingCardHeight = 110
      const billingCardWidth = 228

      streamCommands.push('q')
      streamCommands.push(`${toRgb(softSky[0])} ${toRgb(softSky[1])} ${toRgb(softSky[2])} rg`)
      streamCommands.push(`${logoCardLeft} ${billingTop - billingCardHeight + 18} ${billingCardWidth} ${billingCardHeight} re f`)
      streamCommands.push('Q')

      streamCommands.push('q')
      streamCommands.push(`${toRgb(228)} ${toRgb(235)} ${toRgb(218)} rg`)
      streamCommands.push(`${logoCardLeft + billingCardWidth + 18} ${billingTop - billingCardHeight + 18} ${billingCardWidth} ${billingCardHeight} re f`)
      streamCommands.push('Q')

      addMultilineBlock(
        billedTo.label,
        billedTo.lines,
        logoCardLeft + 14,
        billingTop,
        18,
        [109, 114, 128],
        [18, 24, 32]
      )

      addMultilineBlock(
        billedFrom.label,
        billedFrom.lines,
        logoCardLeft + billingCardWidth + 32,
        billingTop,
        18,
        [109, 114, 128],
        [18, 24, 32]
      )

      const invoiceInfoLeft = logoCardLeft + billingCardWidth * 2 + 50
      const invoiceInfoTop = billingTop

      streamCommands.push('q')
      streamCommands.push(`${toRgb(236)} ${toRgb(245)} ${toRgb(255)} rg`)
      streamCommands.push(`${invoiceInfoLeft - 12} ${billingTop - billingCardHeight + 18} 168 ${billingCardHeight} re f`)
      streamCommands.push('Q')

      addText('Invoice details', invoiceInfoLeft, invoiceInfoTop, 12, [109, 114, 128])
      addText(`Project ${projectName}`, invoiceInfoLeft, invoiceInfoTop - 18, 12, [18, 24, 32])
      addText(`Value ${amountFormatted}`, invoiceInfoLeft, invoiceInfoTop - 36, 12, [18, 24, 32])
      addText(`Quantity ${quantity}`, invoiceInfoLeft, invoiceInfoTop - 54, 12, [18, 24, 32])
      addText('Payment method Bank transfer', invoiceInfoLeft, invoiceInfoTop - 72, 12, [18, 24, 32])

      const tableLeft = 72
      const tableWidth = 468
      const tableHeaderY = 500
      const headerHeight = 28
      const rowHeight = 36

      streamCommands.push('q')
      streamCommands.push(`${toRgb(brandMid[0])} ${toRgb(brandMid[1])} ${toRgb(brandMid[2])} rg`)
      streamCommands.push(`${tableLeft} ${tableHeaderY} ${tableWidth} ${headerHeight} re f`)
      streamCommands.push('Q')

      const tableBottomY = tableHeaderY - rowHeight
      streamCommands.push('q')
      streamCommands.push('1 w')
      streamCommands.push(`${toRgb(brandSlate[0])} ${toRgb(brandSlate[1])} ${toRgb(brandSlate[2])} RG`)
      streamCommands.push(`${tableLeft} ${tableBottomY} ${tableWidth} ${rowHeight + headerHeight} re S`)
      streamCommands.push(`${tableLeft} ${tableHeaderY} m ${tableLeft + tableWidth} ${tableHeaderY} l S`)
      streamCommands.push(`${tableLeft + 260} ${tableBottomY} m ${tableLeft + 260} ${tableHeaderY + headerHeight} l S`)
      streamCommands.push(`${tableLeft + 340} ${tableBottomY} m ${tableLeft + 340} ${tableHeaderY + headerHeight} l S`)
      streamCommands.push(`${tableLeft + 408} ${tableBottomY} m ${tableLeft + 408} ${tableHeaderY + headerHeight} l S`)
      streamCommands.push('Q')

      addText('Item', tableLeft + 16, tableHeaderY + 16, 12, [248, 250, 252])
      addText('Quantity', tableLeft + 272, tableHeaderY + 16, 12, [248, 250, 252])
      addText('Price', tableLeft + 352, tableHeaderY + 16, 12, [248, 250, 252])
      addText('Amount', tableLeft + 420, tableHeaderY + 16, 12, [248, 250, 252])

      streamCommands.push('q')
      streamCommands.push(`${toRgb(247)} ${toRgb(249)} ${toRgb(252)} rg`)
      streamCommands.push(`${tableLeft} ${tableBottomY} ${tableWidth} ${rowHeight} re f`)
      streamCommands.push('Q')

      const rowTextY = tableHeaderY - 12
      addText(projectName, tableLeft + 16, rowTextY, 13, [18, 24, 32])
      addText(String(quantity), tableLeft + 272, rowTextY, 13, [18, 24, 32])
      addText(amountFormatted, tableLeft + 352, rowTextY, 13, [18, 24, 32])
      addText(totalFormatted, tableLeft + 420, rowTextY, 13, [18, 24, 32])

      const summaryBoxHeight = 96
      const summaryBoxY = tableHeaderY - rowHeight - summaryBoxHeight - 20
      streamCommands.push('q')
      streamCommands.push(`${toRgb(brandMid[0])} ${toRgb(brandMid[1])} ${toRgb(brandMid[2])} rg`)
      streamCommands.push(`${tableLeft} ${summaryBoxY} ${tableWidth} ${summaryBoxHeight} re f`)
      streamCommands.push('Q')

      streamCommands.push('q')
      streamCommands.push('2 w')
      streamCommands.push(`${toRgb(brandGreen[0])} ${toRgb(brandGreen[1])} ${toRgb(brandGreen[2])} RG`)
      streamCommands.push(
        `${tableLeft + tableWidth - 140} ${summaryBoxY + 64} m ${tableLeft + tableWidth - 16} ${summaryBoxY + 64} l S`
      )
      streamCommands.push('Q')

      addText('Total due', tableLeft + 16, summaryBoxY + summaryBoxHeight - 18, 12, [226, 232, 240])
      addText(totalFormatted, tableLeft + 16, summaryBoxY + summaryBoxHeight - 42, 24, brandGreen)
      addText('Thank you for trusting TwinMinds Studio with your ideas.', tableLeft + 16, summaryBoxY + 30, 11, brandSilver)
      addRightAlignedText('Payment method', tableLeft + tableWidth - 16, summaryBoxY + summaryBoxHeight - 18, 11, brandSilver)
      addRightAlignedText('Bank transfer', tableLeft + tableWidth - 16, summaryBoxY + summaryBoxHeight - 36, 12, [248, 250, 252])
      addRightAlignedText('IBAN GB80 TWMS 1234 5678 9012 34', tableLeft + tableWidth - 16, summaryBoxY + summaryBoxHeight - 54, 11, brandSilver)
      addRightAlignedText('BIC TWMNGB2LXXX', tableLeft + tableWidth - 16, summaryBoxY + summaryBoxHeight - 70, 11, brandSilver)

      const paymentInfoY = summaryBoxY - 32
      addText('Payment notes', tableLeft, paymentInfoY, 12, [71, 85, 105])
      addText('Please settle the total within 14 days via bank transfer.', tableLeft, paymentInfoY - 18, 11, [107, 114, 128])
      addText('Questions? Reach us at billing@twinmind.app', tableLeft, paymentInfoY - 36, 11, [107, 114, 128])

      const streamContent = `${streamCommands.join('\n')}\n`
      const encoder = new TextEncoder()
      const streamLength = encoder.encode(streamContent).length

      const objects = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
        `<< /Length ${streamLength} >>\nstream\n${streamContent}endstream`,
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
      ]

      const header = '%PDF-1.4\n'
      const pieces = [header]
      const offsets: number[] = [0]
      let lengthSoFar = encoder.encode(header).length

      for (let index = 0; index < objects.length; index += 1) {
        const objectId = index + 1
        const objectString = `${objectId} 0 obj\n${objects[index]}\nendobj\n`
        offsets[objectId] = lengthSoFar
        pieces.push(objectString)
        lengthSoFar += encoder.encode(objectString).length
      }

      const xrefOffset = lengthSoFar
      let xref = `xref\n0 ${objects.length + 1}\n`
      xref += '0000000000 65535 f \n'
      for (let index = 1; index <= objects.length; index += 1) {
        xref += `${offsets[index].toString().padStart(10, '0')} 00000 n \n`
      }
      xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
      pieces.push(xref)

      const pdfBytes = encoder.encode(pieces.join(''))
      const blob = new Blob([pdfBytes], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `invoice-${invoice.id.slice(0, 8)}.pdf`
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      window.setTimeout(() => {
        URL.revokeObjectURL(url)
      }, 5000)

      pushToast({
        title: 'Invoice PDF created',
        description: 'A polished PDF summary has been prepared for your client.',
        variant: 'success'
      })
    } catch (cause) {
      console.error('Failed to prepare invoice PDF', cause)
      const message =
        cause instanceof Error && cause.message
          ? cause.message
          : 'We could not prepare the invoice PDF. Please try again.'
      pushToast({
        title: 'Download failed',
        description: message,
        variant: 'error'
      })
    } finally {
      setDownloadingInvoiceId(null)
    }
  }

  const handleCommentSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!currentProfile) {
      pushToast({
        title: 'Sign in required',
        description: 'Sign in to share comments on this project.',
        variant: 'error'
      })
      return
    }

    const trimmedBody = commentBody.trim()
    if (!trimmedBody) {
      pushToast({
        title: 'Empty comment',
        description: 'Add a message before posting your comment.',
        variant: 'error'
      })
      return
    }

    const visibility = currentProfile.role === 'owner' ? commentVisibility : 'both'

    try {
      setSubmittingComment(true)

      const { data, error } = await supabase
        .from(COMMENTS)
        .insert({
          project_id: params.projectId,
          body: trimmedBody,
          visibility,
          author_profile_id: currentProfile.id
        })
        .select(
          `
            id,
            body,
            created_at,
            visibility,
            author_profile:author_profile_id ( id, full_name, role )
          `
        )
        .single()

      if (error) {
        console.error('Failed to submit comment', error)
        throw new Error(error.message)
      }

      type InsertedComment = Database['public']['Tables']['comments']['Row'] & {
        author_profile: Pick<ProfileRow, 'id' | 'full_name' | 'role'> | null
      }

      const inserted = data as InsertedComment

      setComments((previous) => [
        {
          id: inserted.id,
          body: inserted.body,
          created_at: inserted.created_at,
          visibility: inserted.visibility,
          author: inserted.author_profile ?? {
            id: currentProfile.id,
            full_name: currentProfile.full_name,
            role: currentProfile.role
          }
        },
        ...previous
      ])

      setCommentBody('')
      setCommentVisibility(currentProfile.role === 'owner' ? visibility : 'both')

      pushToast({
        title: 'Comment posted',
        description: 'Your update is visible on the project timeline.',
        variant: 'success'
      })
    } catch (cause) {
      console.error('Failed to submit project comment', cause)
      pushToast({
        title: 'Unable to post comment',
        description: 'We could not post your comment. Please try again.',
        variant: 'error'
      })
    } finally {
      setSubmittingComment(false)
    }
  }

  const canEditBrief = currentProfile?.role === 'owner'
  const canUploadFiles = Boolean(currentProfile)
  const canDeleteFiles = currentProfile?.role === 'owner'
  const canViewInternalComments = currentProfile?.role === 'owner'

  const accessibleComments = useMemo(() => {
    if (canViewInternalComments) {
      return comments
    }
    return comments.filter((comment) => comment.visibility !== 'internal')
  }, [canViewInternalComments, comments])

  const filteredComments = useMemo(() => {
    if (commentFilter === 'client') {
      return accessibleComments.filter(
        (comment) => comment.visibility === 'both' || comment.visibility === 'client'
      )
    }

    if (commentFilter === 'internal') {
      if (!canViewInternalComments) {
        return []
      }

      return comments.filter((comment) => comment.visibility === 'internal')
    }

    return accessibleComments
  }, [accessibleComments, canViewInternalComments, commentFilter, comments])

  const tabs = useMemo(() => {
    const definitions: Array<{ id: TabKey; label: string }> = [
      { id: 'overview', label: 'Overview' },
      { id: 'brief', label: 'Brief' },
      { id: 'files', label: files.length > 0 ? `Files (${files.length})` : 'Files' },
      {
        id: 'comments',
        label:
          accessibleComments.length > 0
            ? `Comments (${accessibleComments.length})`
            : 'Comments'
      },
      { id: 'billing', label: invoices.length > 0 ? `Billing (${invoices.length})` : 'Billing' }
    ]

    return definitions
  }, [accessibleComments.length, files.length, invoices.length])

  const isLoading = loadingProject || loadingProfile

  const readableProjectName = formState?.name.trim()
    ? formState.name
    : project?.name || 'Project overview'
  const readableStatus = formState?.status || project?.status || 'Unknown'
  const dueDateSource = formState?.dueDate && formState.dueDate.trim().length > 0 ? formState.dueDate : project?.due_date
  const readableDueDate = formatDisplayDate(dueDateSource ?? null)
  const readableCountdown = formatRelativeTimeFromNow(dueDateSource ?? null)
  const readableBudget =
    formState?.budget && formState.budget.trim().length > 0
      ? formState.budget
      : project?.budget && project.budget.trim().length > 0
        ? project.budget
        : 'Not set'
  const createdAt = project?.created_at ? new Date(project.created_at) : null
  const readableCreatedAt = createdAt
    ? createdAt.toLocaleString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      })
    : 'Unknown'
  const readableDescription = formState?.description.trim()
    ? formState.description
    : project?.description?.trim()
      ? project.description
      : 'Not provided yet'

  const summaryValueQuote = formatNumericValue(
    project?.value_quote ?? (formState ? parseNumberInput(formState.valueQuote) : null)
  )
  const summaryValueInvoiced = formatNumericValue(
    project?.value_invoiced ?? (formState ? parseNumberInput(formState.valueInvoiced) : null)
  )
  const summaryValuePaid = formatNumericValue(
    project?.value_paid ?? (formState ? parseNumberInput(formState.valuePaid) : null)
  )

  const displayLabels = useMemo(() => {
    if (formState?.labels) {
      const normalized = normalizeTextArrayInput(formState.labels)
      if (normalized) {
        return normalized
      }
    }
    return project?.labels ?? []
  }, [formState?.labels, project?.labels])

  const displayTags = useMemo(() => {
    if (formState?.tags) {
      const normalized = normalizeTextArrayInput(formState.tags)
      if (normalized) {
        return normalized.map((tag) => tag.replace(/^#/, ''))
      }
    }
    return (project?.tags ?? []).map((tag) => tag.replace(/^#/, ''))
  }, [formState?.tags, project?.tags])

  const recentActivity = useMemo(() => {
    const entries: RecentActivityItem[] = []

    if (project?.updated_at) {
      entries.push({
        id: `project-${project.id}`,
        label: 'Project updated',
        description: 'Project details were updated.',
        timestamp: project.updated_at
      })
    }

    for (const comment of comments) {
      const label = comment.visibility === 'internal' ? 'Owner note' : 'Comment added'
      const trimmed = comment.body.length > 140 ? `${comment.body.slice(0, 139)}…` : comment.body
      entries.push({
        id: `comment-${comment.id}`,
        label,
        description: trimmed,
        timestamp: comment.created_at
      })
    }

    for (const file of files) {
      entries.push({
        id: `file-${file.path}`,
        label: 'File uploaded',
        description: file.name,
        timestamp: file.updated_at ?? file.created_at ?? file.last_accessed_at
      })
    }

    for (const invoice of invoices) {
      const formattedAmount =
        formatBudgetFromInvoice(invoice.amount, invoice.currency) ?? formatNumericValue(invoice.amount)
      entries.push({
        id: `invoice-${invoice.id}`,
        label: `Invoice ${invoice.status ?? 'updated'}`,
        description: formattedAmount,
        timestamp: invoice.updated_at ?? invoice.issued_at ?? invoice.created_at
      })
    }

    const sortByTimestamp = (value: RecentActivityItem) => {
      if (!value.timestamp) {
        return Number.NEGATIVE_INFINITY
      }
      const parsed = new Date(value.timestamp).getTime()
      return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed
    }

    return entries
      .sort((a, b) => sortByTimestamp(b) - sortByTimestamp(a))
      .slice(0, 12)
  }, [comments, files, invoices, project])

  const resolvedBriefAnswers = useMemo(() => {
    if (storedBriefAnswers) return storedBriefAnswers
    return mapBriefFormStateToAnswers(briefFormState)
  }, [storedBriefAnswers, briefFormState])

  const hasBriefSummary = resolvedBriefAnswers ? hasBriefContent(resolvedBriefAnswers) : false
  const isInvoiceDialogVisible = Boolean(invoiceModalOpen && activeInvoice && invoiceEditor)

  return (
    <>
      {isInvoiceDialogVisible && activeInvoice && invoiceEditor ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur"
          onClick={closeInvoiceModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="invoice-dialog-title"
            aria-describedby="invoice-dialog-description"
            className="w-full max-w-lg rounded-2xl border border-white/10 bg-base-900/90 p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.3em] text-white/40">Invoice</p>
                <h2 id="invoice-dialog-title" className="text-xl font-semibold text-white">
                  #{activeInvoice.id.slice(0, 8)}
                </h2>
                <p className="text-xs text-white/50">
                  Created {formatTimestamp(activeInvoice.created_at)}
                </p>
              </div>
              <button
                type="button"
                onClick={closeInvoiceModal}
                className="rounded-full border border-white/15 p-2 text-white/60 transition hover:border-white/40 hover:text-white"
              >
                <span className="sr-only">Close</span>
                ×
              </button>
            </div>
            <p id="invoice-dialog-description" className="mt-4 text-sm text-white/60">
              Review invoice details, adjust the billing stage, or export a polished PDF for your client.
            </p>
            <div className="mt-4 grid gap-3 rounded-2xl border border-white/10 bg-base-900/60 p-4 text-sm text-white/60">
              <div className="flex items-center justify-between gap-4">
                <span>Project</span>
                <span className="font-semibold text-white/80">
                  {project?.name ?? 'Untitled project'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Client</span>
                <span className="font-semibold text-white/80">
                  {project?.client?.name ?? 'Unassigned client'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Issued</span>
                <span className="font-semibold text-white/80">
                  {formatTimestamp(activeInvoice.issued_at ?? activeInvoice.created_at)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Link</span>
                <span className="font-semibold text-white/80">
                  {activeInvoice.external_url ? (
                    <a
                      href={activeInvoice.external_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-white transition hover:underline"
                    >
                      Open invoice
                    </a>
                  ) : (
                    '—'
                  )}
                </span>
              </div>
            </div>
            <form className="mt-6 space-y-4" onSubmit={handleInvoiceSubmit}>
              <div className="grid gap-2">
                <label
                  className="text-xs font-semibold uppercase tracking-wide text-white/50"
                  htmlFor="invoice-stage"
                >
                  Stage
                </label>
                <select
                  id="invoice-stage"
                  value={invoiceEditor.stage}
                  onChange={(event) =>
                    handleInvoiceEditorChange('stage', event.target.value as InvoiceStage)
                  }
                  className="rounded-xl border border-white/15 bg-base-900/60 px-3 py-2 text-sm text-white transition focus:border-white/40 focus:outline-none"
                >
                  {INVOICE_STAGE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <label
                  className="text-xs font-semibold uppercase tracking-wide text-white/50"
                  htmlFor="invoice-amount"
                >
                  Amount
                </label>
                <input
                  id="invoice-amount"
                  type="text"
                  inputMode="decimal"
                  value={invoiceEditor.amount}
                  onChange={(event) => handleInvoiceEditorChange('amount', event.target.value)}
                  className="rounded-xl border border-white/15 bg-base-900/60 px-3 py-2 text-sm text-white transition focus:border-white/40 focus:outline-none"
                />
              </div>
              <div className="grid gap-2">
                <label
                  className="text-xs font-semibold uppercase tracking-wide text-white/50"
                  htmlFor="invoice-currency"
                >
                  Currency
                </label>
                <input
                  id="invoice-currency"
                  type="text"
                  maxLength={3}
                  value={invoiceEditor.currency}
                  onChange={(event) =>
                    handleInvoiceEditorChange('currency', event.target.value.toUpperCase())
                  }
                  className="rounded-xl border border-white/15 bg-base-900/60 px-3 py-2 text-sm uppercase text-white transition focus:border-white/40 focus:outline-none"
                />
              </div>
              <div className="grid gap-2">
                <label
                  className="text-xs font-semibold uppercase tracking-wide text-white/50"
                  htmlFor="invoice-due-date"
                >
                  Due date
                </label>
                <input
                  id="invoice-due-date"
                  type="date"
                  value={invoiceEditor.dueDate}
                  onChange={(event) => handleInvoiceEditorChange('dueDate', event.target.value)}
                  className="rounded-xl border border-white/15 bg-base-900/60 px-3 py-2 text-sm text-white transition focus:border-white/40 focus:outline-none"
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
                <button
                  type="button"
                  onClick={() => void handleDownloadInvoice(activeInvoice)}
                  disabled={downloadingInvoiceId === activeInvoice.id}
                  className="rounded-md border border-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:border-white/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {downloadingInvoiceId === activeInvoice.id ? 'Preparing PDF…' : 'Download PDF'}
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={closeInvoiceModal}
                    disabled={savingInvoice}
                    className="rounded-md px-4 py-2 text-sm font-medium text-white/70 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingInvoice}
                    className="rounded-md bg-emerald-500/90 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {savingInvoice ? 'Saving…' : 'Save changes'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-white/5 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-3">
          <Link
            href="/app/projects"
            className="inline-flex items-center text-xs font-semibold uppercase tracking-[0.3em] text-white/40 transition hover:text-white/70"
          >
            ← All projects
          </Link>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-white">{readableProjectName}</h1>
            <p className="text-sm text-white/70">
              Review your project information and keep every detail current for your team and clients.
            </p>
          </div>
        </div>
        <div className="flex flex-col items-start gap-3 sm:items-end">
          {project ? <StatusBadge status={readableStatus} /> : null}
          <button
            type="button"
            onClick={handleSaveChanges}
            disabled={saving || !formState}
            className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold transition btn-gradient disabled:cursor-not-allowed disabled:opacity-60"
            aria-busy={saving}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-full border border-white/10 bg-base-900/40 p-1 text-xs font-semibold text-white/60 sm:text-sm">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap rounded-full px-4 py-2 transition ${
                isActive ? 'bg-white text-base-900 shadow-lg shadow-black/20' : 'hover:text-white'
              }`}
              aria-pressed={isActive}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-100">{error}</div>
      ) : null}

      {isLoading ? (
        <div className="space-y-4">
          <div className="h-40 animate-pulse rounded-2xl border border-white/5 bg-white/5" />
          <div className="h-32 animate-pulse rounded-2xl border border-white/5 bg-white/5" />
        </div>
      ) : project && formState ? (
        <>
          {activeTab === 'overview' ? (
            <div className="grid gap-6 xl:grid-cols-[2fr,1fr]">
              <div className="space-y-6">
                <section className="rounded-2xl border border-white/10 bg-base-900/50 p-6 shadow-lg shadow-base-900/40 backdrop-blur">
                  <header className="mb-6 space-y-1">
                    <p className="text-xs uppercase tracking-[0.3em] text-white/40">Quick edit</p>
                    <h2 className="text-lg font-semibold text-white">Core project details</h2>
                    <p className="text-sm text-white/60">
                      Keep the essentials—client, owner, status, and schedule—aligned for everyone involved.
                    </p>
                  </header>
                  <div className="grid gap-5 md:grid-cols-2">
                    <label className="space-y-2 text-sm text-white/70">
                      <span className="text-xs uppercase tracking-wide text-white/50">Project name</span>
                      <input
                        type="text"
                        value={formState.name}
                        onChange={(event) => handleFieldChange('name', event.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-base-900/60 px-3 py-2 text-sm text-white/90 placeholder:text-white/40 focus:border-white/30 focus:outline-none"
                        placeholder="Project name"
                      />
                    </label>

                    <label className="space-y-2 text-sm text-white/70">
                      <span className="text-xs uppercase tracking-wide text-white/50">Client</span>
                      <select
                        value={formState.clientId}
                        onChange={(event) => handleFieldChange('clientId', event.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-base-900/60 px-3 py-2 text-sm text-white/90 focus:border-white/30 focus:outline-none"
                      >
                        <option value="">
                          {loadingOptions && clients.length === 0 ? 'Loading clients…' : 'Select a client'}
                        </option>
                        {clients.map((clientOption) => (
                          <option key={clientOption.id} value={clientOption.id}>
                            {clientOption.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-2 text-sm text-white/70">
                      <span className="text-xs uppercase tracking-wide text-white/50">Owner</span>
                      <select
                        value={formState.assigneeId}
                        onChange={(event) => handleFieldChange('assigneeId', event.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-base-900/60 px-3 py-2 text-sm text-white/90 focus:border-white/30 focus:outline-none"
                      >
                        <option value="">
                          {loadingOptions && assignees.length === 0 ? 'Loading team…' : 'Unassigned'}
                        </option>
                        {assignees.map((assignee) => (
                          <option key={assignee.id} value={assignee.id}>
                            {assignee.full_name ?? 'Unnamed teammate'}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-2 text-sm text-white/70">
                      <span className="text-xs uppercase tracking-wide text-white/50">Status</span>
                      <select
                        value={formState.status}
                        onChange={(event) => handleFieldChange('status', event.target.value as ProjectStatus)}
                        className="w-full rounded-lg border border-white/10 bg-base-900/60 px-3 py-2 text-sm text-white/90 focus:border-white/30 focus:outline-none"
                      >
                        <option value="">Select a status</option>
                        {statusOptions.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-2 text-sm text-white/70">
                      <span className="text-xs uppercase tracking-wide text-white/50">Due date</span>
                      <input
                        type="date"
                        value={formState.dueDate}
                        onChange={(event) => handleFieldChange('dueDate', event.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-base-900/60 px-3 py-2 text-sm text-white/90 focus:border-white/30 focus:outline-none"
                      />
                    </label>

                    <label className="space-y-2 text-sm text-white/70">
                      <span className="text-xs uppercase tracking-wide text-white/50">Budget</span>
                      <input
                        type="text"
                        value={formState.budget}
                        onChange={(event) => handleFieldChange('budget', event.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-base-900/60 px-3 py-2 text-sm text-white/90 placeholder:text-white/40 focus:border-white/30 focus:outline-none"
                        placeholder="€25,000 or 25000 USD"
                      />
                      <span className="block text-xs text-white/40">Supports currency symbols or plain numbers.</span>
                    </label>
                  </div>
                </section>

                <section className="rounded-2xl border border-white/10 bg-base-900/50 p-6 shadow-lg shadow-base-900/40 backdrop-blur">
                  <header className="mb-4 space-y-1">
                    <p className="text-xs uppercase tracking-[0.3em] text-white/40">Value tracking</p>
                    <h2 className="text-lg font-semibold text-white">Financial snapshot</h2>
                    <p className="text-sm text-white/60">
                      Capture the quoted amount, invoice totals, and what has already been paid.
                    </p>
                  </header>
                  <div className="grid gap-5 sm:grid-cols-3">
                    <label className="space-y-2 text-sm text-white/70">
                      <span className="text-xs uppercase tracking-wide text-white/50">Quoted value</span>
                      <input
                        type="text"
                        value={formState.valueQuote}
                        onChange={(event) => handleFieldChange('valueQuote', event.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-base-900/60 px-3 py-2 text-sm text-white/90 placeholder:text-white/40 focus:border-white/30 focus:outline-none"
                        placeholder="25000"
                      />
                    </label>
                    <label className="space-y-2 text-sm text-white/70">
                      <span className="text-xs uppercase tracking-wide text-white/50">Invoiced value</span>
                      <input
                        type="text"
                        value={formState.valueInvoiced}
                        onChange={(event) => handleFieldChange('valueInvoiced', event.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-base-900/60 px-3 py-2 text-sm text-white/90 placeholder:text-white/40 focus:border-white/30 focus:outline-none"
                        placeholder="18000"
                      />
                    </label>
                    <label className="space-y-2 text-sm text-white/70">
                      <span className="text-xs uppercase tracking-wide text-white/50">Paid to date</span>
                      <input
                        type="text"
                        value={formState.valuePaid}
                        onChange={(event) => handleFieldChange('valuePaid', event.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-base-900/60 px-3 py-2 text-sm text-white/90 placeholder:text-white/40 focus:border-white/30 focus:outline-none"
                        placeholder="12500"
                      />
                    </label>
                  </div>
                  <p className="mt-3 text-xs text-white/40">Enter numbers only; currency can be referenced in labels or notes.</p>
                </section>

                <section className="rounded-2xl border border-white/10 bg-base-900/50 p-6 shadow-lg shadow-base-900/40 backdrop-blur">
                  <header className="mb-3 space-y-1">
                    <p className="text-xs uppercase tracking-[0.3em] text-white/40">Narrative</p>
                    <h2 className="text-lg font-semibold text-white">Project description</h2>
                  </header>
                  <textarea
                    rows={6}
                    value={formState.description}
                    onChange={(event) => handleFieldChange('description', event.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-base-900/60 px-3 py-3 text-sm leading-6 text-white/90 placeholder:text-white/40 focus:border-white/30 focus:outline-none"
                    placeholder="Describe the mission, scope, and any decisions that shape the work."
                  />
                </section>

                <section className="rounded-2xl border border-white/10 bg-base-900/50 p-6 shadow-lg shadow-base-900/40 backdrop-blur">
                  <header className="mb-3 space-y-1">
                    <p className="text-xs uppercase tracking-[0.3em] text-white/40">Organization</p>
                    <h2 className="text-lg font-semibold text-white">Labels & tags</h2>
                  </header>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <label className="space-y-2 text-sm text-white/70">
                      <span className="text-xs uppercase tracking-wide text-white/50">Labels</span>
                      <textarea
                        rows={3}
                        value={formState.labels}
                        onChange={(event) => handleFieldChange('labels', event.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-base-900/60 px-3 py-3 text-sm leading-6 text-white/90 placeholder:text-white/40 focus:border-white/30 focus:outline-none"
                        placeholder="High priority, Design sprint"
                      />
                    </label>
                    <label className="space-y-2 text-sm text-white/70">
                      <span className="text-xs uppercase tracking-wide text-white/50">Tags</span>
                      <textarea
                        rows={3}
                        value={formState.tags}
                        onChange={(event) => handleFieldChange('tags', event.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-base-900/60 px-3 py-3 text-sm leading-6 text-white/90 placeholder:text-white/40 focus:border-white/30 focus:outline-none"
                        placeholder="ai, discovery, phase-one"
                      />
                    </label>
                  </div>
                  <p className="mt-3 text-xs text-white/40">Separate values with commas or line breaks.</p>
                </section>
              </div>

              <aside className="space-y-6">
                <section className="rounded-2xl border border-white/10 bg-base-900/40 p-6 shadow-lg shadow-base-900/30 backdrop-blur">
                  <header className="mb-4 space-y-1">
                    <p className="text-xs uppercase tracking-[0.3em] text-white/40">Summary</p>
                    <h2 className="text-lg font-semibold text-white">Key details</h2>
                  </header>
                  <dl className="space-y-4 text-sm text-white/70">
                    <div className="space-y-1">
                      <dt className="text-white/50">Project name</dt>
                      <dd className="text-white/80">{project?.name ?? 'Untitled project'}</dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-white/50">Client</dt>
                      <dd className="text-right text-white/80">{project.client ? project.client.name : 'Not set'}</dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-white/50">Owner</dt>
                      <dd className="text-right text-white/80">{project.assignee?.full_name ?? 'Unassigned'}</dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-white/50">Due date</dt>
                      <dd className="text-right text-white/80">{readableDueDate}</dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-white/50">Countdown</dt>
                      <dd className="text-right text-white/80">{readableCountdown}</dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-white/50">Budget</dt>
                      <dd className="text-right text-white/80">{readableBudget}</dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-white/50">Quoted</dt>
                      <dd className="text-right text-white/80">{summaryValueQuote}</dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-white/50">Invoiced</dt>
                      <dd className="text-right text-white/80">{summaryValueInvoiced}</dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-white/50">Paid</dt>
                      <dd className="text-right text-white/80">{summaryValuePaid}</dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-white/50">Created</dt>
                      <dd className="text-right text-white/80">{readableCreatedAt}</dd>
                    </div>
                    <div className="space-y-1">
                      <dt className="text-white/50">Labels</dt>
                      <dd>
                        {displayLabels.length > 0 ? (
                          <ul className="flex flex-wrap gap-2 text-xs text-white/80">
                            {displayLabels.map((label) => (
                              <li key={label} className="rounded-full border border-white/10 px-3 py-1">
                                {label}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-white/50">None assigned yet</span>
                        )}
                      </dd>
                    </div>
                    <div className="space-y-1">
                      <dt className="text-white/50">Tags</dt>
                      <dd>
                        {displayTags.length > 0 ? (
                          <ul className="flex flex-wrap gap-2 text-xs text-white/80">
                            {displayTags.map((tag) => (
                              <li key={tag} className="rounded-full border border-white/10 px-3 py-1">
                                #{tag.replace(/^#/, '')}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-white/50">No tags yet</span>
                        )}
                      </dd>
                    </div>
                    <div className="space-y-1">
                      <dt className="text-white/50">Project description</dt>
                      <dd className="whitespace-pre-line text-white/80">{readableDescription}</dd>
                    </div>
                  </dl>
                </section>

                <section className="rounded-2xl border border-white/10 bg-base-900/40 p-6 shadow-lg shadow-base-900/30 backdrop-blur">
                  <header className="mb-4 space-y-1">
                    <p className="text-xs uppercase tracking-[0.3em] text-white/40">Recent activity</p>
                    <h2 className="text-lg font-semibold text-white">What’s happened lately</h2>
                  </header>
                  {recentActivity.length > 0 ? (
                    <ul className="space-y-4">
                      {recentActivity.map((item) => (
                        <li key={item.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                          <div className="flex items-center justify-between text-xs uppercase tracking-wide text-white/50">
                            <span>{item.label}</span>
                            <span className="text-white/40">
                              {item.timestamp ? formatRelativeTimeFromNow(item.timestamp) : 'Unknown'}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-white/70 whitespace-pre-line">{item.description}</p>
                          <p className="mt-1 text-xs text-white/40">{formatTimestamp(item.timestamp)}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-white/60">
                      As you add comments, files, and invoices, the recent history of this project will appear here.
                    </p>
                  )}
                </section>
              </aside>
            </div>
          ) : null}

          {activeTab === 'brief' ? (
            <div className="space-y-6">
              <section className="rounded-2xl border border-white/10 bg-base-900/50 p-6 shadow-lg shadow-base-900/40 backdrop-blur">
                <header className="mb-4 space-y-1">
                  <p className="text-xs uppercase tracking-[0.3em] text-white/40">Discovery</p>
                  <h2 className="text-lg font-semibold text-white">Project brief</h2>
                  <p className="text-sm text-white/60">
                    Capture goals, personas, and the context that keeps everyone aligned.
                  </p>
                </header>
                {!canEditBrief ? (
                  <p className="mb-4 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/60">
                    You can review the brief from here. Only the project owner can make edits.
                  </p>
                ) : null}
                <div className="grid gap-5 md:grid-cols-2">
                  <label className="space-y-2 text-sm text-white/70 md:col-span-2">
                    <span className="text-xs uppercase tracking-wide text-white/50">Goals</span>
                    <textarea
                      rows={4}
                      value={briefFormState.goals}
                      onChange={(event) => handleBriefFieldChange('goals', event.target.value)}
                      disabled={!canEditBrief}
                      className="w-full rounded-xl border border-white/10 bg-base-900/60 px-3 py-3 text-sm leading-6 text-white/90 placeholder:text-white/40 focus:border-white/30 focus:outline-none disabled:opacity-60"
                      placeholder="Outline the primary objectives and the outcomes we are targeting."
                    />
                  </label>
                  <label className="space-y-2 text-sm text-white/70">
                    <span className="text-xs uppercase tracking-wide text-white/50">Personas</span>
                    <textarea
                      rows={4}
                      value={briefFormState.personas}
                      onChange={(event) => handleBriefFieldChange('personas', event.target.value)}
                      disabled={!canEditBrief}
                      className="w-full rounded-xl border border-white/10 bg-base-900/60 px-3 py-3 text-sm leading-6 text-white/90 placeholder:text-white/40 focus:border-white/30 focus:outline-none disabled:opacity-60"
                      placeholder={['Product manager', 'Operations lead', 'Customer support'].join('\n')}
                    />
                    <span className="block text-xs text-white/40">Separate each persona with a new line.</span>
                  </label>
                  <label className="space-y-2 text-sm text-white/70">
                    <span className="text-xs uppercase tracking-wide text-white/50">Key features</span>
                    <textarea
                      rows={4}
                      value={briefFormState.features}
                      onChange={(event) => handleBriefFieldChange('features', event.target.value)}
                      disabled={!canEditBrief}
                      className="w-full rounded-xl border border-white/10 bg-base-900/60 px-3 py-3 text-sm leading-6 text-white/90 placeholder:text-white/40 focus:border-white/30 focus:outline-none disabled:opacity-60"
                      placeholder={['Real-time dashboards', 'Role-based access', 'AI-assisted insights'].join('\n')}
                    />
                    <span className="block text-xs text-white/40">List one feature per line.</span>
                  </label>
                  <label className="space-y-2 text-sm text-white/70">
                    <span className="text-xs uppercase tracking-wide text-white/50">Integrations</span>
                    <textarea
                      rows={3}
                      value={briefFormState.integrations}
                      onChange={(event) => handleBriefFieldChange('integrations', event.target.value)}
                      disabled={!canEditBrief}
                      className="w-full rounded-xl border border-white/10 bg-base-900/60 px-3 py-3 text-sm leading-6 text-white/90 placeholder:text-white/40 focus:border-white/30 focus:outline-none disabled:opacity-60"
                      placeholder={['Salesforce', 'HubSpot', 'Segment'].join('\n')}
                    />
                  </label>
                  <label className="space-y-2 text-sm text-white/70">
                    <span className="text-xs uppercase tracking-wide text-white/50">Timeline</span>
                    <input
                      type="text"
                      value={briefFormState.timeline}
                      onChange={(event) => handleBriefFieldChange('timeline', event.target.value)}
                      disabled={!canEditBrief}
                      className="w-full rounded-lg border border-white/10 bg-base-900/60 px-3 py-2 text-sm text-white/90 placeholder:text-white/40 focus:border-white/30 focus:outline-none disabled:opacity-60"
                      placeholder="Beta launch in Q3 with GA in November."
                    />
                  </label>
                  <label className="space-y-2 text-sm text-white/70">
                    <span className="text-xs uppercase tracking-wide text-white/50">Success metrics</span>
                    <textarea
                      rows={3}
                      value={briefFormState.successMetrics}
                      onChange={(event) => handleBriefFieldChange('successMetrics', event.target.value)}
                      disabled={!canEditBrief}
                      className="w-full rounded-xl border border-white/10 bg-base-900/60 px-3 py-3 text-sm leading-6 text-white/90 placeholder:text-white/40 focus:border-white/30 focus:outline-none disabled:opacity-60"
                      placeholder="Increase activation rate to 45% and reduce handoff time by half."
                    />
                  </label>
                  <label className="space-y-2 text-sm text-white/70">
                    <span className="text-xs uppercase tracking-wide text-white/50">Competitors</span>
                    <textarea
                      rows={3}
                      value={briefFormState.competitors}
                      onChange={(event) => handleBriefFieldChange('competitors', event.target.value)}
                      disabled={!canEditBrief}
                      className="w-full rounded-xl border border-white/10 bg-base-900/60 px-3 py-3 text-sm leading-6 text-white/90 placeholder:text-white/40 focus:border-white/30 focus:outline-none disabled:opacity-60"
                      placeholder={['Acme Analytics', 'Northwind Suite'].join('\n')}
                    />
                    <span className="block text-xs text-white/40">Add one competitor per line.</span>
                  </label>
                  <label className="space-y-2 text-sm text-white/70 md:col-span-2">
                    <span className="text-xs uppercase tracking-wide text-white/50">Risks</span>
                    <textarea
                      rows={4}
                      value={briefFormState.risks}
                      onChange={(event) => handleBriefFieldChange('risks', event.target.value)}
                      disabled={!canEditBrief}
                      className="w-full rounded-xl border border-white/10 bg-base-900/60 px-3 py-3 text-sm leading-6 text-white/90 placeholder:text-white/40 focus:border-white/30 focus:outline-none disabled:opacity-60"
                      placeholder="Identify open questions, dependencies, or blockers we should monitor."
                    />
                  </label>
                </div>
              </section>

              <section className="rounded-2xl border border-white/10 bg-base-900/40 p-6 shadow-lg shadow-base-900/30 backdrop-blur">
                <header className="mb-4 space-y-1">
                  <p className="text-xs uppercase tracking-[0.3em] text-white/40">Brief responses</p>
                  <h2 className="text-lg font-semibold text-white">Discovery summary</h2>
                </header>
                {hasBriefSummary ? (
                  <dl className="space-y-4 text-sm text-white/70">
                    <div className="space-y-1">
                      <dt className="text-white/50">Goals</dt>
                      <dd className="whitespace-pre-line text-white/80">{resolvedBriefAnswers?.goals ?? 'Not provided'}</dd>
                    </div>
                    <div className="space-y-1">
                      <dt className="text-white/50">Personas</dt>
                      <dd className="text-white/80">
                        {resolvedBriefAnswers?.personas && resolvedBriefAnswers.personas.length > 0 ? (
                          <ul className="list-disc space-y-1 pl-5 text-left">
                            {resolvedBriefAnswers.personas.map((persona) => (
                              <li key={persona}>{persona}</li>
                            ))}
                          </ul>
                        ) : (
                          'Not provided'
                        )}
                      </dd>
                    </div>
                    <div className="space-y-1">
                      <dt className="text-white/50">Key features</dt>
                      <dd className="text-white/80">
                        {resolvedBriefAnswers?.features && resolvedBriefAnswers.features.length > 0 ? (
                          <ul className="list-disc space-y-1 pl-5 text-left">
                            {resolvedBriefAnswers.features.map((feature) => (
                              <li key={feature}>{feature}</li>
                            ))}
                          </ul>
                        ) : (
                          'Not provided'
                        )}
                      </dd>
                    </div>
                    <div className="space-y-1">
                      <dt className="text-white/50">Integrations</dt>
                      <dd className="text-white/80">
                        {resolvedBriefAnswers?.integrations && resolvedBriefAnswers.integrations.length > 0 ? (
                          <ul className="list-disc space-y-1 pl-5 text-left">
                            {resolvedBriefAnswers.integrations.map((integration) => (
                              <li key={integration}>{integration}</li>
                            ))}
                          </ul>
                        ) : (
                          'Not provided'
                        )}
                      </dd>
                    </div>
                    <div className="space-y-1">
                      <dt className="text-white/50">Timeline</dt>
                      <dd className="whitespace-pre-line text-white/80">
                        {resolvedBriefAnswers?.timeline ?? 'Not provided'}
                      </dd>
                    </div>
                    <div className="space-y-1">
                      <dt className="text-white/50">Success metrics</dt>
                      <dd className="whitespace-pre-line text-white/80">
                        {resolvedBriefAnswers?.successMetrics ?? 'Not provided'}
                      </dd>
                    </div>
                    <div className="space-y-1">
                      <dt className="text-white/50">Competitors</dt>
                      <dd className="text-white/80">
                        {resolvedBriefAnswers?.competitors && resolvedBriefAnswers.competitors.length > 0 ? (
                          <ul className="list-disc space-y-1 pl-5 text-left">
                            {resolvedBriefAnswers.competitors.map((competitor) => (
                              <li key={competitor}>{competitor}</li>
                            ))}
                          </ul>
                        ) : (
                          'Not provided'
                        )}
                      </dd>
                    </div>
                    <div className="space-y-1">
                      <dt className="text-white/50">Risks</dt>
                      <dd className="whitespace-pre-line text-white/80">
                        {resolvedBriefAnswers?.risks ?? 'Not provided'}
                      </dd>
                    </div>
                  </dl>
                ) : (
                  <p className="text-sm text-white/60">
                    Capture discovery answers in the brief above to surface them here for the team and client.
                  </p>
                )}
              </section>
            </div>
          ) : null}

          {activeTab === 'files' ? (
            <div className="space-y-6">
              <section className="rounded-2xl border border-white/10 bg-base-900/50 p-6 shadow-lg shadow-base-900/40 backdrop-blur">
                <header className="mb-4 space-y-1">
                  <p className="text-xs uppercase tracking-[0.3em] text-white/40">Assets</p>
                  <h2 className="text-lg font-semibold text-white">Upload project files</h2>
                  <p className="text-sm text-white/60">
                    Store contracts, design references, and delivery artifacts in a shared space.
                  </p>
                </header>
                {canUploadFiles ? (
                  <label className="inline-flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/20 bg-base-900/60 px-6 py-10 text-center text-sm font-semibold text-white/70 transition hover:border-white/40 hover:text-white sm:w-auto sm:px-12">
                    <input
                      type="file"
                      multiple
                      onChange={handleFileUpload}
                      className="hidden"
                      disabled={uploadingFile}
                    />
                    <span className="text-lg font-semibold text-white">{uploadingFile ? 'Uploading…' : 'Upload files'}</span>
                    <span className="text-xs text-white/40">Drag and drop or click to select multiple files.</span>
                  </label>
                ) : (
                  <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/60">
                    Sign in as a project collaborator to upload files.
                  </p>
                )}
              </section>

              <section className="rounded-2xl border border-white/10 bg-base-900/40 p-6 shadow-lg shadow-base-900/30 backdrop-blur">
                <header className="mb-4 space-y-1">
                  <p className="text-xs uppercase tracking-[0.3em] text-white/40">Library</p>
                  <h2 className="text-lg font-semibold text-white">Project files</h2>
                </header>
                {loadingFiles ? (
                  <div className="space-y-3">
                    <div className="h-20 animate-pulse rounded-xl border border-white/10 bg-white/5" />
                    <div className="h-20 animate-pulse rounded-xl border border-white/10 bg-white/5" />
                  </div>
                ) : files.length > 0 ? (
                  <ul className="space-y-4">
                    {files.map((file) => (
                      <li
                        key={file.path}
                        className="flex flex-col gap-3 rounded-xl border border-white/10 bg-base-900/50 p-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p className="font-semibold text-white">{file.name}</p>
                          <p className="text-xs text-white/40">
                            {formatFileSize(file.size)} · {formatTimestamp(file.updated_at ?? file.created_at ?? file.last_accessed_at)}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => void handleDownloadFile(file)}
                            className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white transition hover:border-white/40"
                          >
                            Download
                          </button>
                          {canDeleteFiles ? (
                            <button
                              type="button"
                              onClick={() => void handleDeleteFile(file)}
                              className="rounded-full border border-rose-400/40 px-4 py-2 text-xs font-semibold text-rose-200 transition hover:border-rose-300 hover:text-rose-100"
                            >
                              Delete
                            </button>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-white/60">
                    No files uploaded yet. Share specs, architecture docs, and other assets so everyone stays aligned.
                  </p>
                )}
              </section>
            </div>
          ) : null}

          {activeTab === 'comments' ? (
            <div className="space-y-6">
              <section className="rounded-2xl border border-white/10 bg-base-900/50 p-6 shadow-lg shadow-base-900/40 backdrop-blur">
                <header className="mb-4 space-y-1">
                  <p className="text-xs uppercase tracking-[0.3em] text-white/40">Collaboration</p>
                  <h2 className="text-lg font-semibold text-white">Leave a comment</h2>
                </header>
                {currentProfile ? (
                  <form className="space-y-4" onSubmit={handleCommentSubmit}>
                    <textarea
                      rows={4}
                      value={commentBody}
                      onChange={(event) => setCommentBody(event.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-base-900/60 px-3 py-3 text-sm leading-6 text-white/90 placeholder:text-white/40 focus:border-white/30 focus:outline-none"
                      placeholder="Share an update, ask a question, or capture a note for your team."
                    />
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <select
                        value={commentVisibility}
                        onChange={(event) =>
                          setCommentVisibility(event.target.value as Database['public']['Enums']['visibility_enum'])
                        }
                        className="w-full rounded-full border border-white/10 bg-base-900/60 px-4 py-2 text-sm text-white/80 focus:border-white/30 focus:outline-none sm:w-auto"
                      >
                        <option value="both">Visible to agency & client</option>
                        <option value="client">Client-visible</option>
                        <option value="internal" disabled={!canViewInternalComments}>
                          Owner notes only
                        </option>
                      </select>
                      <button
                        type="submit"
                        disabled={submittingComment}
                        className="inline-flex items-center justify-center rounded-full bg-white px-5 py-2 text-sm font-semibold text-base-900 transition hover:bg-white/90 disabled:cursor-not-allowed disabled:bg-white/60"
                      >
                        {submittingComment ? 'Posting…' : 'Post comment'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <p className="text-sm text-white/60">
                    Sign in with your agency or client account to participate in the conversation.
                  </p>
                )}
              </section>

              <section className="rounded-2xl border border-white/10 bg-base-900/40 p-6 shadow-lg shadow-base-900/30 backdrop-blur">
                <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-[0.3em] text-white/40">Timeline</p>
                    <h2 className="text-lg font-semibold text-white">Comments & notes</h2>
                  </div>
                  <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-base-900/60 p-1 text-xs font-semibold text-white/60 sm:text-sm">
                    {(['both', 'client', 'internal'] as const).map((filter) => {
                      const label = filter === 'both' ? 'Both' : filter === 'client' ? 'Client view' : 'Owner notes'
                      const isActiveFilter = commentFilter === filter
                      return (
                        <button
                          key={filter}
                          type="button"
                          onClick={() => setCommentFilter(filter)}
                          className={`whitespace-nowrap rounded-full px-3 py-1 transition ${
                            isActiveFilter ? 'bg-white text-base-900 shadow' : 'hover:text-white'
                          }`}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                </header>
                {loadingComments ? (
                  <div className="space-y-3">
                    <div className="h-20 animate-pulse rounded-xl border border-white/10 bg-white/5" />
                    <div className="h-20 animate-pulse rounded-xl border border-white/10 bg-white/5" />
                  </div>
                ) : filteredComments.length > 0 ? (
                  <ul className="space-y-4">
                    {filteredComments.map((comment) => (
                      <li key={comment.id} className="rounded-xl border border-white/10 bg-base-900/50 p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-white">
                              {comment.author?.full_name ?? 'Unknown teammate'}
                            </p>
                            <p className="text-xs text-white/40">{formatTimestamp(comment.created_at)}</p>
                          </div>
                          <span className="inline-flex items-center rounded-full border border-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/60">
                            {comment.visibility === 'internal'
                              ? 'Owner only'
                              : comment.visibility === 'client'
                                ? 'Client-visible'
                                : 'Visible to all'}
                          </span>
                        </div>
                        <p className="mt-3 whitespace-pre-line text-sm text-white/80">{comment.body}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-white/60">
                    No comments yet. Start the conversation to keep everyone aligned on next steps.
                  </p>
                )}
              </section>
            </div>
          ) : null}

          {activeTab === 'billing' ? (
            <div className="space-y-6">
              <section className="rounded-2xl border border-white/10 bg-base-900/50 p-6 shadow-lg shadow-base-900/40 backdrop-blur">
                <header className="mb-4 space-y-1">
                  <p className="text-xs uppercase tracking-[0.3em] text-white/40">Billing</p>
                  <h2 className="text-lg font-semibold text-white">Invoice history</h2>
                  <p className="text-sm text-white/60">
                    Track quotes, invoices sent, and payments made to keep budgets on track.
                  </p>
                </header>
                {invoices.length > 0 ? (
                  <div className="overflow-hidden rounded-xl border border-white/10">
                    <table className="min-w-full divide-y divide-white/5 text-sm text-white/80">
                      <thead className="bg-base-900/60 text-xs uppercase tracking-wide text-white/40">
                        <tr>
                          <th scope="col" className="px-4 py-3 text-left font-semibold">
                            Invoice
                          </th>
                          <th scope="col" className="px-4 py-3 text-left font-semibold">
                            Status
                          </th>
                          <th scope="col" className="px-4 py-3 text-left font-semibold">
                            Amount
                          </th>
                          <th scope="col" className="px-4 py-3 text-left font-semibold">
                            Issued
                          </th>
                          <th scope="col" className="px-4 py-3 text-left font-semibold">
                            Due
                          </th>
                          <th scope="col" className="px-4 py-3 text-left font-semibold">
                            Paid
                          </th>
                          <th scope="col" className="px-4 py-3 text-left font-semibold">
                            Link
                          </th>
                          <th scope="col" className="px-4 py-3 text-left font-semibold">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {invoices.map((invoice) => {
                          const formattedAmount =
                            formatBudgetFromInvoice(invoice.amount, invoice.currency) ??
                            formatNumericValue(invoice.amount)
                          const isDownloading = downloadingInvoiceId === invoice.id
                          const stageLabel = normalizeInvoiceStage(invoice.status)
                          const stageClasses = INVOICE_STAGE_BADGE_VARIANTS[stageLabel]
                          return (
                            <tr key={invoice.id}>
                              <td className="px-4 py-3 font-mono text-xs text-white/60">#{invoice.id.slice(0, 8)}</td>
                              <td className="px-4 py-3">
                                <span
                                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${stageClasses}`}
                                >
                                  {stageLabel}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-white/80">{formattedAmount}</td>
                              <td className="px-4 py-3 text-white/60">
                                {formatTimestamp(invoice.issued_at ?? invoice.created_at)}
                              </td>
                              <td className="px-4 py-3 text-white/60">{formatTimestamp(invoice.due_at)}</td>
                              <td className="px-4 py-3 text-white/60">
                                {invoice.paid_at ? formatTimestamp(invoice.paid_at) : '—'}
                              </td>
                              <td className="px-4 py-3 text-white/60">
                                {invoice.external_url ? (
                                  <a
                                    href={invoice.external_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-white transition hover:border-white/40 hover:text-white"
                                  >
                                    Open
                                  </a>
                                ) : (
                                  '—'
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => openInvoiceModal(invoice)}
                                    className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-white/80 transition hover:border-white/40 hover:text-white"
                                  >
                                    View
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void handleDownloadInvoice(invoice)}
                                    disabled={isDownloading}
                                    className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-white/80 transition hover:border-white/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    {isDownloading ? 'Preparing…' : 'Download'}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-white/60">
                    No invoices recorded yet. Create a quote or invoice to start tracking billing milestones.
                  </p>
                )}
              </section>
            </div>
          ) : null}
        </>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-base-900/50 p-6 text-sm text-white/70">
          We don&apos;t have any details to show for this project yet.
        </div>
      )}
    </div>
  </>
  )

}

