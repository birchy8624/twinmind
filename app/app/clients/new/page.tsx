'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { AnimatePresence, motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import {
  Controller,
  FormProvider,
  useFieldArray,
  useForm,
  useFormContext,
  useWatch
} from 'react-hook-form'
import { useRouter } from 'next/navigation'
import { z } from 'zod'

import { insertClientOnboarding } from '@/lib/supabase'

import { useToast } from '../../_components/toast-context'

const timezones = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Paris',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney'
]

const urlValidator = z
  .string()
  .trim()
  .refine((value) => value.length === 0 || isValidUrl(value), {
    message: 'Enter a valid URL'
  })

const onboardingSchema = z.object({
  clientName: z.string().trim().min(2, 'Client name is required'),
  clientEmail: z.string().trim().email('Enter a valid email address'),
  company: z.string().trim().min(2, 'Company is required'),
  website: urlValidator,
  phone: z
    .string()
    .trim()
    .refine((value) => value.length === 0 || value.length >= 7, {
      message: 'Enter a phone number or leave blank'
    }),
  timezone: z.string().trim().min(1, 'Select a timezone'),
  budget: z.string().trim().optional().or(z.literal('')),
  gdprConsent: z.boolean().refine((value) => value, {
    message: 'GDPR consent must be recorded'
  }),
  projectName: z.string().trim().min(2, 'Project name is required'),
  projectDescription: z
    .string()
    .trim()
    .min(12, 'Provide a short project description (12+ characters)'),
  projectDueDate: z.string().trim().optional().or(z.literal('')),
  briefGoals: z
    .string()
    .trim()
    .min(6, 'Share the engagement goals and desired outcomes'),
  briefTargetUsers: z
    .string()
    .trim()
    .min(6, 'Describe the target users or personas'),
  briefFeatures: z
    .string()
    .trim()
    .min(6, 'List the core features or must-haves'),
  briefIntegrations: z
    .string()
    .trim()
    .min(3, 'Note required integrations, or say “None”'),
  briefTimeline: z
    .string()
    .trim()
    .min(6, 'Outline any timeline constraints'),
  briefSuccess: z
    .string()
    .trim()
    .min(6, 'Define what success looks like'),
  competitors: z
    .array(
      z.object({
        value: z
          .string()
          .trim()
          .refine((value) => value.length === 0 || isValidUrl(value), {
            message: 'Enter a valid URL'
          })
      })
    )
    .min(1, 'Add at least one link slot'),
  briefRisks: z
    .string()
    .trim()
    .min(6, 'Capture known risks or assumptions'),
  inviteClient: z.boolean()
})

type OnboardingForm = z.infer<typeof onboardingSchema>

type StepConfig = {
  id: 'client' | 'project' | 'brief' | 'review'
  title: string
  description: string
  fields?: (keyof OnboardingForm)[]
}

const steps: StepConfig[] = [
  {
    id: 'client',
    title: 'Client basics',
    description: 'Capture contact details, budget, and GDPR consent.',
    fields: [
      'clientName',
      'clientEmail',
      'company',
      'website',
      'phone',
      'timezone',
      'budget',
      'gdprConsent'
    ]
  },
  {
    id: 'project',
    title: 'Project details',
    description: 'Summarise the initiative that will be created on submit.',
    fields: ['projectName', 'projectDescription', 'projectDueDate']
  },
  {
    id: 'brief',
    title: 'Discovery brief',
    description: 'Collect goals, users, requirements, and success measures.',
    fields: [
      'briefGoals',
      'briefTargetUsers',
      'briefFeatures',
      'briefIntegrations',
      'briefTimeline',
      'briefSuccess',
      'competitors',
      'briefRisks'
    ]
  },
  {
    id: 'review',
    title: 'Review & create',
    description: 'Confirm details and trigger client, project, brief, and invoice setup.'
  }
]

