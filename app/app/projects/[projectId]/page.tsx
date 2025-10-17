'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

import { StatusBadge } from '../../_components/status-badge'
import type { Database } from '@/types/supabase'
import { createClient } from '@/utils/supabaseBrowser'

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

    const fetchData = async () => {
      if (!supabase) {
        setError('Supabase client unavailable. Please verify your configuration.')
        setLoadingProject(false)
        setLoadingOptions(false)
        return
      }

      setLoadingProject(true)
      setLoadingOptions(true)
      setError(null)

      const [projectResponse, clientsResponse, assigneesResponse, briefResponse, invoiceResponse] = await Promise.all([
        supabase
          .from('projects')
          .select(
            `
              id,
              name,
              status,
              description,
              due_date,
              budget,
              created_at,
              clients:client_id ( id, name ),
              assignee_profile:assignee_profile_id ( id, full_name )
            `
          )
          .eq('id', params.projectId)
          .maybeSingle(),
        supabase
          .from('clients')
          .select('id, name')
          .order('name', { ascending: true }),
        supabase
          .from('profiles')
          .select('id, full_name')
          .order('full_name', { ascending: true }),
        supabase
          .from('briefs')
          .select('answers')
          .eq('project_id', params.projectId)
          .maybeSingle(),
        supabase
          .from('invoices')
          .select('amount, currency, issued_at, created_at')
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
      } else if (invoiceResponse.data) {
        const invoiceData = invoiceResponse.data as Pick<InvoiceRow, 'amount' | 'currency'>
        projectBudget = formatBudgetFromInvoice(invoiceData.amount, invoiceData.currency)
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
              Review your project information and prepare edits. Saving is coming soon.
            </p>
          </div>
        </div>
        <div className="flex flex-col items-start gap-3 sm:items-end">
          {project ? <StatusBadge status={readableStatus} /> : null}
          <button
            type="button"
            disabled
            className="inline-flex items-center justify-center rounded-md border border-white/10 px-4 py-2 text-sm font-semibold uppercase tracking-wide text-white/60 opacity-60"
          >
            Save changes
          </button>
          <p className="text-[11px] uppercase tracking-[0.25em] text-white/40">Coming soon</p>
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

