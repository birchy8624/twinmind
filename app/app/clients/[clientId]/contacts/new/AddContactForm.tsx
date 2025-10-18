'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useRouter } from 'next/navigation'
import { z } from 'zod'

import { createContact } from './actions'

import { useToast } from '../../../_components/toast-context'

const contactFormSchema = z.object({
  firstName: z.string().trim().min(2, 'First name is required'),
  lastName: z.string().trim().min(2, 'Last name is required'),
  email: z.string().trim().email('Enter a valid email address'),
  phone: z
    .string()
    .trim()
    .optional()
    .transform((value) => value ?? '')
    .refine((value) => value.length === 0 || value.length >= 7, {
      message: 'Enter at least 7 digits or leave blank'
    }),
  title: z
    .string()
    .trim()
    .optional()
    .transform((value) => value ?? ''),
  isPrimary: z.boolean().default(false)
})

export type ContactFormValues = z.infer<typeof contactFormSchema>

const defaultValues: ContactFormValues = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  title: '',
  isPrimary: false
}

type AddContactFormProps = {
  clientId: string
  clientName: string
}

export function AddContactForm({ clientId, clientName }: AddContactFormProps) {
  const router = useRouter()
  const { pushToast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues
  })

  const onSubmit = handleSubmit(async (values) => {
    setIsSubmitting(true)

    const result = await createContact({
      clientId,
      firstName: values.firstName,
      lastName: values.lastName,
      email: values.email,
      phone: values.phone,
      title: values.title,
      isPrimary: values.isPrimary
    })

    if (!result.ok) {
      pushToast({
        title: 'Unable to add contact',
        description: result.message,
        variant: 'error'
      })
      setIsSubmitting(false)
      return
    }

    pushToast({
      title: 'Contact added',
      description: `${values.firstName} has been added to ${clientName}.`
    })

    reset()
    router.push(`/app/clients/${clientId}`)
  })

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-white">Add contact</h1>
          <p className="text-sm text-white/65">Link another point of contact to {clientName}.</p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <label className="space-y-2 text-sm text-white/80">
            <span className="text-xs uppercase tracking-wide text-white/50">First name</span>
            <input
              type="text"
              {...register('firstName')}
              className="w-full rounded-lg border border-white/10 bg-base-900/60 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
              placeholder="Sarah"
              autoComplete="given-name"
            />
            {errors.firstName ? (
              <span className="block text-xs font-medium text-rose-300">{errors.firstName.message}</span>
            ) : null}
          </label>

          <label className="space-y-2 text-sm text-white/80">
            <span className="text-xs uppercase tracking-wide text-white/50">Last name</span>
            <input
              type="text"
              {...register('lastName')}
              className="w-full rounded-lg border border-white/10 bg-base-900/60 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
              placeholder="Connor"
              autoComplete="family-name"
            />
            {errors.lastName ? (
              <span className="block text-xs font-medium text-rose-300">{errors.lastName.message}</span>
            ) : null}
          </label>

          <label className="space-y-2 text-sm text-white/80">
            <span className="text-xs uppercase tracking-wide text-white/50">Email</span>
            <input
              type="email"
              {...register('email')}
              className="w-full rounded-lg border border-white/10 bg-base-900/60 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
              placeholder="sarah@example.com"
              autoComplete="email"
            />
            {errors.email ? (
              <span className="block text-xs font-medium text-rose-300">{errors.email.message}</span>
            ) : null}
          </label>

          <label className="space-y-2 text-sm text-white/80">
            <span className="text-xs uppercase tracking-wide text-white/50">Phone</span>
            <input
              type="tel"
              {...register('phone')}
              className="w-full rounded-lg border border-white/10 bg-base-900/60 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
              placeholder="+1 415 555 0100"
              autoComplete="tel"
            />
            {errors.phone ? (
              <span className="block text-xs font-medium text-rose-300">{errors.phone.message}</span>
            ) : null}
          </label>

          <label className="space-y-2 text-sm text-white/80 md:col-span-2">
            <span className="text-xs uppercase tracking-wide text-white/50">Title</span>
            <input
              type="text"
              {...register('title')}
              className="w-full rounded-lg border border-white/10 bg-base-900/60 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
              placeholder="Director of Product"
              autoComplete="organization-title"
            />
            {errors.title ? (
              <span className="block text-xs font-medium text-rose-300">{errors.title.message}</span>
            ) : null}
          </label>
        </div>
      </div>

      <label className="flex items-center gap-3 text-sm text-white/75">
        <input
          type="checkbox"
          {...register('isPrimary')}
          className="h-4 w-4 rounded border-white/25 bg-base-900/70 text-sky-400 focus:ring-sky-400"
        />
        <span>Set as primary contact</span>
      </label>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-full border border-white/10 px-6 py-2 text-sm font-semibold uppercase tracking-wide text-white transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? 'Saving…' : 'Add contact'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="text-sm font-semibold text-white/60 transition hover:text-white/80"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