const defaultValues: OnboardingForm = {
  clientName: '',
  clientEmail: '',
  company: '',
  website: '',
  phone: '',
  timezone: '',
  budget: '',
  gdprConsent: false,
  projectName: '',
  projectDescription: '',
  projectDueDate: '',
  briefGoals: '',
  briefTargetUsers: '',
  briefFeatures: '',
  briefIntegrations: '',
  briefTimeline: '',
  briefSuccess: '',
  competitors: [{ value: '' }],
  briefRisks: '',
  inviteClient: false
}

const sanitizeCurrencyToNumber = (value?: string) => {
  if (!value) return undefined

  const numeric = value.replace(/[^0-9,.-]/g, '').replace(/,/g, '')
  const amount = Number.parseFloat(numeric)

  return Number.isFinite(amount) ? amount : undefined
}

const toList = (value: string) =>
  value
    .split(/\r?\n|,/)
    .map((entry) => entry.trim())
    .filter(Boolean)

const optionalString = (value?: string) => {
  if (!value) return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

const formValuesToPayload = (values: OnboardingForm): WizardPayload => {
  const competitorLinks = values.competitors
    ?.map((item) => item.value.trim())
    .filter((link) => link.length > 0)

  const dueDateIso = values.projectDueDate
    ? new Date(`${values.projectDueDate}T00:00:00.000Z`).toISOString()
    : undefined

  return {
    inviteClient: values.inviteClient,
    client: {
      name: values.clientName.trim(),
      email: values.clientEmail.trim(),
      company: optionalString(values.company),
      website: optionalString(values.website),
      phone: optionalString(values.phone),
      timezone: optionalString(values.timezone),
      budget: optionalString(values.budget),
      gdpr_consent: values.gdprConsent
    },
    project: {
      name: values.projectName.trim(),
      description: values.projectDescription.trim(),
      due_date: dueDateIso,
      invoice_amount: sanitizeCurrencyToNumber(values.budget),
      currency: 'EUR'
    },
    brief: {
      goals: values.briefGoals.trim(),
      personas: toList(values.briefTargetUsers),
      features: toList(values.briefFeatures),
      integrations: toList(values.briefIntegrations),
      timeline: optionalString(values.briefTimeline),
      successMetrics: optionalString(values.briefSuccess),
      competitors: competitorLinks ?? [],
      risks: optionalString(values.briefRisks)
    }
  }
}

export default function NewClientPage() {
  const router = useRouter()
  const { pushToast } = useToast()
  const [activeStep, setActiveStep] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const methods = useForm<OnboardingForm>({
    resolver: zodResolver(onboardingSchema),
    mode: 'onBlur',
    defaultValues
  })

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

    const competitorLinks = values.competitors
      .map((item) => item.value.trim())
      .filter((link): link is string => Boolean(link))

    const payload = {
      client_name: values.clientName,
      client_email: values.clientEmail,
      company: values.company,
      website: values.website ? values.website : null,
      phone: values.phone ? values.phone : null,
      timezone: values.timezone,
      budget: values.budget ? values.budget : null,
      gdpr_consent: values.gdprConsent,
      project_name: values.projectName,
      project_description: values.projectDescription,
      project_due_date: values.projectDueDate ? values.projectDueDate : null,
      goals: values.briefGoals,
      target_users: values.briefTargetUsers,
      core_features: values.briefFeatures,
      integrations: values.briefIntegrations,
      timeline: values.briefTimeline,
      success_metrics: values.briefSuccess,
      competitors: competitorLinks,
      risks: values.briefRisks,
      invite_client: values.inviteClient
    }

    try {
      await insertClientOnboarding(payload)

      pushToast({
        title: 'Client saved',
        description: 'The onboarding details were stored in Supabase.',
        variant: 'success'
      })

      const clientSlug = slugify(values.clientName) || 'new-client'

      methods.reset(defaultValues)
      setActiveStep(0)

      router.push(`/app/clients/${clientSlug}`)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'We could not save this client. Please try again.'

      pushToast({
        title: 'Unable to create client',
        description: message,
        variant: 'error'
      })
    } finally {
      setIsSubmitting(false)
    }
  })

  return (
    <FormProvider {...methods}>
      <div className="space-y-6">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-white/50">Onboarding wizard</p>
          <h1 className="text-2xl font-semibold text-white">Add a new client</h1>
          <p className="text-sm text-white/70">
            Guide partners through discovery and create the project, brief, and quote in one
            flow.
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
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
                      <p className="mt-1 text-[10px] uppercase tracking-wide text-white/50">
                        {step.title}
                      </p>
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
                {currentStep.id === 'client' ? <ClientBasics /> : null}
                {currentStep.id === 'project' ? <ProjectDetails /> : null}
                {currentStep.id === 'brief' ? <BriefQuestions /> : null}
                {currentStep.id === 'review' ? <ReviewStep /> : null}
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
                  disabled={isSubmitting}
                  className="rounded-md px-4 py-2 text-sm font-semibold transition btn-gradient disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? 'Creating…' : 'Create client & project'}
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

function ClientBasics() {
  return (
    <section className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-white">Client basics</h3>
        <p className="text-sm text-white/60">
          Contact details, timezone, and consent to create the account and quote.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <InputField id="clientName" label="Client name" placeholder="Sarah Connor" />
        <InputField id="clientEmail" label="Email" placeholder="sarah@skynet.io" type="email" />
        <InputField id="company" label="Company" placeholder="Skynet Industries" />
        <InputField id="website" label="Website" placeholder="https://skynet.io" />
        <InputField id="phone" label="Phone" placeholder="+1 415 555 0100" />
        <SelectField id="timezone" label="Timezone" options={timezones} />
        <InputField id="budget" label="Budget estimate" placeholder="$25,000" />
        <div className="md:col-span-2">
          <CheckboxField
            id="gdprConsent"
            label="I have captured GDPR consent to store this client's information."
          />
        </div>
      </div>
    </section>
  )
}

function ProjectDetails() {
  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-white">Project details</h3>
        <p className="text-sm text-white/60">
          A project will be created with status <span className="font-medium">“Brief Gathered”</span>{' '}
          when you submit this wizard.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <InputField id="projectName" label="Project name" placeholder="Atlas product redesign" />
        <InputField
          id="projectDueDate"
          label="Target launch / due date"
          type="date"
          helper="Optional"
        />
        <TextareaField
          id="projectDescription"
          label="High-level description"
          placeholder="Share context on the initiative, objectives, or key deliverables."
          className="md:col-span-2"
        />
      </div>
    </section>
  )
}

