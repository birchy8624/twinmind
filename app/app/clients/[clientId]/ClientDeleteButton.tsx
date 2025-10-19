'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { deleteClient } from './actions'
import { useActiveProfile } from '../../_components/active-profile-context'
import { ConfirmModal } from '../../_components/confirm-modal'
import { useToast } from '../../_components/toast-context'

type ClientDeleteButtonProps = {
  clientId: string
  clientName: string
}

export function ClientDeleteButton({ clientId, clientName }: ClientDeleteButtonProps) {
  const { profile } = useActiveProfile()
  const { pushToast } = useToast()
  const router = useRouter()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const isOwner = profile?.role === 'owner'

  if (!isOwner) {
    return null
  }

  const handleDelete = () => {
    if (isPending) {
      return
    }

    startTransition(async () => {
      const result = await deleteClient({ clientId })

      if (!result.ok) {
        pushToast({
          title: 'Unable to delete client',
          description: result.message ?? 'Try again in a few moments.',
          variant: 'error'
        })
        return
      }

      pushToast({
        title: 'Client deleted',
        description: `${clientName} and related data have been removed.`,
        variant: 'success'
      })

      setConfirmOpen(false)
      router.push('/app/clients')
      router.refresh()
    })
  }

  const handleCancel = () => {
    if (isPending) {
      return
    }

    setConfirmOpen(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        disabled={isPending}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-white/60 transition hover:border-rose-400/60 hover:text-rose-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-base-900 disabled:cursor-not-allowed disabled:opacity-60"
        aria-label="Delete client"
      >
        <TrashIcon className="h-4 w-4" />
      </button>
      <ConfirmModal
        open={confirmOpen}
        title="Delete client?"
        description={`Are you sure you want to delete ${clientName}? This will remove all associated projects, contacts, and invoices.`}
        confirmLabel={isPending ? 'Deleting…' : 'Delete'}
        onConfirm={handleDelete}
        onCancel={handleCancel}
      />
    </>
  )
}

type IconProps = {
  className?: string
}

function TrashIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M4.75 6.5h10.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14.25 6.5v8.25a1.75 1.75 0 0 1-1.75 1.75H7.5A1.75 1.75 0 0 1 5.75 14.75V6.5m1.75 0V4.75A1.75 1.75 0 0 1 9.25 3h1.5a1.75 1.75 0 0 1 1.75 1.75V6.5m-3.5 3.5v3.5m2.5-3.5v3.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
