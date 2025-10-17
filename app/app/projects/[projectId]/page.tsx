'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

import { StatusBadge } from '../../_components/status-badge'
import { useToast } from '../../_components/toast-context'
import type { Database } from '@/types/supabase'
import { createBrowserClient } from '@/lib/supabaseClient'

const PROJECTS_TABLE = 'projects' as const
const BRIEFS_TABLE = 'briefs' as const
const CLIENTS_TABLE = 'clients' as const
const PROFILES_TABLE = 'profiles' as const
const INVOICES_TABLE = 'invoices' as const

type ProjectRow = Database['public']['Tables']['projects']['Row']
type ClientRow = Database['public']['Tables']['clients']['Row']
type ProfileRow = Database['public']['Tables']['profiles']['Row']
type BriefRow = Database['public']['Tables']['briefs']['Row']
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

type InvoiceInfo = Pick<InvoiceRow, 'id' | 'amount' | 'currency'>
type ProjectUpdate = Database['public']['Tables']['projects']['Update']
type InvoiceUpdate = Database['public']['Tables']['invoices']['Update']
type InvoiceInsert = Database['public']['Tables']['invoices']['Insert']

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

const statusOptions: ProjectRow['status'][] = ['Brief Gathered', 'In Progress', 'Completed', 'Archived']

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

  const { pushToast } = useToast()

  const supabase = useMemo(createBrowserClient, [])

  useEffect(() => {
    let isMounted = true

    const fetchData = async () => {
      setLoadingProject(true)
      setLoadingOptions(true)
      setError(null)

      const [projectResponse, clientsResponse, assigneesResponse, briefResponse, invoiceResponse] = await Promise.all([
        supabase
          .from(PROJECTS_TABLE)
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
          .eq('id', params.projectId)
          .maybeSingle(),
        supabase
          .from(CLIENTS_TABLE)
          .select('id, name')
          .order('name', { ascending: true }),
        supabase
          .from(PROFILES_TABLE)
          .select('id, full_name')
          .order('full_name', { ascending: true }),
        supabase
          .from(BRIEFS_TABLE)
          .select('answers')
          .eq('project_id', params.projectId)
          .maybeSingle(),
        supabase
          .from(INVOICES_TABLE)
          .select('id, amount, currency, issued_at, created_at')
          .eq('project_id', params.projectId)
          .order('issued_at', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      ])

      if (!isMounted) return

      setLoadingOptions(false)

      if (briefResponse.error) {
        console.error(briefResponse.error)
        setBriefFormState(createEmptyBriefFormState())
      } else {
        const briefData = briefResponse.data as Pick<BriefRow, 'answers'> | null
        const normalizedBriefAnswers = normalizeBriefAnswers(briefData?.answers ?? null)
        setBriefFormState(mapBriefAnswersToFormState(normalizedBriefAnswers))
      }

      let projectBudget: string | null = null

      if (invoiceResponse.error) {
        console.error(invoiceResponse.error)
        setInvoiceDetails(null)
      } else if (invoiceResponse.data) {
        const invoiceData = invoiceResponse.data as InvoiceInfo
        projectBudget = formatBudgetFromInvoice(invoiceData.amount, invoiceData.currency)
        setInvoiceDetails(invoiceData)
      } else {
        setInvoiceDetails(null)
      }

      if (clientsResponse.error) {
        console.error(clientsResponse.error)
      } else {
        setClients(clientsResponse.data ?? [])
      }

      if (assigneesResponse.error) {
        console.error(assigneesResponse.error)
      } else {
        setAssignees(assigneesResponse.data ?? [])
      }

      setLoadingProject(false)

      if (projectResponse.error) {
        console.error(projectResponse.error)
        setProject(null)
        setFormState(null)
        setBriefFormState(createEmptyBriefFormState())
        setError('We ran into an issue loading this project. Please try again.')
        return
      }

      if (!projectResponse.data) {
        setProject(null)
        setFormState(null)
        setBriefFormState(createEmptyBriefFormState())
        setError('We could not find this project. It may have been removed.')
        return
      }

      type ProjectQuery = ProjectRow & {
        clients: Pick<ClientRow, 'id' | 'name'> | null
        assignee_profile: Pick<ProfileRow, 'id' | 'full_name'> | null
      }

      const typedProject = projectResponse.data as ProjectQuery
      const normalizedProject: Project = {
        ...typedProject,
        client: typedProject.clients ?? null,
        assignee: typedProject.assignee_profile ?? null,
        budget: projectBudget
      }

      setProject(normalizedProject)
      setFormState({
        name: normalizedProject.name ?? '',
        description: normalizedProject.description ?? '',
        status: normalizedProject.status ?? '',
        dueDate: formatDateInput(normalizedProject.due_date),
        clientId: normalizedProject.client?.id ?? '',
        assigneeId: normalizedProject.assignee?.id ?? '',
        budget: normalizedProject.budget ?? ''
      })
    }

    void fetchData()

    return () => {
      isMounted = false
    }
  }, [supabase, params.projectId])

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

    try {
      setSaving(true)
      setError(null)

      const assigneeValue = formState.assigneeId.trim() ? formState.assigneeId : null

      const normalizedDueDate = normalizeDateColumnInput(formState.dueDate)

      const projectUpdate: ProjectUpdate = {
        assignee_profile_id: assigneeValue,
        client_id: selectedClientId,
        description: trimmedDescription,
        due_date: normalizedDueDate,
        name: trimmedName,
        status: selectedStatus as ProjectUpdate['status']
      }

      const { error: projectError } = await supabase
        .from(PROJECTS_TABLE)
        .update(projectUpdate)
        .eq('id', params.projectId)

      if (projectError) {
        throw new Error(projectError.message)
      }

      const briefAnswers = mapBriefFormStateToAnswers(briefFormState)

      const briefUpsert: Database['public']['Tables']['briefs']['Insert'] = {
        project_id: params.projectId,
        answers: briefAnswers,
        completed: hasBriefContent(briefAnswers)
      }

      const { error: briefError } = await supabase
        .from(BRIEFS_TABLE)
        .upsert(briefUpsert, { onConflict: 'project_id' })

      if (briefError) {
        throw new Error(briefError.message)
      }

      let nextInvoiceDetails: InvoiceInfo | null = null

      if (parsedBudget) {
        if (invoiceDetails?.id) {
          const invoiceUpdate: InvoiceUpdate = {
            amount: parsedBudget.amount,
            currency: parsedBudget.currency
          }

          const { data: updatedInvoice, error: updateInvoiceError } = await supabase
            .from(INVOICES_TABLE)
            .update(invoiceUpdate)
            .eq('id', invoiceDetails.id)
            .select('id, amount, currency')
            .single()

          if (updateInvoiceError) {
            throw new Error(updateInvoiceError.message)
          }

          nextInvoiceDetails = updatedInvoice as InvoiceInfo
        } else {
          const invoiceInsert: InvoiceInsert = {
            amount: parsedBudget.amount,
            currency: parsedBudget.currency,
            issued_at: new Date().toISOString(),
            project_id: params.projectId,
            status: 'Quote'
          }

          const { data: insertedInvoice, error: insertInvoiceError } = await supabase
            .from(INVOICES_TABLE)
            .insert(invoiceInsert)
            .select('id, amount, currency')
            .single()

          if (insertInvoiceError) {
            throw new Error(insertInvoiceError.message)
          }

          nextInvoiceDetails = insertedInvoice as InvoiceInfo
        }
      } else if (invoiceDetails?.id) {
        const { error: deleteInvoiceError } = await supabase
          .from(INVOICES_TABLE)
          .delete()
          .eq('id', invoiceDetails.id)

        if (deleteInvoiceError) {
          throw new Error(deleteInvoiceError.message)
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

      setProject((previous) => {
        if (!previous) return previous
        return {
          ...previous,
          name: trimmedName,
          description: trimmedDescription,
          status: selectedStatus as ProjectRow['status'],
          due_date: normalizedDueDate,
          client_id: selectedClientId,
          assignee_profile_id: assigneeValue,
          client: updatedClient,
          assignee: updatedAssignee,
          budget: formattedBudget
        }
      })

      setFormState({
        name: trimmedName,
        description: trimmedDescription,
        status: selectedStatus as ProjectRow['status'],
        dueDate: normalizedDueDate ?? '',
        clientId: selectedClientId,
        assigneeId: assigneeValue ?? '',
        budget: formattedBudget ?? ''
      })

      setBriefFormState(mapBriefAnswersToFormState(briefAnswers))

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

  const isLoading = loadingProject

  const readableProjectName = formState?.name || project?.name || 'Project overview'
  const readableStatus = project?.status ?? 'Unknown'
  const readableDueDate = project ? formatDisplayDate(project.due_date) : 'No due date set'
  const readableBudget =
    formState?.budget && formState.budget.trim().length > 0
      ? formState.budget
      : project?.budget && project.budget.trim().length > 0
        ? project.budget
        : 'Not set'
  const readableCreatedAt = project
    ? new Date(project.created_at).toLocaleString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      })
    : 'Unknown'
  const readableCountdown = project ? formatRelativeTimeFromNow(project.due_date) : 'Unknown'

  return (
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

      {error ? (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <div className="space-y-4">
          <div className="h-40 animate-pulse rounded-2xl border border-white/5 bg-white/5" />
          <div className="h-32 animate-pulse rounded-2xl border border-white/5 bg-white/5" />
        </div>
      ) : project && formState ? (
        <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <div className="space-y-6">
            <section className="rounded-2xl border border-white/10 bg-base-900/50 p-6 shadow-lg shadow-base-900/40 backdrop-blur">
              <header className="mb-6 space-y-1">
                <p className="text-xs uppercase tracking-[0.3em] text-white/40">Project basics</p>
                <h2 className="text-lg font-semibold text-white">Core details</h2>
                <p className="text-sm text-white/60">
                  Update the client, owner, status, budget, description, and due dates for this project.
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
                    onChange={(event) => handleFieldChange('status', event.target.value as ProjectRow['status'])}
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

                <label className="space-y-2 text-sm text-white/70 md:col-span-2 md:max-w-xs">
                  <span className="text-xs uppercase tracking-wide text-white/50">Due date</span>
                  <input
                    type="date"
                    value={formState.dueDate}
                    onChange={(event) => handleFieldChange('dueDate', event.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-base-900/60 px-3 py-2 text-sm text-white/90 focus:border-white/30 focus:outline-none"
                  />
                </label>
                <label className="space-y-2 text-sm text-white/70 md:col-span-2 md:max-w-xs">
                  <span className="text-xs uppercase tracking-wide text-white/50">Budget</span>
                  <input
                    type="text"
                    value={formState.budget}
                    onChange={(event) => handleFieldChange('budget', event.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-base-900/60 px-3 py-2 text-sm text-white/90 placeholder:text-white/40 focus:border-white/30 focus:outline-none"
                    placeholder="$25,000"
                  />
                </label>
                <label className="space-y-2 text-sm text-white/70 md:col-span-2">
                  <span className="text-xs uppercase tracking-wide text-white/50">Project description</span>
                  <textarea
                    rows={6}
                    value={formState.description}
                    onChange={(event) => handleFieldChange('description', event.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-base-900/60 px-3 py-3 text-sm leading-6 text-white/90 placeholder:text-white/40 focus:border-white/30 focus:outline-none"
                    placeholder="Describe the mission, scope, and any decisions that shape the work."
                  />
                </label>
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-base-900/50 p-6 shadow-lg shadow-base-900/40 backdrop-blur">
              <header className="mb-4 space-y-1">
                <p className="text-xs uppercase tracking-[0.3em] text-white/40">Discovery</p>
                <h2 className="text-lg font-semibold text-white">The Brief</h2>
                <p className="text-sm text-white/60">Review and refine the answers captured when this project was kicked off.</p>
              </header>
              <div className="grid gap-5 md:grid-cols-2">
                <label className="space-y-2 text-sm text-white/70 md:col-span-2">
                  <span className="text-xs uppercase tracking-wide text-white/50">Goals</span>
                  <textarea
                    rows={4}
                    value={briefFormState.goals}
                    onChange={(event) => handleBriefFieldChange('goals', event.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-base-900/60 px-3 py-3 text-sm leading-6 text-white/90 placeholder:text-white/40 focus:border-white/30 focus:outline-none"
                    placeholder="Outline the primary objectives and the outcomes we are targeting."
                  />
                </label>
                <label className="space-y-2 text-sm text-white/70">
                  <span className="text-xs uppercase tracking-wide text-white/50">Personas</span>
                  <textarea
                    rows={4}
                    value={briefFormState.personas}
                    onChange={(event) => handleBriefFieldChange('personas', event.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-base-900/60 px-3 py-3 text-sm leading-6 text-white/90 placeholder:text-white/40 focus:border-white/30 focus:outline-none"
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
                  className="w-full rounded-xl border border-white/10 bg-base-900/60 px-3 py-3 text-sm leading-6 text-white/90 placeholder:text-white/40 focus:border-white/30 focus:outline-none"
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
                    className="w-full rounded-xl border border-white/10 bg-base-900/60 px-3 py-3 text-sm leading-6 text-white/90 placeholder:text-white/40 focus:border-white/30 focus:outline-none"
                    placeholder={['Salesforce', 'HubSpot', 'Segment'].join('\n')}
                  />
                  <span className="block text-xs text-white/40">Use line breaks for multiple integrations.</span>
                </label>
                <label className="space-y-2 text-sm text-white/70">
                  <span className="text-xs uppercase tracking-wide text-white/50">Timeline</span>
                  <input
                    type="text"
                    value={briefFormState.timeline}
                    onChange={(event) => handleBriefFieldChange('timeline', event.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-base-900/60 px-3 py-2 text-sm text-white/90 placeholder:text-white/40 focus:border-white/30 focus:outline-none"
                    placeholder="Beta launch in Q3 with GA in November."
                  />
                </label>
                <label className="space-y-2 text-sm text-white/70">
                  <span className="text-xs uppercase tracking-wide text-white/50">Success metrics</span>
                  <textarea
                    rows={3}
                    value={briefFormState.successMetrics}
                    onChange={(event) => handleBriefFieldChange('successMetrics', event.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-base-900/60 px-3 py-3 text-sm leading-6 text-white/90 placeholder:text-white/40 focus:border-white/30 focus:outline-none"
                    placeholder="Increase activation rate to 45% and reduce handoff time by half."
                  />
                </label>
                <label className="space-y-2 text-sm text-white/70">
                  <span className="text-xs uppercase tracking-wide text-white/50">Competitors</span>
                  <textarea
                    rows={3}
                    value={briefFormState.competitors}
                    onChange={(event) => handleBriefFieldChange('competitors', event.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-base-900/60 px-3 py-3 text-sm leading-6 text-white/90 placeholder:text-white/40 focus:border-white/30 focus:outline-none"
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
                    className="w-full rounded-xl border border-white/10 bg-base-900/60 px-3 py-3 text-sm leading-6 text-white/90 placeholder:text-white/40 focus:border-white/30 focus:outline-none"
                    placeholder="Identify open questions, dependencies, or blockers we should monitor."
                  />
                </label>
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-2xl border border-white/10 bg-base-900/40 p-6 shadow-lg shadow-base-900/30 backdrop-blur">
              <header className="mb-4 space-y-1">
                <p className="text-xs uppercase tracking-[0.3em] text-white/40">Summary</p>
                <h2 className="text-lg font-semibold text-white">Key details</h2>
              </header>
              <dl className="space-y-4 text-sm text-white/70">
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-white/50">Client</dt>
                  <dd className="text-right text-white/80">
                    {project.client ? project.client.name : 'Not set'}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-white/50">Owner</dt>
                  <dd className="text-right text-white/80">
                    {project.assignee?.full_name ?? 'Unassigned'}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-white/50">Due date</dt>
                  <dd className="text-right text-white/80">{readableDueDate}</dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-white/50">Budget</dt>
                  <dd className="text-right text-white/80">{readableBudget}</dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-white/50">Countdown</dt>
                  <dd className="text-right text-white/80">{readableCountdown}</dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-white/50">Created</dt>
                  <dd className="text-right text-white/80">{readableCreatedAt}</dd>
                </div>
              </dl>
            </section>

            <section className="rounded-2xl border border-white/10 bg-base-900/40 p-6 shadow-lg shadow-base-900/30 backdrop-blur">
              <header className="mb-4 space-y-1">
                <p className="text-xs uppercase tracking-[0.3em] text-white/40">Delivery playbook</p>
                <h2 className="text-lg font-semibold text-white">Coming attractions</h2>
              </header>
              <p className="text-sm text-white/65">
                Organize milestones, share critical files, and align decisions in one place. We&apos;ll add
                structured timeline and asset management here soon.
              </p>
            </section>
          </aside>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-base-900/50 p-6 text-sm text-white/70">
          We don&apos;t have any details to show for this project yet.
        </div>
      )}
    </div>
  )
}