function BriefQuestions() {
  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-white">Discovery brief</h3>
        <p className="text-sm text-white/60">
          Capture everything needed to kick off—answers will be saved as a structured brief.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <TextareaField
          id="briefGoals"
          label="Goals & outcomes"
          placeholder="What are we aiming to achieve?"
        />
        <TextareaField
          id="briefTargetUsers"
          label="Target users & personas"
          placeholder="Who are we building for?"
        />
        <TextareaField
          id="briefFeatures"
          label="Core features / must-haves"
          placeholder="List key workflows or functionality."
        />
        <TextareaField
          id="briefIntegrations"
          label="Integrations"
          placeholder="Auth providers, payments, data sources, etc."
        />
        <TextareaField
          id="briefTimeline"
          label="Timeline & constraints"
          placeholder="Key milestones, blockers, or dependencies."
        />
        <TextareaField
          id="briefSuccess"
          label="Success metrics"
          placeholder="What will make this project a success?"
        />
        <CompetitorLinks />
        <TextareaField
          id="briefRisks"
          label="Risks & assumptions"
          placeholder="Highlight any risks, unknowns, or caveats."
        />
      </div>
    </section>
  )
}

function ReviewStep() {
  const { control } = useFormContext<OnboardingForm>()
  const values = useWatch<OnboardingForm>({ control })

  const competitorLinks = values.competitors?.map((item) => item.value).filter(Boolean)

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-white">Review & create</h3>
        <p className="text-sm text-white/60">
          Double-check the summary below. Click the create button when you are ready and we will store the client, project,
          brief, and draft quote (if an amount is provided) in Supabase.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <SummaryCard
          title="Client"
          items={[
            ['Name', values.clientName || '—'],
            ['Email', values.clientEmail || '—'],
            ['Company', values.company || '—'],
            ['Website', values.website || '—'],
            ['Phone', values.phone || '—'],
            ['Timezone', values.timezone || '—'],
            ['Budget', values.budget ? values.budget : '—']
          ]}
        />
        <SummaryCard
          title="Project"
          items={[
            ['Name', values.projectName || '—'],
            ['Due date', values.projectDueDate || '—'],
            ['Description', values.projectDescription || '—']
          ]}
        />
        <SummaryCard
          title="Brief"
          items={[
            ['Goals & outcomes', values.briefGoals || '—'],
            ['Target users', values.briefTargetUsers || '—'],
            ['Core features', values.briefFeatures || '—'],
            ['Integrations', values.briefIntegrations || '—'],
            ['Timeline & constraints', values.briefTimeline || '—'],
            ['Success metrics', values.briefSuccess || '—'],
            [
              'Competitors & inspiration',
              competitorLinks?.length
                ? competitorLinks.map((link) => `• ${link}`).join('\n')
                : '—'
            ],
            ['Risks & assumptions', values.briefRisks || '—']
          ]}
        />
        <div className="flex flex-col justify-between gap-4 rounded-xl border border-white/10 bg-base-900/40 p-5">
          <div>
            <h4 className="text-sm font-semibold text-white">Automations</h4>
            <ul className="mt-2 space-y-2 text-sm text-white/65">
              <li>• Create client profile with the provided contact details.</li>
              <li>• Spin up a project marked <span className="font-medium">“Brief Gathered”.</span></li>
              <li>• Store the discovery brief responses as structured JSON.</li>
              <li>
                • Create an invoice row with status <span className="font-medium">“Quote”.</span>{' '}
                {values.budget ? 'Budget amount will be attached.' : 'No amount provided yet.'}
              </li>
            </ul>
          </div>
          <InviteToggle />
        </div>
      </div>
    </section>
  )
}

