import { redirect } from 'next/navigation'
import type { User } from '@supabase/supabase-js'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { createServerSupabase } from '@/lib/supabase/server'
import type { Database } from '@/types/supabase'

import UserManagementClient, {
  type WorkspaceUserRecord,
  type WorkspaceUserStatus
} from './UserManagementClient'

type RoleEnum = Database['public']['Enums']['account_role']

type ProfileRow = Database['public']['Tables']['profiles']['Row']
type ProfilePreview = Pick<ProfileRow, 'id' | 'full_name' | 'role' | 'email' | 'company'>

type MetadataRecord = Record<string, unknown> | undefined

type AccountMembershipSelection = {
  account_id: string | null
  role: RoleEnum | null
  profile_id: string
  profiles: ProfilePreview | null
}

const resolveMetadataName = (metadata: MetadataRecord) => {
  if (!metadata) {
    return null
  }

  const candidates: unknown[] = [
    metadata['full_name'],
    metadata['name'],
    metadata['first_name'],
    metadata['last_name']
  ]

  const resolved = candidates
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean)

  if (resolved.length === 0) {
    return null
  }

  if (resolved[0] && resolved[1] && !resolved[0]?.includes(' ')) {
    return `${resolved[0]} ${resolved[1]}`.trim()
  }

  return resolved[0]
}

const resolveMetadataRole = (metadata: MetadataRecord): RoleEnum | null => {
  if (!metadata) {
    return null
  }

  const keys = ['role', 'title', 'position']

  for (const key of keys) {
    const value = metadata[key]
    if (typeof value !== 'string') {
      continue
    }

    const normalized = value.trim().toLowerCase()

    if (normalized === 'owner' || normalized === 'member') {
      return normalized as RoleEnum
    }
  }

  return null
}

const toWorkspaceStatus = (user: User): WorkspaceUserStatus => {
  if (user.confirmed_at || user.last_sign_in_at) {
    return 'active'
  }

  return 'invited'
}

type MembershipRow = {
  profile_id: string
  role: RoleEnum
  profiles: ProfilePreview | null
}

const toWorkspaceRecord = (
  membership: MembershipRow,
  user: User | undefined
): WorkspaceUserRecord => {
  const profile = membership.profiles ?? undefined
  const metadataName = user ? resolveMetadataName(user.user_metadata) : null
  const metadataRole = user ? resolveMetadataRole(user.user_metadata) : null

  const fullName = profile?.full_name?.trim() || metadataName || user?.email || profile?.email || 'Workspace member'
  const role = membership.role ?? profile?.role ?? metadataRole ?? 'member'
  const createdAt = user?.created_at ?? null
  const lastSignInAt = user?.last_sign_in_at ?? null
  const status = user ? toWorkspaceStatus(user) : 'invited'
  const email = profile?.email?.trim() || user?.email || 'Unknown email'

  return {
    id: membership.profile_id,
    email,
    fullName,
    company: profile?.company ?? null,
    role,
    createdAt,
    lastSignInAt,
    status
  }
}

export default async function UserManagementPage() {
  const supabase = createServerSupabase()
  const {
    data: { user: currentUser }
  } = await supabase.auth.getUser()

  if (!currentUser) {
    redirect('/sign_in')
  }

  const {
    data: membershipRows,
    error: membershipError
  } = await supabase
    .from('account_members')
    .select('account_id, role, profile_id, created_at, profiles:profile_id ( id, full_name, role, email, company )')
    .eq('profile_id', currentUser.id)
    .order('created_at', { ascending: true })

  if (membershipError) {
    console.error('Failed to load current membership:', membershipError)
    redirect('/app')
  }

  const typedMembershipRows = (membershipRows ?? []) as AccountMembershipSelection[]
  const activeMembership = typedMembershipRows.find((row) => row.role === 'owner') ?? typedMembershipRows[0]

  if (!activeMembership || activeMembership.role !== 'owner' || !activeMembership.account_id) {
    redirect('/app')
  }

  const accountId = activeMembership.account_id

  const admin = supabaseAdmin()

  const [{ data: userData, error: usersError }, { data: accountMembersData, error: accountMembersError }] = await Promise.all([
    admin.auth.admin.listUsers({ perPage: 200 }),
    admin
      .from('account_members')
      .select('profile_id, role, profiles:profile_id ( id, full_name, role, email, company )')
      .eq('account_id', accountId)
  ])

  if (usersError) {
    console.error('Failed to load Supabase users:', usersError)
  }

  if (accountMembersError) {
    console.error('Failed to load account members:', accountMembersError)
  }

  const profileMap = new Map<string, MembershipRow>()

  const typedAccountMembers = (accountMembersData ?? []) as Array<{
    profile_id: string
    role: RoleEnum | null
    profiles: ProfilePreview | null
  }>

  typedAccountMembers.forEach((row) => {
    profileMap.set(row.profile_id, {
      profile_id: row.profile_id,
      role: row.role ?? 'member',
      profiles: row.profiles ?? null
    })
  })

  const authUsers = userData?.users ?? []
  const authUserMap = new Map<string, User>()

  authUsers.forEach((user) => {
    authUserMap.set(user.id, user)
  })

  const workspaceUsers = Array.from(profileMap.values())
    .map((membership) => toWorkspaceRecord(membership, authUserMap.get(membership.profile_id)))
    .sort((a, b) => a.fullName.localeCompare(b.fullName))

  return (
    <UserManagementClient currentUserId={currentUser.id} initialUsers={workspaceUsers} />
  )
}
