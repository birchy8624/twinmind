import type { WorkspaceUserRecord } from '@/app/app/user-management/UserManagementClient'

import { apiFetch } from './fetch'

export type WorkspaceUsersResponse = {
  currentUserId: string
  users: WorkspaceUserRecord[]
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

export async function fetchWorkspaceUsers() {
  const response = await apiFetch('/api/user-management/users')

  if (!response.ok) {
    const body = await parseJson<{ message?: string }>(response)
    const message = body.message ?? 'Unable to load workspace users.'
    throw new Error(message)
  }

  return parseJson<WorkspaceUsersResponse>(response)
}
