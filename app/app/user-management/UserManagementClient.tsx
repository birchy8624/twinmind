'use client'

import { useMemo, useState, type FormEvent, type KeyboardEvent } from 'react'

import { useToast } from '../_components/toast-context'

export type AccountAccess = {
  id: string
  name: string
  createdAt: string | null
  membershipRole: 'owner' | 'member' | null
  accessType: 'member' | 'platform-owner'
}

export type AccountMember = {
  id: string
  accountId: string
  profileId: string
  fullName: string
  email: string
  role: 'owner' | 'member'
  addedAt: string | null
}

type Props = {
  accounts: AccountAccess[]
  membersByAccount: Record<string, AccountMember[]>
}

type CreateAccountFormState = {
  name: string
  memberInput: string
  memberIds: string[]
}

const defaultFormState: CreateAccountFormState = {
  name: '',
  memberInput: '',
  memberIds: []
}

const roleLabels: Record<'owner' | 'member', string> = {
  owner: 'Owner',
  member: 'Member'
}

const formatDate = (value: string | null) => {
  if (!value) {
    return '—'
  }

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return '—'
  }

  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(parsed)
}

const toAccessLabel = (account: AccountAccess) => {
  if (account.accessType === 'platform-owner') {
    return 'Owner (platform)'
  }

  if (account.membershipRole === 'owner') {
    return 'Owner'
  }

  return 'Member'
}

