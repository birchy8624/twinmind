'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { FormProvider, useForm, useFormContext, useWatch } from 'react-hook-form'
import { useRouter } from 'next/navigation'
import { z } from 'zod'

import { createProject, type ProjectWizardPayload } from './actions'

import type { Database } from '@/types/supabase'
import { createBrowserClient } from '@/lib/supabase/browser'
import { useToast } from '../../_components/toast-context'
import { useActiveProfile } from '../../_components/active-profile-context'

type ClientRow = Database['public']['Tables']['clients']['Row']

type ClientOption = Pick<ClientRow, 'id' | 'name'>
const CLIENTS = 'clients' as const

type StepConfig = {
  id: 'details' | 'brief' | 'confirm'
  title: string
  description: string
  fields?: (keyof NewProjectForm)[]
}

const projectSchema = z.object({
  projectName: z.string().trim().min(2, 'Project name is required'),
  clientId: z.string().trim().min(1, 'Select a client'),
  dueDate: z.string().trim().optional().or(z.literal('')),
  budget: z.string().trim().optional().or(z.literal('')),
  projectDescription: z
    .string()
    .trim()
    .min(12, 'Share a short summary (12+ characters)'),
  goals: z
    .string()
    .trim()
    .min(6, 'Outline the key goals for this engagement'),
  personas: z
    .string()
    .trim()
    .min(3, 'List at least one persona or audience'),
  keyFeatures: z
    .string()
    .trim()
    .min(3, 'Highlight the core features we should focus on'),
  integrations: z
    .string()
    .trim()
    .min(3, 'Note required integrations or systems'),
  timeline: z
    .string()
    .trim()
    .min(3, 'Summarise the expected timeline or constraints'),
  successMetrics: z
    .string()
    .trim()
    .min(3, 'Share how we will measure success'),
  competitors: z
    .string()
    .trim()
    .min(3, 'Add at least one competitor or inspiration'),
  risks: z
    .string()
    .trim()
    .min(3, 'List risks, blockers, or unknowns to monitor')
})

type NewProjectForm = z.infer<typeof projectSchema>

const steps: StepConfig[] = [
  {
    id: 'details',
    title: 'Project details',
    description: 'Name, client, timing, and investment basics to get started.',
    fields: ['projectName', 'clientId', 'dueDate', 'budget', 'projectDescription']
  },
  {
    id: 'brief',
    title: 'Discovery questions',
    description: 'Capture goals, context, and success metrics for the team.',
    fields: [
      'goals',
      'personas',
      'keyFeatures',
      'integrations',
      'timeline',
      'successMetrics',
      'competitors',
      'risks'
    ]
  },
  {
    id: 'confirm',
    title: 'Review & create',
    description: 'Double-check the details before we create the project and brief.'
  }
]

const defaultValues: NewProjectForm = {
  projectName: '',
  clientId: '',
  dueDate: '',
  budget: '',
  projectDescription: '',
  goals: '',
  personas: '',
  keyFeatures: '',
  integrations: '',
  timeline: '',
  successMetrics: '',
  competitors: '',
  risks: ''
}

