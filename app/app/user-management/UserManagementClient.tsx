'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import type { Database } from '@/types/supabase'

import { createWorkspaceUser, sendWorkspacePasswordReset, updateWorkspaceUserRole } from './actions'
import { useToast } from '../_components/toast-context'

export type WorkspaceUserStatus = 'active' | 'invited'

type AccountRole = Database['public']['Enums']['account_role']

export type WorkspaceUserRecord = {
  id: string
  email: string
  fullName: string
  company: string | null
  role: AccountRole
  createdAt: string | null
  lastSignInAt: string | null
  status: WorkspaceUserStatus
}

type Props = {
  accountId: string
  currentUserId: string
  currentUserRole: AccountRole
  initialUsers: WorkspaceUserRecord[]
}

type NewUserFormState = {
  email: string
  fullName: string
  sendInvite: boolean
}

type RoleFilter = 'all' | AccountRole

type StatusFilter = 'all' | WorkspaceUserStatus

const defaultFormState: NewUserFormState = {
  email: '',
  fullName: '',
  sendInvite: true
}

const statusLabels: Record<WorkspaceUserStatus, string> = {
  active: 'Active',
  invited: 'Invited'
}

const roleLabels: Record<AccountRole, string> = {
  owner: 'Owner',
  member: 'Member'
}

const formatDate = (value: string | null) => {
  if (!value) {
    return '—'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '—'
  }

  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(date)
}

const formatRelativeTime = (value: string | null) => {
  if (!value) {
    return 'Never'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '—'
  }

  const diffMs = Date.now() - date.getTime()

  if (diffMs < 30 * 1000) {
    return 'Just now'
  }

  const minutes = Math.floor(diffMs / 60000)

  if (minutes < 60) {
    return `${minutes}m ago`
  }

  const hours = Math.floor(minutes / 60)

  if (hours < 24) {
    return `${hours}h ago`
  }

  const days = Math.floor(hours / 24)

  if (days < 7) {
    return `${days}d ago`
  }

  const weeks = Math.floor(days / 7)

  if (weeks < 5) {
    return `${weeks}w ago`
  }

  const months = Math.floor(days / 30)

  if (months < 12) {
    return `${months}mo ago`
  }

  const years = Math.floor(days / 365)

  return `${years}y ago`
}

