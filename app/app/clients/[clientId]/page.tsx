import Link from 'next/link'
import { notFound } from 'next/navigation'

import { StatusBadge } from '../../_components/status-badge'
import { ClientDetailsCard } from './ClientDetailsCard'
import { createServerSupabase } from '@/lib/supabase/server'
import type { Database } from '@/types/supabase'

type ClientRow = Database['public']['Tables']['clients']['Row']

export const revalidate = 0
export const runtime = 'nodejs'

interface ClientOverviewPageProps {
  params: {
    clientId: ClientRow['id']
  }
}

type ProfileSummary = {
  id: string
  full_name: string | null
  email: string | null
}

type ClientMember = {
  id: string
  role: string | null
  created_at: string | null
  profile: ProfileSummary | null
}

type ClientContact = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string
  phone: string | null
  title: string | null
  is_primary: boolean | null
  created_at: string
  timezone: string | null
}

type ClientInvite = {
  id: string
  email: string
  created_at: string
  expires_at: string
  accepted_profile_id: string | null
  profile: ProfileSummary | null
}

const CLIENTS = 'clients' as const

type ClientProject = {
  id: string
  name: string
  status: string
  due_date: string | null
  created_at: string
  updated_at: string | null
}

type ClientDetails = {
  id: string
  name: string
  website: string | null
  notes: string | null
  account_status: Database['public']['Enums']['account_status'] | null
  created_at: string | null
  updated_at: string | null
  client_members: ClientMember[]
  contacts: ClientContact[]
  invites: ClientInvite[]
  projects: ClientProject[]
}

type ClientDetailsQuery = ClientRow & {
  client_members: Array<
    ClientMember & {
      profile: ProfileSummary | null
    }
  > | null
  contacts:
    | Array<
        (ClientContact & {
          profile: { timezone: string | null } | null
        })
      >
    | null
  invites: Array<
    ClientInvite & {
      profile: ProfileSummary | null
    }
  > | null
  projects: ClientProject[] | null
}

