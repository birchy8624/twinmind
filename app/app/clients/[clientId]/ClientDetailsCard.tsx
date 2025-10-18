'use client'

import { zodResolver } from '@hookform/resolvers/zod'
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
  const [isEditing, setIsEditing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const defaultStatus: AccountStatusOption = (currentClient.account_status as AccountStatusOption) ?? 'active'

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
    setIsEditing(false)
    reset({
      name: updatedClient.name ?? '',
      account_status: updatedClient.account_status ?? 'active',
      website: updatedClient.website ?? '',
      notes: updatedClient.notes ?? ''
    }, { keepDirty: false })
  })

  const handleStartEditing = () => {
    reset({
      name: currentClient.name ?? '',
      account_status: currentClient.account_status ?? 'active',
      website: currentClient.website ?? '',
      notes: currentClient.notes ?? ''
    }, { keepDirty: false })
    setIsEditing(true)
  }

  const handleCancelEditing = () => {
    reset({
      name: currentClient.name ?? '',
      account_status: currentClient.account_status ?? 'active',
      website: currentClient.website ?? '',
      notes: currentClient.notes ?? ''
    }, { keepDirty: false })
    setIsEditing(false)
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-base-900/40 p-6">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-white/60">Client details</h2>
        {isEditing ? null : (
          <button
            type="button"
            onClick={handleStartEditing}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/70 transition hover:border-white/30 hover:text-white"
          >
            Edit
          </button>
        )}
      </div>

      {isEditing ? (
        <form onSubmit={onSubmit} className="mt-4 space-y-4">
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
      ) : (
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
      )}
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
