'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { useRouter } from 'next/navigation'
import { z } from 'zod'

import { updateClientDetails } from './actions'
import { useToast } from '@/app/app/_components/toast-context'
import { TIMEZONES } from '@/utils/timezones'
import { isValidUrl } from '@/utils/url'

const formSchema = z.object({
  name: z.string().trim().min(2, 'Client name is required'),
  company: z.string().trim(),
  phone: z
    .string()
    .trim()
    .refine((value) => value.length === 0 || value.length >= 7, {
      message: 'Enter a phone number or leave blank'
    }),
  timezone: z.string().trim().min(1, 'Select a timezone'),
  website: z
    .string()
    .trim()
    .refine((value) => value.length === 0 || isValidUrl(value), {
      message: 'Enter a valid URL'
    }),
  email: z.string().trim().email('Enter a valid email')
})

type ClientDetailsFormValues = z.infer<typeof formSchema>

type ClientDetailsFormProps = {
  clientId: string
  initialName: string
  initialCompany?: string | null
  initialPhone?: string | null
  initialTimezone?: string | null
  initialWebsite?: string | null
  initialEmail?: string | null
}

export function ClientDetailsForm({
  clientId,
  initialName,
  initialCompany,
  initialPhone,
  initialTimezone,
  initialWebsite,
  initialEmail
}: ClientDetailsFormProps) {
  const { pushToast } = useToast()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const form = useForm<ClientDetailsFormValues>({
    resolver: zodResolver(formSchema),
    mode: 'onBlur',
    defaultValues: {
      name: initialName,
      company: initialCompany ?? '',
      phone: initialPhone ?? '',
      timezone: initialTimezone ?? '',
      website: initialWebsite ?? '',
      email: initialEmail ?? ''
    }
  })

  useEffect(() => {
    form.reset({
      name: initialName,
      company: initialCompany ?? '',
      phone: initialPhone ?? '',
      timezone: initialTimezone ?? '',
      website: initialWebsite ?? '',
      email: initialEmail ?? ''
    })
  }, [form, initialCompany, initialEmail, initialName, initialPhone, initialTimezone, initialWebsite])

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      try {
        const result = await updateClientDetails({
          clientId,
          name: values.name,
          company: values.company,
          phone: values.phone,
          timezone: values.timezone,
          website: values.website,
          email: values.email
        })

        if (!result.ok) {
          pushToast({
            title: 'Unable to update client',
            description: result.message ?? 'We could not save these changes. Please try again.',
            variant: 'error'
          })
          return
        }

        pushToast({
          title: 'Client details updated',
          description: 'We saved the contact information for this client.',
          variant: 'success'
        })

        form.reset(values)
        router.refresh()
      } catch (error) {
        pushToast({
          title: 'Unable to update client',
          description:
            error instanceof Error
              ? error.message
              : 'We could not save these changes. Please try again.',
          variant: 'error'
        })
      }
    })
  })

  const renderError = (field: keyof ClientDetailsFormValues) => {
    const message = form.formState.errors[field]?.message
    if (!message) {
      return null
    }

    return <span className="text-xs font-medium text-rose-300">{message}</span>
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm">
          <span className="text-xs font-semibold uppercase tracking-wide text-white/50">Client name</span>
          <input
            type="text"
            {...form.register('name')}
            className="w-full rounded-xl border border-white/10 bg-base-900/60 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
          />
          {renderError('name')}
        </label>
        <label className="space-y-2 text-sm">
          <span className="text-xs font-semibold uppercase tracking-wide text-white/50">Company</span>
          <input
            type="text"
            {...form.register('company')}
            className="w-full rounded-xl border border-white/10 bg-base-900/60 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
          />
          {renderError('company')}
        </label>
        <label className="space-y-2 text-sm">
          <span className="text-xs font-semibold uppercase tracking-wide text-white/50">Phone</span>
          <input
            type="tel"
            {...form.register('phone')}
            className="w-full rounded-xl border border-white/10 bg-base-900/60 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
          />
          {renderError('phone')}
        </label>
        <label className="space-y-2 text-sm">
          <span className="text-xs font-semibold uppercase tracking-wide text-white/50">Timezone</span>
          <select
            {...form.register('timezone')}
            className="w-full rounded-xl border border-white/10 bg-base-900/60 px-4 py-3 text-sm text-white focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
          >
            <option value="" disabled>
              Select a timezone
            </option>
            {TIMEZONES.map((timezone) => (
              <option key={timezone} value={timezone} className="bg-base-900 text-white">
                {timezone}
              </option>
            ))}
          </select>
          {renderError('timezone')}
        </label>
        <label className="space-y-2 text-sm">
          <span className="text-xs font-semibold uppercase tracking-wide text-white/50">Website</span>
          <input
            type="url"
            {...form.register('website')}
            placeholder="https://example.com"
            className="w-full rounded-xl border border-white/10 bg-base-900/60 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
          />
          {renderError('website')}
        </label>
        <label className="space-y-2 text-sm">
          <span className="text-xs font-semibold uppercase tracking-wide text-white/50">Email</span>
          <input
            type="email"
            {...form.register('email')}
            className="w-full rounded-xl border border-white/10 bg-base-900/60 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
          />
          {renderError('email')}
        </label>
      </div>
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending || !form.formState.isDirty}
          className="inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-semibold uppercase tracking-wide text-white transition disabled:cursor-not-allowed disabled:opacity-60 btn-gradient"
        >
          {isPending ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  )
}