function formatStatus(status: string | null) {
  if (!status) return 'Unknown'

  return status
    .split(/[ _]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ')
}

function formatDate(value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(date)
}

function formatDateTime(value: string | null) {
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

function getContactName(contact: ClientContact) {
  const parts = [contact.first_name, contact.last_name].filter(Boolean)
  if (parts.length === 0) {
    return '—'
  }
  return parts.join(' ')
}

function isClientDetailsRow(value: unknown): value is ClientDetailsQuery {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'name' in value
  )
}

export default async function ClientOverviewPage({ params }: ClientOverviewPageProps) {
  const clientId: ClientRow['id'] = params.clientId
  const supabase = createServerSupabase()

  const { data, error } = await supabase
    .from(CLIENTS)
    .select(
      `
        id,
        name,
        website,
        notes,
        account_status,
        created_at,
        updated_at,
        client_members:client_members (
          id,
          role,
          created_at,
          profile:profiles!client_members_profile_id_fkey (
            id,
            full_name,
            email
          )
        ),
        contacts:contacts (
          id,
          first_name,
          last_name,
          email,
          phone,
          title,
          is_primary,
          created_at,
          profile:profiles!contacts_profile_id_fkey (
            timezone
          )
        ),
        invites:invites (
          id,
          email,
          created_at,
          expires_at,
          accepted_profile_id,
          profile:profiles!invites_accepted_profile_id_fkey (
            id,
            full_name,
            email
          )
        ),
        projects:projects (
          id,
          name,
          status,
          due_date,
          created_at,
          updated_at
        )
      `
    )
    .filter('id', 'eq', clientId)
    .returns<ClientDetailsQuery>()
    .maybeSingle()

  if (error) {
    console.error(error)
  }

  if (!isClientDetailsRow(data)) {
    notFound()
  }

  const clientRow: ClientDetailsQuery = data

  const client: ClientDetails = {
    id: clientRow.id,
    name: clientRow.name,
    website: clientRow.website ?? null,
    notes: clientRow.notes ?? null,
    account_status: clientRow.account_status ?? null,
    created_at: clientRow.created_at ?? null,
    updated_at: clientRow.updated_at ?? null,
    client_members: (clientRow.client_members ?? []).map((member) => ({
      id: member.id,
      role: member.role ?? null,
      created_at: member.created_at ?? null,
      profile: member.profile
        ? {
            id: member.profile.id,
            full_name: member.profile.full_name ?? null,
            email: member.profile.email ?? null
          }
        : null
    })),
    contacts: (clientRow.contacts ?? []).map((contact) => ({
      id: contact.id,
      first_name: contact.first_name ?? null,
      last_name: contact.last_name ?? null,
      email: contact.email,
      phone: contact.phone ?? null,
      title: contact.title ?? null,
      is_primary: contact.is_primary ?? null,
      created_at: contact.created_at,
      timezone: contact.profile?.timezone ?? null
    })),
    invites: (clientRow.invites ?? []).map((invite) => ({
      id: invite.id,
      email: invite.email,
      created_at: invite.created_at,
      expires_at: invite.expires_at,
      accepted_profile_id: invite.accepted_profile_id ?? null,
      profile: invite.profile
        ? {
            id: invite.profile.id,
            full_name: invite.profile.full_name ?? null,
            email: invite.profile.email ?? null
          }
        : null
    })),
    projects: (clientRow.projects ?? []).map((project) => ({
      id: project.id,
      name: project.name,
      status: project.status,
      due_date: project.due_date ?? null,
      created_at: project.created_at,
      updated_at: project.updated_at ?? null
    }))
  }

  const formattedStatus = formatStatus(client.account_status)

  const sortedProjects = [...(client.projects ?? [])].sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  const sortedContacts = [...(client.contacts ?? [])].sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  const sortedMembers = [...(client.client_members ?? [])].sort((a, b) => {
    const aTime = a.created_at ? new Date(a.created_at).getTime() : -Infinity
    const bTime = b.created_at ? new Date(b.created_at).getTime() : -Infinity
    return bTime - aTime
  })

  const sortedInvites = [...(client.invites ?? [])].sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3 text-sm text-white/60">
        <Link href="/app/clients" className="transition hover:text-white/90">
          Clients
        </Link>
        <span aria-hidden="true">/</span>
        <span className="text-white/80">{client.name}</span>
      </div>

      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white">{client.name}</h1>
          <p className="mt-2 text-sm text-white/65">
            Review every detail about this relationship, from project history to active collaborators and invites.
          </p>
        </div>
        <StatusBadge status={formattedStatus} />
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-base-900/50 p-4">
          <p className="text-xs uppercase tracking-wide text-white/40">Projects</p>
          <p className="mt-2 text-2xl font-semibold text-white">{sortedProjects.length}</p>
          <p className="text-xs text-white/45">Linked to this client</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-base-900/50 p-4">
          <p className="text-xs uppercase tracking-wide text-white/40">Contacts</p>
          <p className="mt-2 text-2xl font-semibold text-white">{sortedContacts.length}</p>
          <p className="text-xs text-white/45">People we collaborate with</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-base-900/50 p-4">
          <p className="text-xs uppercase tracking-wide text-white/40">Client Members</p>
          <p className="mt-2 text-2xl font-semibold text-white">{sortedMembers.length}</p>
          <p className="text-xs text-white/45">Profiles with portal access</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-base-900/50 p-4">
          <p className="text-xs uppercase tracking-wide text-white/40">Invites</p>
          <p className="mt-2 text-2xl font-semibold text-white">{sortedInvites.length}</p>
          <p className="text-xs text-white/45">Pending or completed invitations</p>
        </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-3">
        <ClientDetailsCard
          client={{
            id: client.id,
            name: client.name,
            website: client.website,
            notes: client.notes,
            account_status: client.account_status,
            created_at: client.created_at,
            updated_at: client.updated_at
          }}
        />
        <div className="rounded-2xl border border-white/10 bg-base-900/40 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-white/60">At a glance</h2>
          <ul className="mt-4 space-y-3 text-sm text-white/75">
            <li className="flex items-center justify-between">
              <span>Active projects</span>
              <span className="font-semibold text-white">{sortedProjects.filter((project) => project.status !== 'Archived').length}</span>
            </li>
            <li className="flex items-center justify-between">
              <span>Archived projects</span>
              <span className="font-semibold text-white">{sortedProjects.filter((project) => project.status === 'Archived').length}</span>
            </li>
            <li className="flex items-center justify-between">
              <span>Primary contact</span>
              <span className="font-semibold text-white">
                {(() => {
                  const primaryContact = sortedContacts.find((contact) => contact.is_primary)
                  return primaryContact ? getContactName(primaryContact) : '—'
                })()}
              </span>
            </li>
            <li className="flex items-center justify-between">
              <span>Last invite</span>
              <span className="font-semibold text-white">
                {sortedInvites[0] ? formatDate(sortedInvites[0].created_at) : '—'}
              </span>
            </li>
          </ul>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Projects</h2>
          <span className="text-sm text-white/60">{sortedProjects.length} total</span>
        </div>
        <div className="overflow-hidden rounded-2xl border border-white/10">
          {sortedProjects.length > 0 ? (
            <table className="min-w-full divide-y divide-white/10 text-left text-sm text-white/70">
              <thead className="bg-white/5 text-xs uppercase tracking-wide text-white/60">
                <tr>
                  <th className="px-5 py-3 font-medium">Project</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Due</th>
                  <th className="px-5 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {sortedProjects.map((project) => (
                  <tr key={project.id} className="bg-base-900/50">
                    <td className="px-5 py-4 text-white">{project.name}</td>
                    <td className="px-5 py-4">
                      <StatusBadge status={formatStatus(project.status)} />
                    </td>
                    <td className="px-5 py-4">{formatDate(project.due_date)}</td>
                    <td className="px-5 py-4">{formatDate(project.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="px-6 py-10 text-center text-sm text-white/50">No projects are linked to this client yet.</div>
          )}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Contacts</h2>
            <span className="text-sm text-white/60">{sortedContacts.length} total</span>
          </div>
          <div className="overflow-hidden rounded-2xl border border-white/10">
            {sortedContacts.length > 0 ? (
              <table className="min-w-full divide-y divide-white/10 text-left text-sm text-white/70">
                <thead className="bg-white/5 text-xs uppercase tracking-wide text-white/60">
                  <tr>
                    <th className="px-5 py-3 font-medium">Name</th>
                    <th className="px-5 py-3 font-medium">Email</th>
                    <th className="px-5 py-3 font-medium">Phone</th>
                    <th className="px-5 py-3 font-medium">Timezone</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {sortedContacts.map((contact) => (
                    <tr key={contact.id} className="bg-base-900/50">
                      <td className="px-5 py-4 text-white">
                        <div>{getContactName(contact)}</div>
                        <div className="text-xs text-white/50">{contact.title || '—'}</div>
                      </td>
                      <td className="px-5 py-4">
                        <Link
                          href={`mailto:${contact.email}`}
                          className="text-sky-300 transition hover:text-sky-200"
                        >
                          {contact.email}
                        </Link>
                      </td>
                      <td className="px-5 py-4">{contact.phone || '—'}</td>
                      <td className="px-5 py-4">{contact.timezone || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="px-6 py-10 text-center text-sm text-white/50">
                No contacts have been added for this client yet.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Client members &amp; invites</h2>
          </div>
          <div className="overflow-hidden rounded-2xl border border-white/10">
            {sortedMembers.length > 0 || sortedInvites.length > 0 ? (
              <table className="min-w-full divide-y divide-white/10 text-left text-sm text-white/70">
                <thead className="bg-white/5 text-xs uppercase tracking-wide text-white/60">
                  <tr>
                    <th className="px-5 py-3 font-medium">Name</th>
                    <th className="px-5 py-3 font-medium">Email</th>
                    <th className="px-5 py-3 font-medium">Role / Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {sortedMembers.map((member) => (
                    <tr key={`member-${member.id}`} className="bg-base-900/50">
                      <td className="px-5 py-4 text-white">
                        {member.profile?.full_name || '—'}
                      </td>
                      <td className="px-5 py-4">
                        {member.profile?.email ? (
                          <Link
                            href={`mailto:${member.profile.email}`}
                            className="text-sky-300 transition hover:text-sky-200"
                          >
                            {member.profile.email}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-5 py-4 capitalize">{member.role ? member.role : 'Member'}</td>
                    </tr>
                  ))}
                  {sortedInvites.map((invite) => (
                    <tr key={`invite-${invite.id}`} className="bg-base-900/30">
                      <td className="px-5 py-4 text-white">
                        {invite.profile?.full_name || 'Pending invite'}
                      </td>
                      <td className="px-5 py-4">
                        <Link
                          href={`mailto:${invite.email}`}
                          className="text-sky-300 transition hover:text-sky-200"
                        >
                          {invite.email}
                        </Link>
                      </td>
                      <td className="px-5 py-4">
                        {invite.accepted_profile_id ? 'Accepted' : `Expires ${formatDate(invite.expires_at)}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="px-6 py-10 text-center text-sm text-white/50">
                No members or invitations yet.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