type FieldProps = {
  id: keyof OnboardingForm
  label: string
  placeholder?: string
  type?: string
  helper?: string
  className?: string
}

function InputField({ id, label, placeholder, type = 'text', helper, className }: FieldProps) {
  const {
    register,
    formState: { errors }
  } = useFormContext<OnboardingForm>()

  const error = errors[id]?.message as string | undefined

  return (
    <label className={`flex flex-col gap-2 ${className ?? ''}`}>
      <span className="text-xs font-semibold uppercase tracking-wide text-white/60">{label}</span>
      <input
        {...register(id)}
        type={type}
        placeholder={placeholder}
        className="w-full rounded-lg border border-white/10 bg-base-900/70 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
      />
      <div className="min-h-[1.25rem] text-xs text-white/60">
        {error ? <span className="font-medium text-rose-300">{error}</span> : helper}
      </div>
    </label>
  )
}

type TextareaProps = FieldProps & { rows?: number }

function TextareaField({ id, label, placeholder, className, rows = 4 }: TextareaProps) {
  const {
    register,
    formState: { errors }
  } = useFormContext<OnboardingForm>()

  const error = errors[id]?.message as string | undefined

  return (
    <label className={`flex flex-col gap-2 ${className ?? ''}`}>
      <span className="text-xs font-semibold uppercase tracking-wide text-white/60">{label}</span>
      <textarea
        {...register(id)}
        placeholder={placeholder}
        rows={rows}
        className="w-full rounded-lg border border-white/10 bg-base-900/70 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
      />
      {error ? <span className="text-xs font-medium text-rose-300">{error}</span> : null}
    </label>
  )
}

type SelectFieldProps = {
  id: keyof OnboardingForm
  label: string
  options: string[]
}

