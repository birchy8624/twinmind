import type { Database } from '@/types/supabase'

import { apiFetch } from './fetch'

export type ClientDetailsQuery = Database['public']['Tables']['clients']['Row'] & {
  client_members: Array<
    Database['public']['Tables']['client_members']['Row'] & {
      profile: Pick<Database['public']['Tables']['profiles']['Row'], 'id' | 'full_name' | 'email'> | null
    }
  > | null
  contacts: Array<
    Database['public']['Tables']['contacts']['Row'] & {
      profile: Pick<Database['public']['Tables']['profiles']['Row'], 'timezone'> | null
    }
  > | null
  invites: Array<
    Database['public']['Tables']['invites']['Row'] & {
      profile: Pick<Database['public']['Tables']['profiles']['Row'], 'id' | 'full_name' | 'email'> | null
    }
  > | null
  projects: Array<Database['public']['Tables']['projects']['Row']> | null
}

export type ClientDetailsResponse = { client: ClientDetailsQuery }

async function parseJson<T>(response: Response): Promise<T> {
  const text = await response.text()

  try {
    return JSON.parse(text) as T
  } catch (error) {
    console.error('Failed to parse JSON response:', error, text)
    throw new Error('Unexpected response from API.')
  }
}

export async function fetchClientDetails(clientId: string) {
  const response = await apiFetch(`/api/clients/${clientId}`)

  if (!response.ok) {
    const body = await parseJson<{ message?: string }>(response)
    const message = body.message ?? 'Unable to load client.'
    throw new Error(message)
  }

  return parseJson<ClientDetailsResponse>(response)
}

type UpdateClientPayload = {
  name: string
  account_status: Database['public']['Tables']['clients']['Row']['account_status']
  website: string | null
  notes?: string | null
}

type UpdateClientResponse = {
  client: Pick<
    Database['public']['Tables']['clients']['Row'],
    'id' | 'name' | 'website' | 'notes' | 'account_status' | 'created_at' | 'updated_at' | 'account_id'
  >
}

export async function updateClientDetails(clientId: string, payload: UpdateClientPayload) {
  const response = await apiFetch(`/api/clients/${clientId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  })

  if (!response.ok) {
    const body = await parseJson<{ message?: string }>(response)
    throw new Error(body.message ?? 'Unable to update client.')
  }

  return parseJson<UpdateClientResponse>(response)
}
