import type { Database } from '@/types/supabase'

import { apiFetch } from './fetch'

type RoleEnum = Database['public']['Enums']['role_enum']

type ProfileShape = {
  id: string
  full_name: string | null
  role: RoleEnum | null
  email: string | null
}

type ActiveProfileResponse = {
  profile: ProfileShape
  metadata: Record<string, unknown> | null
  userEmail: string | null
  clientIds: string[]
}

type UpdateProfilePayload = {
  name: string
  role: RoleEnum
  email: string
}

type UpdateProfileResponse = {
  profile: ProfileShape
}

type SetupProfile = {
  id: string
  full_name: string | null
  email: string | null
  company: string | null
}

type SetupAccount = {
  id: string
  name: string
}

type SetupProfileResponse = {
  profile: SetupProfile
  account: SetupAccount | null
}

type UpdateSetupProfilePayload = {
  fullName: string
  email: string | null
  companyName: string | null
}

async function parseJson<T>(response: Response): Promise<T> {
  const text = await response.text()

  try {
    return JSON.parse(text) as T
  } catch (error) {
    console.error('Failed to parse JSON response:', error, text)
    throw new Error('Unexpected response from API.')
  }
}

export async function fetchActiveProfile() {
  const response = await apiFetch('/api/profile')

  if (response.status === 401) {
    return null
  }

  if (!response.ok) {
    const body = await parseJson<{ message?: string }>(response)
    throw new Error(body.message ?? 'Unable to load profile.')
  }

  return parseJson<ActiveProfileResponse>(response)
}

export async function updateProfile(payload: UpdateProfilePayload) {
  const response = await apiFetch('/api/profile', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const body = await parseJson<{ message?: string }>(response)
    throw new Error(body.message ?? 'Unable to save profile.')
  }

  return parseJson<UpdateProfileResponse>(response)
}

export async function fetchSetupProfile() {
  const response = await apiFetch('/api/profile/setup')

  if (!response.ok) {
    const body = await parseJson<{ message?: string }>(response)
    throw new Error(body.message ?? 'Unable to load profile.')
  }

  return parseJson<SetupProfileResponse>(response)
}

export async function updateSetupProfile(payload: UpdateSetupProfilePayload) {
  const response = await apiFetch('/api/profile/setup', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const body = await parseJson<{ message?: string }>(response)
    throw new Error(body.message ?? 'Unable to update profile.')
  }
}

export type {
  ActiveProfileResponse,
  ProfileShape,
  UpdateProfilePayload,
  UpdateProfileResponse,
  SetupProfile,
  SetupProfileResponse,
  UpdateSetupProfilePayload,
}