function SelectField({ id, label, options }: SelectFieldProps) {
  const {
    register,
    formState: { errors }
  } = useFormContext<OnboardingForm>()

  const error = errors[id]?.message as string | undefined

  return (
    <label className="flex flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-white/60">{label}</span>
      <select
        {...register(id)}
        className="w-full appearance-none rounded-lg border border-white/10 bg-base-900/70 px-4 py-3 text-sm text-white focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
      >
        <option value="">Select…</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      {error ? <span className="text-xs font-medium text-rose-300">{error}</span> : null}
    </label>
  )
}

type CheckboxFieldProps = {
  id: keyof OnboardingForm
  label: string
}

function CheckboxField({ id, label }: CheckboxFieldProps) {
  const {
    register,
    formState: { errors },
    watch
  } = useFormContext<OnboardingForm>()

  const error = errors[id]?.message as string | undefined
  const checked = watch(id) as boolean

  return (
    <div className="space-y-2 rounded-lg border border-white/10 bg-base-900/60 px-4 py-3">
      <label className="flex items-start gap-3 text-sm text-white/80">
        <input
          type="checkbox"
          {...register(id)}
          className="mt-1 h-4 w-4 rounded border-white/20 bg-base-900 text-limeglow-400 focus:ring-limeglow-400"
        />
        <span>
          {label}
          <span className="block text-xs text-white/50">
            {checked ? 'Consent confirmed' : 'Consent required before continuing.'}
          </span>
        </span>
      </label>
      {error ? <span className="text-xs font-medium text-rose-300">{error}</span> : null}
    </div>
  )
}

function CompetitorLinks() {
  const {
    control,
    register,
    formState: { errors }
  } = useFormContext<OnboardingForm>()
  const { fields, append, remove } = useFieldArray({ control, name: 'competitors' })

  const competitorErrors = errors.competitors as
    | { value?: { message?: string } }[]
    | undefined

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-base-900/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-white/60">
            Competitors / inspiration links
          </span>
          <p className="mt-1 text-xs text-white/50">
            Provide one URL per line. Empty rows are skipped automatically.
          </p>
        </div>
        <button
          type="button"
          onClick={() => append({ value: '' })}
          className="rounded-md border border-white/20 px-2 py-1 text-xs font-medium text-white/70 transition hover:bg-white/10"
        >
          Add link
        </button>
      </div>
      <div className="space-y-3">
        {fields.map((field, index) => {
          const fieldError = competitorErrors?.[index]?.value?.message
          return (
            <div key={field.id} className="flex items-start gap-2">
              <input
                {...register(`competitors.${index}.value` as const)}
                placeholder="https://example.com"
                className="flex-1 rounded-lg border border-white/10 bg-base-900/70 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
              />
              <button
                type="button"
                onClick={() => remove(index)}
                disabled={fields.length === 1}
                className="rounded-md px-2 py-2 text-xs font-medium text-white/60 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Remove
              </button>
              {fieldError ? (
                <span className="text-xs font-medium text-rose-300">{fieldError}</span>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
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

function InviteToggle() {
  const { control } = useFormContext<OnboardingForm>()

  return (
    <Controller
      name="inviteClient"
      control={control}
      render={({ field }) => (
        <label className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-base-900/70 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-white">Invite client</p>
            <p className="text-xs text-white/60">
              Sends an email invite and creates a client portal login on submit.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={field.value}
            onClick={() => field.onChange(!field.value)}
            className={`flex h-7 w-12 items-center rounded-full border border-white/20 bg-white/10 p-1 transition ${
              field.value ? 'bg-limeglow-400/30' : 'bg-base-900/40'
            }`}
          >
            <span
              className={`h-5 w-5 rounded-full bg-white transition-transform ${
                field.value ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </label>
      )}
    />
  )
}

function isValidUrl(value: string) {
  try {
    const url = new URL(value)
    return Boolean(url.protocol && url.host)
  } catch (error) {
    try {
      const url = new URL(`https://${value}`)
      return Boolean(url.host)
    } catch (nestedError) {
      return false
    }
  }
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}
