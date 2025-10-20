'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { AnimatePresence, motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { createBrowserClient } from '@/lib/supabase/browser'
import type { Database } from '@/types/supabase'

import { useToast } from '../../_components/toast-context'

type ClientRow = Database['public']['Tables']['clients']['Row']
type ClientDetailsCardProps = {
  client: Pick<
    ClientRow,
    'id' | 'name' | 'website' | 'notes' | 'account_status' | 'created_at' | 'updated_at'
  >
}

type FormValues = {
  name: string
  account_status: AccountStatusOption
  website: string
  notes: string
}

const ACCOUNT_STATUS_OPTIONS = ['active', 'inactive', 'invited', 'archived'] as const

type AccountStatusOption = (typeof ACCOUNT_STATUS_OPTIONS)[number]

const ACCOUNT_STATUS_LABELS: Record<AccountStatusOption, string> = {
  active: 'Active',
  inactive: 'Inactive',
  invited: 'Invited',
  archived: 'Archived'
}

const isAccountStatusOption = (value: string): value is AccountStatusOption =>
  ACCOUNT_STATUS_OPTIONS.some((option) => option === value)

const normalizeAccountStatus = (
  status: ClientRow['account_status'],
  fallback: AccountStatusOption = 'active'
): AccountStatusOption => {
  if (typeof status !== 'string') {
    return fallback
  }

  return isAccountStatusOption(status) ? status : fallback
}

const formSchema = z.object({
  name: z.string().trim().min(2, 'Client name is required'),
  account_status: z.enum(ACCOUNT_STATUS_OPTIONS, {
    errorMap: () => ({ message: 'Select a status' })
  }),
  website: z
    .string()
    .trim()
    .refine((value) => value.length === 0 || isValidUrl(value), {
      message: 'Enter a valid URL'
    }),
  notes: z.string().optional().transform((value) => value ?? '')
})

