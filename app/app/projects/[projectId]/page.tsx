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

type Project = ProjectRow & {
  client: Pick<ClientRow, 'id' | 'name'> | null
  assignee: Pick<ProfileRow, 'id' | 'full_name'> | null
}

type EditableProject = {
  name: string
  description: string
  status: ProjectRow['status'] | ''
  dueDate: string
  clientId: string
  assigneeId: string
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
  const [briefAnswers, setBriefAnswers] = useState<BriefAnswers | null>(null)
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

      const [projectResponse, clientsResponse, assigneesResponse, briefResponse] = await Promise.all([
        supabase
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
          .maybeSingle()
      ])

      if (!isMounted) return

      setLoadingOptions(false)

      if (briefResponse.error) {
        console.error(briefResponse.error)
        setBriefAnswers(null)
      } else {
        const briefData = briefResponse.data as Pick<BriefRow, 'answers'> | null
        setBriefAnswers(normalizeBriefAnswers(briefData?.answers ?? null))
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
        setBriefAnswers(null)
        setError('We ran into an issue loading this project. Please try again.')
        return
      }

      if (!projectResponse.data) {
        setProject(null)
        setFormState(null)
        setBriefAnswers(null)
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
        assignee: typedProject.assignee_profile ?? null
      }

      setProject(normalizedProject)
      setFormState({
        name: normalizedProject.name ?? '',
        description: normalizedProject.description ?? '',
        status: normalizedProject.status ?? '',
        dueDate: formatDateInput(normalizedProject.due_date),
        clientId: normalizedProject.client?.id ?? '',
        assigneeId: normalizedProject.assignee?.id ?? ''
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

  const isLoading = loadingProject

  const readableProjectName = formState?.name || project?.name || 'Project overview'
  const readableStatus = project?.status ?? 'Unknown'
  const readableDueDate = project ? formatDisplayDate(project.due_date) : 'No due date set'
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
                  Update the client, owner, status, description, and due dates for this project.
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
                <p className="text-sm text-white/60">Review the answers captured when this project was kicked off.</p>
              </header>
              {briefAnswers ? (
                <dl className="space-y-5 text-sm text-white/70">
                  <div className="space-y-1">
                    <dt className="text-xs uppercase tracking-[0.2em] text-white/40">Goals</dt>
                    <dd className="whitespace-pre-line text-white/80">{briefAnswers.goals ?? 'Not provided'}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-xs uppercase tracking-[0.2em] text-white/40">Personas</dt>
                    <dd className="text-white/80">
                      {briefAnswers.personas.length > 0 ? (
                        <ul className="list-disc space-y-1 pl-5">
                          {briefAnswers.personas.map((persona) => (
                            <li key={persona}>{persona}</li>
                          ))}
                        </ul>
                      ) : (
                        'Not provided'
                      )}
                    </dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-xs uppercase tracking-[0.2em] text-white/40">Key features</dt>
                    <dd className="text-white/80">
                      {briefAnswers.features.length > 0 ? (
                        <ul className="list-disc space-y-1 pl-5">
                          {briefAnswers.features.map((feature) => (
                            <li key={feature}>{feature}</li>
                          ))}
                        </ul>
                      ) : (
                        'Not provided'
                      )}
                    </dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-xs uppercase tracking-[0.2em] text-white/40">Integrations</dt>
                    <dd className="text-white/80">
                      {briefAnswers.integrations.length > 0 ? (
                        <ul className="list-disc space-y-1 pl-5">
                          {briefAnswers.integrations.map((integration) => (
                            <li key={integration}>{integration}</li>
                          ))}
                        </ul>
                      ) : (
                        'Not provided'
                      )}
                    </dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-xs uppercase tracking-[0.2em] text-white/40">Timeline</dt>
                    <dd className="text-white/80">{briefAnswers.timeline ?? 'Not provided'}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-xs uppercase tracking-[0.2em] text-white/40">Success metrics</dt>
                    <dd className="text-white/80">{briefAnswers.successMetrics ?? 'Not provided'}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-xs uppercase tracking-[0.2em] text-white/40">Competitors</dt>
                    <dd className="text-white/80">
                      {briefAnswers.competitors.length > 0 ? (
                        <ul className="list-disc space-y-1 pl-5">
                          {briefAnswers.competitors.map((competitor) => (
                            <li key={competitor}>{competitor}</li>
                          ))}
                        </ul>
                      ) : (
                        'Not provided'
                      )}
                    </dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-xs uppercase tracking-[0.2em] text-white/40">Risks</dt>
                    <dd className="whitespace-pre-line text-white/80">{briefAnswers.risks ?? 'Not provided'}</dd>
                  </div>
                </dl>
              ) : (
                <p className="text-sm text-white/60">We don&apos;t have a brief on file for this project yet.</p>
              )}
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