export function UserManagementClient({ accounts, membersByAccount }: Props) {
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(accounts[0]?.id ?? null)
  const [formState, setFormState] = useState<CreateAccountFormState>(defaultFormState)
  const { pushToast } = useToast()

  const selectedMembers = useMemo(() => {
    if (!selectedAccountId) {
      return []
    }

    const members = membersByAccount[selectedAccountId] ?? []

    return [...members].sort((a, b) => a.fullName.localeCompare(b.fullName))
  }, [membersByAccount, selectedAccountId])

  const handleSelectAccount = (accountId: string) => {
    setSelectedAccountId(accountId)
  }

  const handleMemberInputChange = (value: string) => {
    setFormState((current) => ({
      ...current,
      memberInput: value
    }))
  }

  const handleAddMemberId = () => {
    const candidate = formState.memberInput.trim()

    if (!candidate) {
      return
    }

    setFormState((current) => ({
      ...current,
      memberInput: '',
      memberIds: current.memberIds.includes(candidate)
        ? current.memberIds
        : [...current.memberIds, candidate]
    }))
  }

  const handleMemberInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      handleAddMemberId()
      return
    }

    if (event.key === 'Backspace' && formState.memberInput.length === 0 && formState.memberIds.length > 0) {
      event.preventDefault()
      setFormState((current) => ({
        ...current,
        memberIds: current.memberIds.slice(0, -1)
      }))
    }
  }

  const handleRemoveMemberId = (value: string) => {
    setFormState((current) => ({
      ...current,
      memberIds: current.memberIds.filter((member) => member !== value)
    }))
  }

  const handleNameChange = (value: string) => {
    setFormState((current) => ({
      ...current,
      name: value
    }))
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    pushToast({
      title: 'Coming soon',
      description: 'Account creation will be wired to the database in a future update.',
      variant: 'info'
    })

    setFormState(defaultFormState)
  }

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-white/10 bg-base-900/60 p-8 shadow-lg shadow-black/20">
        <p className="text-xs uppercase tracking-[0.3em] text-white/40">Account controls</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">User manager</h1>
        <p className="mt-3 max-w-2xl text-sm text-white/70">
          Review the accounts available to you, inspect their members, and draft a new account for future onboarding.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)_minmax(0,320px)]">
        <section className="rounded-3xl border border-white/10 bg-base-900/60 p-6 shadow-lg shadow-black/20">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-white/60">Accounts I can access</h2>
          <div className="mt-4 space-y-2">
            {accounts.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-white/10 bg-base-900/40 px-4 py-6 text-sm text-white/50">
                You are not a member of any accounts yet.
              </p>
            ) : (
              accounts.map((account) => {
                const isSelected = account.id === selectedAccountId
                const accessLabel = toAccessLabel(account)

                return (
                  <button
                    key={account.id}
                    type="button"
                    onClick={() => handleSelectAccount(account.id)}
                    className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                      isSelected
                        ? 'border-white/30 bg-white/10 text-white'
                        : 'border-white/10 bg-base-900/40 text-white/70 hover:border-white/30 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{account.name}</p>
                        <p className="text-xs text-white/50">{account.createdAt ? `Created ${formatDate(account.createdAt)}` : 'Created date unknown'}</p>
                      </div>
                      <span className="inline-flex items-center rounded-full border border-white/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/70">
                        {accessLabel}
                      </span>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-base-900/60 p-6 shadow-lg shadow-black/20">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-white/60">Account members</h2>
            {selectedAccountId && (
              <span className="text-xs uppercase tracking-wide text-white/40">
                {selectedMembers.length} {selectedMembers.length === 1 ? 'member' : 'members'}
              </span>
            )}
          </div>
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full divide-y divide-white/5 text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-white/40">
                  <th className="py-3 pr-4 font-medium">Name</th>
                  <th className="py-3 pr-4 font-medium">Email</th>
                  <th className="py-3 pr-4 font-medium">Role</th>
                  <th className="py-3 pr-4 font-medium">Added At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-white/70">
                {!selectedAccountId ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-sm text-white/40">
                      Select an account to view its members.
                    </td>
                  </tr>
                ) : selectedMembers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-sm text-white/40">
                      No members found for this account.
                    </td>
                  </tr>
                ) : (
                  selectedMembers.map((member) => (
                    <tr key={member.id} className="transition hover:bg-white/5">
                      <td className="py-4 pr-4">
                        <div className="font-semibold text-white">{member.fullName}</div>
                      </td>
                      <td className="py-4 pr-4">{member.email}</td>
                      <td className="py-4 pr-4">
                        <span className="inline-flex items-center rounded-full border border-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/70">
                          {roleLabels[member.role]}
                        </span>
                      </td>
                      <td className="py-4 pr-4">{formatDate(member.addedAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-base-900/60 p-6 shadow-lg shadow-black/20">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-white/60">Create account</h2>
          <p className="mt-2 text-xs text-white/50">
            Draft the details for a new account. Submission will be enabled once the database wiring is complete.
          </p>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <label className="block space-y-2 text-sm">
              <span className="text-xs uppercase tracking-wide text-white/40">Account name</span>
              <input
                type="text"
                value={formState.name}
                onChange={(event) => handleNameChange(event.target.value)}
                placeholder="Acme Agency"
                required
                className="w-full rounded-full border border-white/10 bg-base-900/60 px-4 py-2 text-sm text-white/80 transition focus:border-white/30 focus:outline-none"
              />
            </label>

            <div className="space-y-2 text-sm">
              <span className="text-xs uppercase tracking-wide text-white/40">Member user IDs (optional)</span>
              <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-base-900/60 px-3 py-2">
                {formState.memberIds.map((memberId) => (
                  <span
                    key={memberId}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs text-white/80"
                  >
                    {memberId}
                    <button
                      type="button"
                      onClick={() => handleRemoveMemberId(memberId)}
                      className="text-white/60 transition hover:text-white"
                    >
                      ×
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  value={formState.memberInput}
                  onChange={(event) => handleMemberInputChange(event.target.value)}
                  onKeyDown={handleMemberInputKeyDown}
                  placeholder="Add user ID and press Enter"
                  className="flex-1 min-w-[180px] bg-transparent text-sm text-white/80 placeholder:text-white/40 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              className="inline-flex w-full items-center justify-center rounded-full border border-white/10 bg-white/10 px-5 py-2 text-sm font-semibold uppercase tracking-wide text-white transition hover:border-white/30 hover:bg-white/20"
            >
              Save draft
            </button>
          </form>
        </section>
      </div>
    </div>
  )
}

export default UserManagementClient
