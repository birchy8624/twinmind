import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { User } from '@supabase/supabase-js'

import { ACTIVE_ACCOUNT_COOKIE, isAccountRoleAtLeast } from '@/lib/active-account'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { createServerSupabase } from '@/lib/supabase/server'
import type { Database } from '@/types/supabase'

import UserManagementClient, {
  type WorkspaceUserRecord,
  type WorkspaceUserStatus
} from './UserManagementClient'

type AccountRole = Database['public']['Enums']['account_role']

type ProfileRow = Database['public']['Tables']['profiles']['Row']
type AccountMemberRow = Database['public']['Tables']['account_members']['Row']

type MetadataRecord = Record<string, unknown> | undefined

type AccountMemberWithProfile = AccountMemberRow & {
  profiles: Pick<ProfileRow, 'id' | 'full_name' | 'email' | 'company'> | null
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

const toWorkspaceStatus = (user: User | undefined): WorkspaceUserStatus => {
  if (!user) {
    return 'invited'
  }

  if (user.confirmed_at || user.last_sign_in_at) {
    return 'active'
  }

  return 'invited'
}

const toWorkspaceRecord = (
  membership: AccountMemberWithProfile,
  user: User | undefined
): WorkspaceUserRecord => {
  const profile = membership.profiles
  const metadataName = resolveMetadataName(user?.user_metadata)
  const fullName = profile?.full_name?.trim() || metadataName || user?.email || 'Workspace member'
  const email = profile?.email?.trim() || user?.email || 'Unknown email'

  return {
    id: membership.profile_id,
    email,
    fullName,
    company: profile?.company ?? null,
    role: membership.role ?? 'member',
    createdAt: user?.created_at ?? null,
    lastSignInAt: user?.last_sign_in_at ?? null,
    status: toWorkspaceStatus(user)
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

  const cookieStore = cookies()
  const storedAccountId = cookieStore.get(ACTIVE_ACCOUNT_COOKIE)?.value?.trim() ?? null

  const { data: membershipRows, error: membershipsError } = await supabase
    .from('account_members')
    .select('account_id, role')
    .eq('profile_id', currentUser.id)

  if (membershipsError) {
    console.error('Failed to load account memberships:', membershipsError)
  }

  const memberships = (membershipRows ?? []) as Array<Pick<AccountMemberRow, 'account_id' | 'role'>>
  const membershipMap = new Map(memberships.map((membership) => [membership.account_id, membership]))

  let activeAccountId = storedAccountId && membershipMap.has(storedAccountId)
    ? storedAccountId
    : memberships[0]?.account_id ?? null

  if (!activeAccountId) {
    redirect('/app/setup-account')
  }

  const activeMembership = membershipMap.get(activeAccountId) ?? null

  if (!isAccountRoleAtLeast(activeMembership?.role, 'owner')) {
    redirect('/app/dashboard')
  }

  const { data: accountMemberRows, error: accountMembersError } = await supabase
    .from('account_members')
    .select('profile_id, role, profiles:profile_id ( id, full_name, email, company )')
    .eq('account_id', activeAccountId)

  if (accountMembersError) {
    console.error('Failed to load workspace members:', accountMembersError)
  }

  const typedMembers = (accountMemberRows ?? []) as AccountMemberWithProfile[]
  const admin = supabaseAdmin()

  const { data: userData, error: usersError } = await admin.auth.admin.listUsers({ perPage: 200 })

  if (usersError) {
    console.error('Failed to load Supabase users:', usersError)
  }

  const authUsers = userData?.users ?? []
  const userMap = new Map<string, User>()
  authUsers.forEach((user) => {
    if (user.id) {
      userMap.set(user.id, user)
    }
  })

  const workspaceUsers = typedMembers
    .map((membership) => toWorkspaceRecord(membership, userMap.get(membership.profile_id)))
    .sort((a, b) => a.fullName.localeCompare(b.fullName))

  return (
    <UserManagementClient
      accountId={activeAccountId}
      currentUserId={currentUser.id}
      currentUserRole={activeMembership.role as AccountRole}
      initialUsers={workspaceUsers}
    />
  )
}