export function UserManagementClient({ accountId, currentUserId, currentUserRole, initialUsers }: Props) {
  const router = useRouter()
  const { pushToast } = useToast()
  const users = initialUsers
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [formState, setFormState] = useState<NewUserFormState>(defaultFormState)
  const [isCreating, startCreateTransition] = useTransition()
  const [roleMutationId, setRoleMutationId] = useState<string | null>(null)
  const [resetMutationId, setResetMutationId] = useState<string | null>(null)

  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    return users.filter((user) => {
      if (roleFilter !== 'all' && user.role !== roleFilter) {
        return false
      }

      if (statusFilter !== 'all' && user.status !== statusFilter) {
        return false
      }

      if (!query) {
        return true
      }

      const haystacks = [user.fullName, user.email, user.company ?? '']
      return haystacks.some((value) => value.toLowerCase().includes(query))
    })
  }, [roleFilter, searchQuery, statusFilter, users])

  const ownerCount = useMemo(() => users.filter((user) => user.role === 'owner').length, [users])
  const invitedCount = useMemo(() => users.filter((user) => user.status === 'invited').length, [users])

  const handleInputChange = <Key extends keyof NewUserFormState>(key: Key, value: NewUserFormState[Key]) => {
    setFormState((current) => ({
      ...current,
      [key]: value
    }))
  }

  const handleCreateUser = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!accountId) {
      pushToast({
        title: 'No active workspace',
        description: 'Select a workspace before inviting members.',
        variant: 'error'
      })
      return
    }

    if (currentUserRole !== 'owner') {
      pushToast({
        title: 'Insufficient permissions',
        description: 'Only workspace owners can add members.',
        variant: 'error'
      })
      return
    }

    const trimmedName = formState.fullName.trim()

    const payload = {
      accountId,
      email: formState.email.trim(),
      fullName: trimmedName ? trimmedName : undefined,
      sendInvite: formState.sendInvite
    }

    startCreateTransition(async () => {
      const result = await createWorkspaceUser(payload)

      if (!result.ok) {
        pushToast({
          title: 'Unable to add user',
          description: result.message ?? 'Try again in a few moments.',
          variant: 'error'
        })
        return
      }

      pushToast({
        title: 'User added',
        description: formState.sendInvite
          ? 'They will receive an invite email shortly.'
          : 'The user has been created without an invitation email.',
        variant: 'success'
      })

      setFormState(defaultFormState)
      router.refresh()
    })
  }

  const handleRoleChange = (userId: string) => {
    if (!accountId) {
      pushToast({
        title: 'No active workspace',
        description: 'Select a workspace before updating roles.',
        variant: 'error'
      })
      return
    }

    if (currentUserRole !== 'owner') {
      pushToast({
        title: 'Insufficient permissions',
        description: 'Only workspace owners can manage roles.',
        variant: 'error'
      })
      return
    }

    const targetRole: AccountRole = 'owner'
    setRoleMutationId(`${userId}-${targetRole}`)

    void updateWorkspaceUserRole({ profileId: userId, role: targetRole, accountId })
      .then((result) => {
        if (!result.ok) {
          pushToast({
            title: 'Unable to update role',
            description: result.message ?? 'Try again in a few moments.',
            variant: 'error'
          })
        } else {
          pushToast({
            title: 'Role updated',
            description: 'User is now an owner.',
            variant: 'success'
          })
          router.refresh()
        }
      })
      .finally(() => setRoleMutationId(null))
  }

  const handlePasswordReset = (userId: string, email: string) => {
    setResetMutationId(userId)

    void sendWorkspacePasswordReset({ email })
      .then((result) => {
        if (!result.ok) {
          pushToast({
            title: 'Unable to send reset email',
            description: result.message ?? 'Try again later.',
            variant: 'error'
          })
        } else {
          pushToast({
            title: 'Reset email sent',
            description: 'The user will receive password reset instructions.',
            variant: 'success'
          })
        }
      })
      .finally(() => setResetMutationId(null))
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-base-900/60 p-8 shadow-lg shadow-black/20">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-white/40">Workspace controls</p>
              <h1 className="mt-2 text-2xl font-semibold text-white">User management</h1>
              <p className="mt-3 max-w-2xl text-sm text-white/70">
                Invite collaborators, promote workspace owners, and keep access up-to-date without leaving Twinmind.
              </p>
            </div>
            <dl className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-base-900/40 px-4 py-3 text-sm text-white/70">
                <dt className="text-xs uppercase tracking-wide text-white/40">Total members</dt>
                <dd className="mt-1 text-xl font-semibold text-white">{users.length}</dd>
              </div>
              <div className="rounded-2xl border border-white/10 bg-base-900/40 px-4 py-3 text-sm text-white/70">
                <dt className="text-xs uppercase tracking-wide text-white/40">Owners</dt>
                <dd className="mt-1 text-xl font-semibold text-white">{ownerCount}</dd>
              </div>
              <div className="rounded-2xl border border-white/10 bg-base-900/40 px-4 py-3 text-sm text-white/70">
                <dt className="text-xs uppercase tracking-wide text-white/40">Pending invites</dt>
                <dd className="mt-1 text-xl font-semibold text-white">{invitedCount}</dd>
              </div>
            </dl>
          </div>
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-base-900/40 p-6 text-white/70">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-white/60">Add workspace member</h2>
            <form onSubmit={handleCreateUser} className="mt-4 space-y-4">
              <label className="block space-y-1 text-sm">
                <span className="text-xs uppercase tracking-wide text-white/40">Full name</span>
                <input
                  type="text"
                  value={formState.fullName}
                  onChange={(event) => handleInputChange('fullName', event.target.value)}
                  required
                  className="w-full rounded-full border border-white/10 bg-base-900/60 px-4 py-2 text-sm text-white/80 transition focus:border-white/30 focus:outline-none"
                  placeholder="Ada Lovelace"
                />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="text-xs uppercase tracking-wide text-white/40">Email address</span>
                <input
                  type="email"
                  value={formState.email}
                  onChange={(event) => handleInputChange('email', event.target.value)}
                  required
                  className="w-full rounded-full border border-white/10 bg-base-900/60 px-4 py-2 text-sm text-white/80 transition focus:border-white/30 focus:outline-none"
                  placeholder="ada@company.com"
                />
              </label>
              <p className="text-xs text-white/50">New members start with workspace access as collaborators.</p>
              <label className="flex items-center gap-3 text-sm text-white/70">
                <input
                  type="checkbox"
                  checked={formState.sendInvite}
                  onChange={(event) => handleInputChange('sendInvite', event.target.checked)}
                  className="h-4 w-4 rounded border border-white/30 bg-base-900/80 text-white focus:outline-none"
                />
                Send invitation email immediately
              </label>
              <button
                type="submit"
                disabled={isCreating}
                className="inline-flex w-full items-center justify-center rounded-full border border-white/10 bg-white/10 px-5 py-2 text-sm font-semibold uppercase tracking-wide text-white transition hover:border-white/30 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCreating ? 'Adding...' : 'Add user'}
              </button>
            </form>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-base-900/60 p-6 shadow-lg shadow-black/20">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-3">
            <label className="flex w-full items-center gap-3 rounded-full border border-white/10 bg-base-900/60 px-4 py-2 text-sm text-white/70 shadow-sm shadow-base-900/30 focus-within:border-white/30 focus-within:text-white/80 sm:w-auto">
              <span className="text-xs uppercase tracking-wide text-white/30">Search</span>
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Name or email"
                className="w-full bg-transparent text-sm text-white/80 placeholder:text-white/40 focus:outline-none"
              />
            </label>
            <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-base-900/40 p-1 text-xs font-semibold text-white/60">
              {([
                ['all', 'All roles'],
                ['owner', 'Owners'],
                ['member', 'Members']
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRoleFilter(value)}
                  className={`rounded-full px-3 py-1 transition ${roleFilter === value ? 'bg-white/10 text-white' : 'hover:text-white'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-base-900/40 p-1 text-xs font-semibold text-white/60">
              {([
                ['all', 'All statuses'],
                ['active', 'Active'],
                ['invited', 'Invited']
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStatusFilter(value)}
                  className={`rounded-full px-3 py-1 transition ${statusFilter === value ? 'bg-white/10 text-white' : 'hover:text-white'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs uppercase tracking-wide text-white/40">{filteredUsers.length} users shown</p>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full divide-y divide-white/5 text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-white/40">
                <th className="py-3 pr-4 font-medium">Name</th>
                <th className="py-3 pr-4 font-medium">Email</th>
                <th className="py-3 pr-4 font-medium">Role</th>
                <th className="py-3 pr-4 font-medium">Last active</th>
                <th className="py-3 pr-4 font-medium">Status</th>
                <th className="py-3 pr-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-white/70">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-sm text-white/40">
                    No users match the current filters.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const roleMutationKeyOwner = `${user.id}-owner`
                  const isRoleLoading = roleMutationId === roleMutationKeyOwner
                  const isResetLoading = resetMutationId === user.id
                  const canPromoteToOwner = user.role !== 'owner' && user.id !== currentUserId

                  return (
                    <tr key={user.id} className="transition hover:bg-white/5">
                      <td className="py-4 pr-4">
                        <div className="font-semibold text-white">{user.fullName}</div>
                        {user.company ? <div className="text-xs text-white/40">{user.company}</div> : null}
                      </td>
                      <td className="py-4 pr-4">
                        <div>{user.email}</div>
                        <div className="text-xs text-white/40">Joined {formatDate(user.createdAt)}</div>
                      </td>
                      <td className="py-4 pr-4">
                        <span className="inline-flex items-center rounded-full border border-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/70">
                          {roleLabels[user.role]}
                        </span>
                      </td>
                      <td className="py-4 pr-4">
                        <div>{formatRelativeTime(user.lastSignInAt)}</div>
                      </td>
                      <td className="py-4 pr-4">
                        <span
                          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                            user.status === 'active'
                              ? 'border-emerald-500/40 text-emerald-300'
                              : 'border-amber-400/30 text-amber-200'
                          }`}
                        >
                          {statusLabels[user.status]}
                        </span>
                      </td>
                      <td className="py-4 text-right">
                        <div className="flex flex-col items-end gap-2">
                          <div className="inline-flex items-center gap-2">
                            {canPromoteToOwner ? (
                              <button
                                type="button"
                                className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/70 transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                                onClick={() => handleRoleChange(user.id)}
                                disabled={isRoleLoading}
                              >
                                Make owner
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/70 transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                              onClick={() => handlePasswordReset(user.id, user.email)}
                              disabled={isResetLoading}
                            >
                              Reset password
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

export default UserManagementClient
