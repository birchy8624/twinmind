'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { AnimatePresence, motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { FormProvider, useForm, useFormContext } from 'react-hook-form'
import { z } from 'zod'

import { useToast } from './toast-context'

const formSchema = z.object({
  name: z.string().min(2, 'Project name is required'),
  client: z.string().min(2, 'Client is required'),
  summary: z.string().min(12, 'Add a short summary (12+ characters)'),
  services: z.string().min(3, 'List at least one service focus'),
  kickoffDate: z.string().min(1, 'Kickoff date is required'),
  launchDate: z.string().min(1, 'Target launch is required'),
  budget: z.string().min(1, 'Budget estimate is required')
})

type ProjectWizardForm = z.infer<typeof formSchema>

type StepConfig = {
  id: string
  title: string
  description: string
  fields: (keyof ProjectWizardForm)[]
}

const steps: StepConfig[] = [
  {
    id: 'basics',
    title: 'Basics',
    description: 'What are we building and who is it for?',
    fields: ['name', 'client']
  },
  {
    id: 'scope',
    title: 'Scope',
    description: 'Summarize the engagement and focus areas.',
    fields: ['summary', 'services']
  },
  {
    id: 'timeline',
    title: 'Timeline',
    description: 'Confirm the planned dates and budget envelope.',
    fields: ['kickoffDate', 'launchDate', 'budget']
  }
]

const defaultValues: ProjectWizardForm = {
  name: '',
  client: '',
  summary: '',
  services: '',
  kickoffDate: '',
  launchDate: '',
  budget: ''
}

export function ProjectWizard() {
  const { pushToast } = useToast()
  const [activeStep, setActiveStep] = useState(0)
  const methods = useForm<ProjectWizardForm>({
    resolver: zodResolver(formSchema),
    mode: 'onBlur',
    defaultValues
  })

  const currentStep = steps[activeStep]

  const progress = useMemo(() => ((activeStep + 1) / steps.length) * 100, [activeStep])

  const handleNext = async () => {
    const isValid = await methods.trigger(currentStep.fields)
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

  const onSubmit = methods.handleSubmit((values) => {
    pushToast({
      title: 'Project draft created',
      description: `We saved ${values.name} for ${values.client}. Share with the team to kick things off.`,
      variant: 'success'
    })
    methods.reset(defaultValues)
    setActiveStep(0)
  })

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={onSubmit}
        className="flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-base-900/50 shadow-lg shadow-base-900/40 backdrop-blur"
      >
        <div className="border-b border-white/10 bg-base-900/60 px-6 py-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-white/50">New project</p>
              <h2 className="text-lg font-semibold text-white">Guided setup</h2>
            </div>
            <span className="text-xs font-medium text-white/60">
              Step {activeStep + 1} of {steps.length}
            </span>
          </div>
          <div className="mt-4 flex gap-3">
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
                            ? 'bg-white/70'
                            : 'w-0 bg-transparent'
                      }`}
                      style={isActive ? { width: `${progress}%` } : undefined}
                    />
                  </div>
                  <p className="mt-2 text-[10px] uppercase tracking-wide text-white/50">{step.title}</p>
                </div>
              )
            })}
          </div>
        </div>

        <div className="relative flex-1 px-6 py-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="space-y-5"
            >
              <div>
                <h3 className="text-base font-semibold text-white">{currentStep.title}</h3>
                <p className="mt-1 text-sm text-white/60">{currentStep.description}</p>
              </div>

              {currentStep.fields.includes('name') ? (
                <Field id="name" label="Project name" placeholder="eg. Atlas UI Refresh" />
              ) : null}
              {currentStep.fields.includes('client') ? (
                <Field id="client" label="Client" placeholder="eg. Acme Robotics" />
              ) : null}
              {currentStep.fields.includes('summary') ? (
                <Field
                  id="summary"
                  label="Engagement summary"
                  placeholder="What outcome are we driving?"
                  multiline
                />
              ) : null}
              {currentStep.fields.includes('services') ? (
                <Field
                  id="services"
                  label="Services in scope"
                  placeholder="Brand strategy, product design, web build"
                />
              ) : null}
              {currentStep.fields.includes('kickoffDate') ? (
                <Field id="kickoffDate" label="Kickoff" type="date" />
              ) : null}
              {currentStep.fields.includes('launchDate') ? (
                <Field id="launchDate" label="Target launch" type="date" />
              ) : null}
              {currentStep.fields.includes('budget') ? (
                <Field id="budget" label="Budget estimate" placeholder="$25,000" />
              ) : null}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-white/10 bg-base-900/60 px-6 py-4">
          <button
            type="button"
            onClick={handlePrevious}
            disabled={activeStep === 0}
            className="rounded-md px-4 py-2 text-sm font-medium text-white/70 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Back
          </button>
          {activeStep === steps.length - 1 ? (
            <button
              type="submit"
              className="rounded-md px-4 py-2 text-sm font-semibold transition btn-gradient"
            >
              Create project
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
      </form>
    </FormProvider>
  )
}

type FieldProps = {
  id: keyof ProjectWizardForm
  label: string
  placeholder?: string
  type?: string
  multiline?: boolean
}

function Field({ id, label, placeholder, type = 'text', multiline = false }: FieldProps) {
  const {
    register,
    formState: { errors }
  } = useFormContext<ProjectWizardForm>()

  const error = errors[id]?.message as string | undefined

  return (
    <label className="block space-y-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-white/60">{label}</span>
      {multiline ? (
        <textarea
          {...register(id)}
          placeholder={placeholder}
          rows={4}
          className="w-full rounded-lg border border-white/10 bg-base-900/70 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
        />
      ) : (
        <input
          {...register(id)}
          type={type}
          placeholder={placeholder}
          className="w-full rounded-lg border border-white/10 bg-base-900/70 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
        />
      )}
      {error ? <span className="text-xs font-medium text-rose-300">{error}</span> : null}
    </label>
  )
}