export function ClientDetailsCard({ client }: ClientDetailsCardProps) {
  const supabase = useMemo(createBrowserClient, [])
  const { pushToast } = useToast()

  const [currentClient, setCurrentClient] = useState(client)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const defaultStatus = normalizeAccountStatus(currentClient.account_status)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    mode: 'onBlur',
    defaultValues: {
      name: currentClient.name ?? '',
      account_status: defaultStatus,
      website: currentClient.website ?? '',
      notes: currentClient.notes ?? ''
    }
  })

  const { register, handleSubmit, formState, reset } = form

  const normalizedWebsite = normalizeWebsite(currentClient.website)
  const createdLabel = formatDateTime(currentClient.created_at)
  const updatedLabel = formatDateTime(currentClient.updated_at)
  const formattedStatus = formatStatus(currentClient.account_status)

  const onSubmit = handleSubmit(async (values) => {
    setIsSubmitting(true)

    const payload = {
      name: values.name.trim(),
      account_status: values.account_status,
      website: normalizeWebsiteValue(values.website),
      notes: values.notes.trim() ? values.notes.trim() : null
    }

    const { data, error } = await supabase
      .from('clients')
      .update(payload)
      .eq('id', currentClient.id)
      .select('id, name, website, notes, account_status, created_at, updated_at')
      .maybeSingle()

    if (error) {
      console.error('Failed to update client', error)
      pushToast({
        title: 'Update failed',
        description: 'We could not save these changes. Please try again.',
        variant: 'error'
      })
      setIsSubmitting(false)
      return
    }

    if (!data) {
      pushToast({
        title: 'Update failed',
        description: 'The client was not returned after saving. Please try again.',
        variant: 'error'
      })
      setIsSubmitting(false)
      return
    }

    const updatedClient = {
      ...currentClient,
      ...data
    }

    setCurrentClient(updatedClient)
    pushToast({
      title: 'Client updated',
      description: 'The latest changes have been saved.',
      variant: 'success'
    })

    setIsSubmitting(false)
    setIsModalOpen(false)
    reset(
      {
        name: updatedClient.name ?? '',
        account_status: normalizeAccountStatus(updatedClient.account_status),
        website: updatedClient.website ?? '',
        notes: updatedClient.notes ?? ''
      },
      { keepDirty: false }
    )
  })

  const handleStartEditing = () => {
    reset(
      {
        name: currentClient.name ?? '',
        account_status: normalizeAccountStatus(currentClient.account_status),
        website: currentClient.website ?? '',
        notes: currentClient.notes ?? ''
      },
      { keepDirty: false }
    )
    setIsModalOpen(true)
  }

  const handleCancelEditing = () => {
    reset(
      {
        name: currentClient.name ?? '',
        account_status: normalizeAccountStatus(currentClient.account_status),
        website: currentClient.website ?? '',
        notes: currentClient.notes ?? ''
      },
      { keepDirty: false }
    )
    setIsModalOpen(false)
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-base-900/40 p-6">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-white/60">Client details</h2>
        <button
          type="button"
          onClick={handleStartEditing}
          className="inline-flex items-center justify-center rounded-full border border-white/10 p-2 text-white/70 transition hover:border-white/30 hover:text-white"
          aria-label="Edit client details"
        >
          <EditIcon className="h-4 w-4" />
        </button>
      </div>

      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wide text-white/40">Name</dt>
          <dd className="mt-1 text-sm text-white/80">{currentClient.name}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-white/40">Status</dt>
          <dd className="mt-1 text-sm text-white/80">{formattedStatus}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-white/40">Website</dt>
          <dd className="mt-1 text-sm text-white/80">
            {normalizedWebsite ? (
              <a
                href={normalizedWebsite.href}
                target="_blank"
                rel="noreferrer"
                className="text-sky-300 transition hover:text-sky-200"
              >
                {normalizedWebsite.hostname}
              </a>
            ) : (
              '—'
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-white/40">Created</dt>
          <dd className="mt-1 text-sm text-white/80">{createdLabel}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-white/40">Last updated</dt>
          <dd className="mt-1 text-sm text-white/80">{updatedLabel}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs uppercase tracking-wide text-white/40">Notes</dt>
          <dd className="mt-1 whitespace-pre-line text-sm text-white/80">
            {currentClient.notes?.trim() ? currentClient.notes : '—'}
          </dd>
        </div>
      </dl>

      <AnimatePresence>
        {isModalOpen ? (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="w-full max-w-lg rounded-2xl border border-white/10 bg-base-900/90 p-6 shadow-xl backdrop-blur"
            >
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-base font-semibold text-white">Edit client details</h3>
                  <button
                    type="button"
                    onClick={handleCancelEditing}
                    className="rounded-full border border-white/10 p-1 text-white/60 transition hover:border-white/30 hover:text-white"
                    aria-label="Close"
                  >
                    <CloseIcon className="h-4 w-4" />
                  </button>
                </div>

                <label className="space-y-2 text-sm">
                  <span className="text-xs font-semibold uppercase tracking-wide text-white/50">Client name</span>
                  <input
                    type="text"
                    {...register('name')}
                    disabled={isSubmitting}
                    className="w-full rounded-xl border border-white/10 bg-base-900/60 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 disabled:cursor-not-allowed disabled:opacity-70"
                  />
                  {formState.errors.name ? (
                    <span className="text-xs font-medium text-rose-300">{formState.errors.name.message}</span>
                  ) : null}
                </label>

                <label className="space-y-2 text-sm">
                  <span className="text-xs font-semibold uppercase tracking-wide text-white/50">Status</span>
                  <select
                    {...register('account_status')}
                    disabled={isSubmitting}
                    className="w-full rounded-xl border border-white/10 bg-base-900/60 px-4 py-3 text-sm text-white focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {ACCOUNT_STATUS_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {ACCOUNT_STATUS_LABELS[option]}
                      </option>
                    ))}
                  </select>
                  {formState.errors.account_status ? (
                    <span className="text-xs font-medium text-rose-300">{formState.errors.account_status.message}</span>
                  ) : null}
                </label>

                <label className="space-y-2 text-sm">
                  <span className="text-xs font-semibold uppercase tracking-wide text-white/50">Website</span>
                  <input
                    type="url"
                    {...register('website')}
                    disabled={isSubmitting}
                    placeholder="https://example.com"
                    className="w-full rounded-xl border border-white/10 bg-base-900/60 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 disabled:cursor-not-allowed disabled:opacity-70"
                  />
                  {formState.errors.website ? (
                    <span className="text-xs font-medium text-rose-300">{formState.errors.website.message}</span>
                  ) : null}
                </label>

                <label className="space-y-2 text-sm">
                  <span className="text-xs font-semibold uppercase tracking-wide text-white/50">Notes</span>
                  <textarea
                    {...register('notes')}
                    disabled={isSubmitting}
                    rows={4}
                    className="w-full rounded-xl border border-white/10 bg-base-900/60 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 disabled:cursor-not-allowed disabled:opacity-70"
                  />
                  {formState.errors.notes ? (
                    <span className="text-xs font-medium text-rose-300">{formState.errors.notes.message}</span>
                  ) : null}
                </label>

                <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={handleCancelEditing}
                    disabled={isSubmitting}
                    className="inline-flex items-center justify-center rounded-full border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/70 transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-semibold transition btn-gradient disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isSubmitting ? 'Saving…' : 'Save changes'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

function formatStatus(status: ClientRow['account_status']) {
  if (!status) return 'Unknown'

  return status
    .split(/[ _]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ')
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(date)
}

function normalizeWebsite(value: string | null | undefined) {
  if (!value) return null

  try {
    return new URL(value)
  } catch (error) {
    try {
      return new URL(`https://${value}`)
    } catch (nestedError) {
      return null
    }
  }
}

function normalizeWebsiteValue(value: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed
  }

  return `https://${trimmed}`
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

type IconProps = {
  className?: string
}

function EditIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M3.75 13.875 2.5 17.5l3.625-1.25L16.25 6.125a1.767 1.767 0 0 0 0-2.5l-.875-.875a1.767 1.767 0 0 0-2.5 0L3.75 13.875Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11.25 4.625 15.375 8.75"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function CloseIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="m5.5 5.5 9 9m0-9-9 9"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