export default function NewProjectPage() {
  const router = useRouter()
  const { pushToast } = useToast()
  const { activeAccountId } = useActiveProfile()
  const [activeStep, setActiveStep] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [clients, setClients] = useState<ClientOption[]>([])
  const [loadingClients, setLoadingClients] = useState(true)
  const [clientsError, setClientsError] = useState<string | null>(null)

  const methods = useForm<NewProjectForm>({
    resolver: zodResolver(projectSchema),
    mode: 'onBlur',
    defaultValues
  })

  const supabase = useMemo(createBrowserClient, [])

  useEffect(() => {
    let isMounted = true

    const fetchClients = async () => {
      setLoadingClients(true)
      setClientsError(null)

      const { data, error } = await supabase
        .from(CLIENTS)
        .select('id, name')
        .order('name', { ascending: true })

      if (!isMounted) return

      if (error) {
        console.error(error)
        setClientsError('We ran into an issue loading clients. Please try again.')
        setClients([])
      } else {
        setClients((data ?? []) as ClientOption[])
      }

      setLoadingClients(false)
    }

    void fetchClients()

    return () => {
      isMounted = false
    }
  }, [supabase])

  const currentStep = steps[activeStep]

  const progress = useMemo(() => ((activeStep + 1) / steps.length) * 100, [activeStep])

  const handleNext = async () => {
    if (activeStep === steps.length - 1) {
      return
    }

    if (!currentStep.fields?.length) {
      setActiveStep((prev) => Math.min(prev + 1, steps.length - 1))
      return
    }

    const isValid = await methods.trigger(currentStep.fields, { shouldFocus: true })
    if (!isValid) {
      pushToast({
        title: 'Check required fields',
        description: 'Please resolve the highlighted inputs before continuing.',
        variant: 'error'
      })
      return
    }

    setActiveStep((prev) => Math.min(prev + 1, steps.length - 1))
  }

  const handlePrevious = () => {
    setActiveStep((prev) => Math.max(prev - 1, 0))
  }

  const handleSubmit = methods.handleSubmit(async (values) => {
    setIsSubmitting(true)

    const payload = formValuesToPayload(values)

    if (!activeAccountId) {
      pushToast({
        title: 'No workspace selected',
        description: 'Select a workspace before creating a project.',
        variant: 'error'
      })
      setIsSubmitting(false)
      return
    }

    try {
      const result = await createProject({ accountId: activeAccountId, wizard: payload })

      if (!result.ok) {
        pushToast({
          title: 'Unable to create project',
          description: result.message ?? 'We could not save this project. Please try again.',
          variant: 'error'
        })
        return
      }

      pushToast({
        title: 'Project created',
        description: 'We set up the project and captured the brief answers.',
        variant: 'success'
      })

      methods.reset(defaultValues)
      setActiveStep(0)

      router.push(`/app/projects/${result.projectId}`)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'We could not save this project. Please try again.'

      pushToast({
        title: 'Unable to create project',
        description: message,
        variant: 'error'
      })
    } finally {
      setIsSubmitting(false)
    }
  })

  const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    const nativeEvent = event.nativeEvent

    if (!(nativeEvent instanceof SubmitEvent)) {
      event.preventDefault()
      return
    }

    const submitter = nativeEvent.submitter

    if (!(submitter instanceof HTMLButtonElement) || submitter.name !== 'create-project') {
      event.preventDefault()
      return
    }

    return handleSubmit(event)
  }

  return (
    <FormProvider {...methods}>
      <div className="space-y-6">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-white/50">Project wizard</p>
          <h1 className="text-2xl font-semibold text-white">Create a new project</h1>
          <p className="text-sm text-white/70">
            Assign the work to an existing client, capture discovery context, and we will generate the
            brief.
          </p>
        </header>

        <form
          onSubmit={handleFormSubmit}
          className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-base-900/50 shadow-lg shadow-base-900/40 backdrop-blur"
        >
          <div className="border-b border-white/10 bg-base-900/60 px-6 py-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/50">
                  Step {activeStep + 1} of {steps.length}
                </p>
                <h2 className="text-lg font-semibold text-white">{currentStep.title}</h2>
                <p className="text-sm text-white/60">{currentStep.description}</p>
              </div>
              <div className="flex w-full max-w-xs items-center gap-3">
                {steps.map((step, index) => {
                  const isActive = index === activeStep
                  const isCompleted = index < activeStep
                  return (
                    <div key={step.id} className="flex-1">
                      <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
                        <div
                          className={`h-full transition-all ${
                            isCompleted
                              ? 'w-full bg-limeglow-500'
                              : isActive
                                ? 'bg-white/80'
                                : 'w-0 bg-transparent'
                          }`}
                          style={isActive ? { width: `${progress}%` } : undefined}
                        />
                      </div>
                      <p className="mt-1 text-[10px] uppercase tracking-wide text-white/50">{step.title}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="relative px-6 py-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="space-y-6"
              >
                {currentStep.id === 'details' ? (
                  <ProjectDetailsStep
                    clients={clients}
                    loading={loadingClients}
                    error={clientsError}
                  />
                ) : null}
                {currentStep.id === 'brief' ? <BriefQuestionsStep /> : null}
                {currentStep.id === 'confirm' ? (
                  <ReviewStep clients={clients} loadingClients={loadingClients} />
                ) : null}
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="flex flex-col gap-3 border-t border-white/10 bg-base-900/60 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={handlePrevious}
              disabled={activeStep === 0 || isSubmitting}
              className="rounded-md px-4 py-2 text-sm font-medium text-white/70 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Back
            </button>
            <div className="flex flex-1 flex-col-reverse items-stretch gap-2 sm:flex-row sm:justify-end">
              {activeStep === steps.length - 1 ? (
                <button
                  type="submit"
                  name="create-project"
                  disabled={isSubmitting}
                  className="rounded-md px-4 py-2 text-sm font-semibold transition btn-gradient disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? 'Creating…' : 'Create project'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleNext}
                  className="rounded-md px-4 py-2 text-sm font-semibold transition btn-gradient"
                >
                  Continue
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </FormProvider>
  )
}

type ProjectDetailsStepProps = {
  clients: ClientOption[]
  loading: boolean
  error: string | null
}

function ProjectDetailsStep({ clients, loading, error }: ProjectDetailsStepProps) {
  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-white">Project details</h3>
        <p className="text-sm text-white/60">
          We will create the project with status <span className="font-medium">“Backlog”</span> and assign it to the selected client.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <InputField id="projectName" label="Project name" placeholder="Atlas product redesign" />
        <ClientSelectField clients={clients} loading={loading} error={error} />
        <InputField id="dueDate" label="Target launch / due date" type="date" helper="Optional" />
        <InputField id="budget" label="Budget" placeholder="$25,000" helper="Optional" />
        <TextareaField
          id="projectDescription"
          label="Project description"
          placeholder="Share context on the initiative, objectives, or key deliverables."
          className="md:col-span-2"
        />
      </div>
    </section>
  )
}

function BriefQuestionsStep() {
  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-white">Discovery questions</h3>
        <p className="text-sm text-white/60">
          Capture what success looks like so the team can start with the right context.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <TextareaField id="goals" label="Goals" placeholder="What are we aiming to achieve?" />
        <TextareaField
          id="personas"
          label="Personas"
          placeholder={["Product manager", "Operations lead", "Customer support"].join('\n')}
        />
        <TextareaField
          id="keyFeatures"
          label="Key features"
          placeholder={["Real-time dashboards", "Role-based access", "AI-assisted insights"].join('\n')}
        />
        <TextareaField
          id="integrations"
          label="Integrations"
          placeholder={["Salesforce", "HubSpot", "Segment"].join('\n')}
        />
        <TextareaField
          id="timeline"
          label="Timeline"
          placeholder="Beta launch in Q3 with GA in November."
        />
        <TextareaField
          id="successMetrics"
          label="Success metrics"
          placeholder="Increase activation rate to 45% and reduce handoff time by half."
        />
        <TextareaField
          id="competitors"
          label="Competitors"
          placeholder={["Acme Analytics", "Northwind Suite"].join('\n')}
        />
        <TextareaField
          id="risks"
          label="Risks"
          placeholder="Identify open questions, dependencies, or blockers we should monitor."
          className="md:col-span-2"
        />
      </div>
    </section>
  )
}

type ReviewStepProps = {
  clients: ClientOption[]
  loadingClients: boolean
}

function ReviewStep({ clients, loadingClients }: ReviewStepProps) {
  const values = useWatch<NewProjectForm>()

  const selectedClient = clients.find((client) => client.id === values.clientId)

  const details: [string, string][] = [
    ['Project name', values.projectName || '—'],
    [
      'Client',
      loadingClients ? 'Loading clients…' : selectedClient?.name || '—'
    ],
    ['Due date', formatDate(values.dueDate)],
    ['Budget', values.budget?.trim().length ? values.budget : 'Not provided'],
    ['Description', values.projectDescription || '—']
  ]

  const brief: [string, string][] = [
    ['Goals', values.goals || '—'],
    ['Personas', formatMultiline(values.personas)],
    ['Key features', formatMultiline(values.keyFeatures)],
    ['Integrations', formatMultiline(values.integrations)],
    ['Timeline', values.timeline || '—'],
    ['Success metrics', values.successMetrics || '—'],
    ['Competitors', formatMultiline(values.competitors)],
    ['Risks', values.risks || '—']
  ]

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-white">Review</h3>
        <p className="text-sm text-white/60">
          We will create the project, store these answers in the brief, and draft a quote if a budget is provided.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <SummaryCard title="Project" items={details} />
        <SummaryCard title="Brief" items={brief} />
      </div>
    </section>
  )
}

type InputFieldProps = {
  id: keyof NewProjectForm
  label: string
  placeholder?: string
  type?: string
  helper?: string
}

function InputField({ id, label, placeholder, type = 'text', helper }: InputFieldProps) {
  const {
    register,
    formState: { errors }
  } = useFormContext<NewProjectForm>()

  const error = errors[id]?.message as string | undefined

  return (
    <label className="space-y-2 text-sm text-white/70">
      <span className="text-xs uppercase tracking-wide text-white/50">{label}</span>
      <input
        type={type}
        placeholder={placeholder}
        {...register(id)}
        className="w-full rounded-lg border border-white/10 bg-base-900/60 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
      />
      <div className="flex items-center justify-between text-xs text-white/40">
        {helper ? <span>{helper}</span> : <span />}
        {error ? <span className="font-medium text-rose-300">{error}</span> : null}
      </div>
    </label>
  )
}

type TextareaFieldProps = {
  id: keyof NewProjectForm
  label: string
  placeholder?: string
  className?: string
}

function TextareaField({ id, label, placeholder, className }: TextareaFieldProps) {
  const {
    register,
    formState: { errors }
  } = useFormContext<NewProjectForm>()

  const error = errors[id]?.message as string | undefined

  return (
    <label className={`space-y-2 text-sm text-white/70 ${className ?? ''}`}>
      <span className="text-xs uppercase tracking-wide text-white/50">{label}</span>
      <textarea
        rows={4}
        placeholder={placeholder}
        {...register(id)}
        className="w-full rounded-lg border border-white/10 bg-base-900/60 px-3 py-3 text-sm leading-6 text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
      />
      {error ? <span className="block text-xs font-medium text-rose-300">{error}</span> : null}
    </label>
  )
}

type ClientSelectFieldProps = {
  clients: ClientOption[]
  loading: boolean
  error: string | null
}

function ClientSelectField({ clients, loading, error }: ClientSelectFieldProps) {
  const {
    register,
    formState: { errors }
  } = useFormContext<NewProjectForm>()

  const fieldError = errors.clientId?.message as string | undefined

  return (
    <label className="space-y-2 text-sm text-white/70">
      <span className="text-xs uppercase tracking-wide text-white/50">Client</span>
      <select
        {...register('clientId')}
        disabled={loading || clients.length === 0}
        className="w-full rounded-lg border border-white/10 bg-base-900/60 px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 disabled:opacity-60"
      >
        <option value="">
          {loading ? 'Loading clients…' : error ? 'Unable to load clients' : 'Select a client'}
        </option>
        {clients.map((client) => (
          <option key={client.id} value={client.id}>
            {client.name}
          </option>
        ))}
      </select>
      <div className="flex items-center justify-between text-xs text-white/40">
        {error ? <span className="text-rose-200">{error}</span> : <span />}
        {fieldError ? <span className="font-medium text-rose-300">{fieldError}</span> : null}
      </div>
    </label>
  )
}

type SummaryCardProps = {
  title: string
  items: [string, string][]
}

function SummaryCard({ title, items }: SummaryCardProps) {
  return (
    <div className="flex h-full flex-col gap-3 rounded-xl border border-white/10 bg-base-900/40 p-5">
      <h4 className="text-sm font-semibold text-white">{title}</h4>
      <dl className="space-y-3 text-sm text-white/70">
        {items.map(([label, value]) => (
          <div key={label} className="space-y-1">
            <dt className="text-xs uppercase tracking-wide text-white/50">{label}</dt>
            <dd className="whitespace-pre-line text-white/80">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function formValuesToPayload(values: NewProjectForm): ProjectWizardPayload {
  const invoiceAmount = parseCurrency(values.budget)
  const personas = splitLines(values.personas)
  const features = splitLines(values.keyFeatures)
  const integrations = splitLines(values.integrations)
  const competitors = splitLines(values.competitors)

  return {
    project: {
      name: values.projectName,
      description: values.projectDescription,
      clientId: values.clientId,
      dueDate: values.dueDate || undefined
    },
    invoice: invoiceAmount
      ? {
          amount: invoiceAmount,
          currency: 'EUR'
        }
      : undefined,
    brief: {
      goals: values.goals,
      personas,
      features,
      integrations,
      timeline: values.timeline || undefined,
      successMetrics: values.successMetrics || undefined,
      competitors,
      risks: values.risks || undefined
    }
  }
}

function splitLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function formatMultiline(value?: string | null): string {
  if (!value) {
    return '—'
  }

  const lines = splitLines(value)
  if (!lines.length) {
    return '—'
  }
  return lines.join('\n')
}

function formatDate(value?: string | null): string {
  if (!value) {
    return 'Not set'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

function parseCurrency(value?: string): number | undefined {
  if (!value) {
    return undefined
  }

  const cleaned = value.replace(/[^0-9.-]/g, '')
  if (!cleaned) {
    return undefined
  }

  const amount = Number(cleaned)
  if (Number.isNaN(amount) || amount <= 0) {
    return undefined
  }

  return amount
}
