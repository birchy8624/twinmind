import type { Database } from '@/types/supabase'

import { apiFetch } from './fetch'

type ProjectRow = Database['public']['Tables']['projects']['Row']

type ClientOption = Pick<Database['public']['Tables']['clients']['Row'], 'id' | 'name'>

type AssigneeOption = Pick<Database['public']['Tables']['profiles']['Row'], 'id' | 'full_name'>

type InvoiceRow = Pick<
  Database['public']['Tables']['invoices']['Row'],
  | 'id'
  | 'amount'
  | 'currency'
  | 'status'
  | 'issued_at'
  | 'due_at'
  | 'external_url'
  | 'paid_at'
  | 'created_at'
  | 'updated_at'
>

type BriefAnswers = Database['public']['Tables']['briefs']['Row']['answers'] | null

type ProjectDetailsPayload = {
  project: (ProjectRow & { client: ClientOption | null; assignee: AssigneeOption | null }) | null
  clients: ClientOption[]
  assignees: AssigneeOption[]
  invoices: InvoiceRow[]
  briefAnswers: BriefAnswers
}

type ProjectListItem = Pick<ProjectRow, 'id' | 'name' | 'status' | 'description' | 'due_date' | 'created_at'> & {
  client: ClientOption | null
  assignee: AssigneeOption | null
}

type ProjectListResponse = {
  projects: ProjectListItem[]
}

type CommentRow = Database['public']['Tables']['comments']['Row'] & {
  author: Pick<Database['public']['Tables']['profiles']['Row'], 'id' | 'full_name' | 'role'> | null
}

type ProjectCommentsResponse = {
  comments: CommentRow[]
}

type ProjectFilesResponse = {
  files: Array<{
    path: string
    name: string
    id: string | null
    created_at: string | null
    updated_at: string | null
    last_accessed_at: string | null
    size: number | null
  }>
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

export async function fetchProjectDetails(projectId: string) {
  const response = await apiFetch(`/api/projects/${projectId}`)

  if (!response.ok) {
    const body = await parseJson<{ message?: string }>(response)
    throw new Error(body.message ?? 'Unable to load project.')
  }

  return parseJson<ProjectDetailsPayload>(response)
}

export async function listProjects() {
  const response = await apiFetch('/api/projects')

  if (!response.ok) {
    const body = await parseJson<{ message?: string }>(response)
    throw new Error(body.message ?? 'Unable to load projects.')
  }

  return parseJson<ProjectListResponse>(response)
}

export async function fetchProjectComments(projectId: string) {
  const response = await apiFetch(`/api/projects/${projectId}/comments`)

  if (!response.ok) {
    const body = await parseJson<{ message?: string }>(response)
    throw new Error(body.message ?? 'Unable to load comments.')
  }

  return parseJson<ProjectCommentsResponse>(response)
}

export async function listProjectFiles(projectId: string) {
  const response = await apiFetch(`/api/projects/${projectId}/files`)

  if (!response.ok) {
    const body = await parseJson<{ message?: string }>(response)
    throw new Error(body.message ?? 'Unable to load files.')
  }

  return parseJson<ProjectFilesResponse>(response)
}

export type {
  ProjectDetailsPayload,
  CommentRow as ProjectComment,
  ProjectFilesResponse,
  ProjectListItem,
  ProjectListResponse,
}
