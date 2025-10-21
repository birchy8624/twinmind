import type { Database } from '@/types/supabase'

import { apiFetch } from './fetch'

type NotificationRow = Database['public']['Tables']['comments']['Row'] & {
  project: Pick<Database['public']['Tables']['projects']['Row'], 'id' | 'name' | 'client_id'> | null
  author_profile: Pick<Database['public']['Tables']['profiles']['Row'], 'id' | 'full_name' | 'role'> | null
}

type NotificationsResponse = { notifications: NotificationRow[] }

async function parseJson<T>(response: Response): Promise<T> {
  const text = await response.text()

  try {
    return JSON.parse(text) as T
  } catch (error) {
    console.error('Failed to parse JSON response:', error, text)
    throw new Error('Unexpected response from API.')
  }
}

export async function listNotifications() {
  const response = await apiFetch('/api/notifications')

  if (!response.ok) {
    const body = await parseJson<{ message?: string }>(response)
    throw new Error(body.message ?? 'Unable to load notifications.')
  }

  return parseJson<NotificationsResponse>(response)
}

export type { NotificationRow, NotificationsResponse }
