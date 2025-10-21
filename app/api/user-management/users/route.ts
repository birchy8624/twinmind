import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import type { User } from '@supabase/supabase-js'
import { z } from 'zod'

import { createServerSupabase } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import type { Database } from '@/types/supabase'
import type {
  WorkspaceUserRecord,
  WorkspaceUserStatus
} from '@/app/app/user-management/UserManagementClient'

export const runtime = 'nodejs'

type RoleEnum = Database['public']['Enums']['role_enum']

type ProfileRow = Database['public']['Tables']['profiles']['Row']
type ProfilePreview = Pick<ProfileRow, 'id' | 'full_name' | 'role' | 'email' | 'company'>

const resolveMetadataName = (metadata: Record<string, unknown> | undefined) => {
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

const resolveMetadataRole = (
  metadata: Record<string, unknown> | undefined
): RoleEnum | null => {
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

const toWorkspaceRecord = (
  user: User,
  profile: ProfilePreview | undefined
): WorkspaceUserRecord => {
  const metadataName = resolveMetadataName(user.user_metadata)
  const metadataRole = resolveMetadataRole(user.user_metadata)

  const fullName = profile?.full_name?.trim() || metadataName || user.email || 'Workspace member'
  const role = profile?.role ?? metadataRole ?? 'owner'

  return {
    id: user.id,
    email: user.email ?? 'Unknown email',
    fullName,
    company: profile?.company ?? null,
    role,
    createdAt: user.created_at,
    lastSignInAt: user.last_sign_in_at ?? null,
    status: toWorkspaceStatus(user)
  }
}

const createUserSchema = z.object({
  email: z.string().email(),
  fullName: z
    .string()
    .trim()
    .min(1, 'Full name is required')
    .max(120, 'Full name is too long')
    .optional()
    .transform((value) => (value && value.trim().length > 0 ? value.trim() : undefined)),
  sendInvite: z.boolean().default(true)
})

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : 'http://localhost:3000')

const setupAccountRedirect = (() => {
  try {
    return new URL('/app/setup-account', siteUrl).toString()
  } catch (error) {
    console.error('Failed to construct setup account redirect URL', error)
    return null
  }
})()

export async function GET() {
  const supabase = createServerSupabase()
  const {
    data: { user: currentUser }
  } = await supabase.auth.getUser()

  if (!currentUser) {
    return NextResponse.json({ message: 'Not authenticated.' }, { status: 401 })
  }

  const admin = supabaseAdmin()

  const [{ data: userData, error: usersError }, { data: profileRows, error: profilesError }] =
    await Promise.all([
      admin.auth.admin.listUsers({ perPage: 200 }),
      admin.from('profiles').select('id, full_name, role, email, company')
    ])

  if (usersError) {
    console.error('Failed to load Supabase users:', usersError)
    return NextResponse.json(
      { message: 'Unable to load workspace users.' },
      { status: 500 }
    )
  }

  if (profilesError) {
    console.error('Failed to load workspace profiles:', profilesError)
    return NextResponse.json(
      { message: 'Unable to load workspace profiles.' },
      { status: 500 }
    )
  }

  const profileMap = new Map<string, ProfilePreview>()

  profileRows?.forEach((row) => {
    profileMap.set(row.id, row)
  })

  const authUsers = userData?.users ?? []

  const workspaceUsers = authUsers
    .map((user) => toWorkspaceRecord(user, profileMap.get(user.id)))
    .sort((a, b) => a.fullName.localeCompare(b.fullName))

  return NextResponse.json({ currentUserId: currentUser.id, users: workspaceUsers })
}

type ProfilesTable = Database['public']['Tables']['profiles']

export async function POST(request: Request) {
  let payload: unknown

  try {
    payload = await request.json()
  } catch (error) {
    console.error('Failed to parse create workspace user payload:', error)
    return NextResponse.json({ message: 'Invalid user details provided.' }, { status: 400 })
  }

  const parsed = createUserSchema.safeParse(payload)

  if (!parsed.success) {
    return NextResponse.json({ message: 'Invalid user details provided.' }, { status: 400 })
  }

  const { email, fullName, sendInvite } = parsed.data

  const supabase = createServerSupabase()
  const {
    data: { user: currentUser }
  } = await supabase.auth.getUser()

  if (!currentUser) {
    return NextResponse.json({ message: 'Not authenticated.' }, { status: 401 })
  }

  const assignedRole: ProfilesTable['Row']['role'] = 'owner'

  const admin = supabaseAdmin()

  try {
    let createdUserId: string | null = null

    if (sendInvite) {
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
        data: {
          full_name: fullName,
          role: assignedRole
        },
        ...(setupAccountRedirect ? { redirectTo: setupAccountRedirect } : {})
      })

      if (error) {
        throw error
      }

      if (!data?.user) {
        throw new Error('Supabase did not return a created user.')
      }

      createdUserId = data.user.id
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        email_confirm: false,
        user_metadata: {
          full_name: fullName,
          role: assignedRole
        }
      })

      if (error) {
        throw error
      }

      if (!data?.user) {
        throw new Error('Supabase did not return a created user.')
      }

      createdUserId = data.user.id
    }

    if (!createdUserId) {
      throw new Error('Missing created user identifier.')
    }

    const profileId = createdUserId

    const { error: profileError } = await admin.from('profiles').upsert<ProfilesTable['Insert']>(
      {
        id: profileId,
        role: assignedRole,
        full_name: fullName ?? null,
        email,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'id' }
    )

    if (profileError) {
      throw profileError
    }

    revalidatePath('/app/user-management')

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('createWorkspaceUser error:', error)

    if (error instanceof Error && 'message' in error) {
      return NextResponse.json({ message: error.message }, { status: 500 })
    }

    return NextResponse.json(
      { message: 'Unable to create user. Try again later.' },
      { status: 500 }
    )
  }
}
