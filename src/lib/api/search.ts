import { apiFetch } from './fetch'

type ClientSummary = { id: string; name: string }

type ProjectSummary = { id: string; name: string }

type WorkspaceSearchResponse = { clients: ClientSummary[]; projects: ProjectSummary[] }

async function parseJson<T>(response: Response): Promise<T> {
  const text = await response.text()

  try {
    return JSON.parse(text) as T
  } catch (error) {
    console.error('Failed to parse JSON response:', error, text)
    throw new Error('Unexpected response from API.')
  }
}

export async function searchWorkspace(query: string) {
  const params = new URLSearchParams({ q: query })
  const response = await apiFetch(`/api/search/workspace?${params.toString()}`)

  if (!response.ok) {
    const body = await parseJson<{ message?: string }>(response)
    throw new Error(body.message ?? 'Unable to search workspace.')
  }

  return parseJson<WorkspaceSearchResponse>(response)
}

export type { ClientSummary as WorkspaceClientSummary, ProjectSummary as WorkspaceProjectSummary, WorkspaceSearchResponse }
