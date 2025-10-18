import { redirect } from 'next/navigation'
import type { User } from '@supabase/supabase-js'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { createServerSupabase } from '@/lib/supabase/server'
import type { Database } from '@/types/supabase'

import UserManagementClient, {
  type WorkspaceUserRecord,
  type WorkspaceUserStatus
} from './UserManagementClient'

type RoleEnum = Database['public']['Enums']['role']

type ProfileRow = Database['public']['Tables']['profiles']['Row']
type ProfilePreview = Pick<ProfileRow, 'id' | 'full_name' | 'role' | 'email' | 'company'>

type MetadataRecord = Record<string, unknown> | undefined

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

    if (normalized === 'owner' || normalized === 'client') {
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

const toWorkspaceRecord = (user: User, profile: ProfilePreview | undefined): WorkspaceUserRecord => {
  const metadataName = resolveMetadataName(user.user_metadata)
  const metadataRole = resolveMetadataRole(user.user_metadata)

  const fullName = profile?.full_name?.trim() || metadataName || user.email || 'Workspace member'
  const role = profile?.role ?? metadataRole ?? 'client'

  return {
    id: user.id,
    email: user.email ?? 'Unknown email',
    fullName,
    company: profile?.company ?? null,
    role,
    createdAt: user.created_at,
    lastSignInAt: user.last_sign_in_at,
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

  const admin = supabaseAdmin()

  const [{ data: userData, error: usersError }, { data: profileRows, error: profilesError }] = await Promise.all([
    admin.auth.admin.listUsers({ perPage: 200 }),
    admin.from('profiles').select('id, full_name, role, email, company')
  ])

  if (usersError) {
    console.error('Failed to load Supabase users:', usersError)
  }

  if (profilesError) {
    console.error('Failed to load workspace profiles:', profilesError)
  }

  const profileMap = new Map<string, ProfilePreview>()

  profileRows?.forEach((row) => {
    profileMap.set(row.id, row)
  })

  const authUsers = userData?.users ?? []

  const workspaceUsers = authUsers
    .map((user) => toWorkspaceRecord(user, profileMap.get(user.id)))
    .sort((a, b) => a.fullName.localeCompare(b.fullName))

  return (
    <UserManagementClient currentUserId={currentUser.id} initialUsers={workspaceUsers} />
  )
}
