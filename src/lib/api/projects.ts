import type { Database } from '@/types/supabase'

import { apiFetch } from './fetch'

type ProjectRow = Database['public']['Tables']['projects']['Row']

type ClientOption = Pick<Database['public']['Tables']['clients']['Row'], 'id' | 'name'>

type AssigneeOption = Pick<Database['public']['Tables']['profiles']['Row'], 'id' | 'full_name'>

type KanbanProject = Pick<
  ProjectRow,
  'id' | 'name' | 'status' | 'value_quote' | 'due_date' | 'created_at' | 'labels' | 'tags'
> & {
  client: ClientOption | null
  assignee: AssigneeOption | null
}

type KanbanProjectsResponse = { projects: KanbanProject[] }

type ProjectUpdatePayload = {
  name: string
  description: string
  status: Database['public']['Enums']['project_status']
  client_id: string
  assignee_profile_id: string | null
  due_date: string | null
  value_quote: number | null
  value_invoiced: number | null
  value_paid: number | null
  labels: string[] | null
  tags: string[] | null
}

type ProjectUpdateResponse = {
  project: (ProjectRow & { client: ClientOption | null; assignee: AssigneeOption | null })
}

type SaveInvoicePayload = {
  invoiceId?: string
  amount: number
  currency: string
  status?: Database['public']['Enums']['invoice_status'] | null
  issued_at?: string | null
  due_at?: string | null
  external_url?: string | null
  paid_at?: string | null
}

type InvoiceRecord = InvoiceRow

type SaveInvoiceResponse = { invoice: InvoiceRecord }

type CreateCommentPayload = {
  body: string
  visibility: Database['public']['Enums']['visibility_enum']
}

type CreateCommentResponse = {
  comment: CommentRow
}

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

export async function fetchKanbanProjects() {
  const response = await apiFetch('/api/projects/kanban')

  if (!response.ok) {
    const body = await parseJson<{ message?: string }>(response)
    throw new Error(body.message ?? 'Unable to load projects.')
  }

  return parseJson<KanbanProjectsResponse>(response)
}

export async function updateProjectStatus(
  projectId: string,
  status: Database['public']['Enums']['project_status'],
) {
  const response = await apiFetch(`/api/projects/${projectId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })

  if (!response.ok) {
    const body = await parseJson<{ message?: string }>(response)
    throw new Error(body.message ?? 'Unable to update project.')
  }

  return parseJson<{ project: { id: string; status: Database['public']['Enums']['project_status'] } }>(response)
}

export async function updateProjectDetails(projectId: string, payload: ProjectUpdatePayload) {
  const response = await apiFetch(`/api/projects/${projectId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const body = await parseJson<{ message?: string }>(response)
    throw new Error(body.message ?? 'Unable to update project.')
  }

  return parseJson<ProjectUpdateResponse>(response)
}

export async function saveProjectInvoice(projectId: string, payload: SaveInvoicePayload) {
  const response = await apiFetch(`/api/projects/${projectId}/invoices`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const body = await parseJson<{ message?: string }>(response)
    throw new Error(body.message ?? 'Unable to save invoice.')
  }

  return parseJson<SaveInvoiceResponse>(response)
}

export async function deleteProjectInvoice(projectId: string, invoiceId: string) {
  const response = await apiFetch(`/api/projects/${projectId}/invoices`, {
    method: 'DELETE',
    body: JSON.stringify({ invoiceId }),
  })

  if (!response.ok) {
    const body = await parseJson<{ message?: string }>(response)
    throw new Error(body.message ?? 'Unable to delete invoice.')
  }
}

export async function saveProjectBrief(projectId: string, answers: Database['public']['Tables']['briefs']['Row']['answers']) {
  const response = await apiFetch(`/api/projects/${projectId}/brief`, {
    method: 'PUT',
    body: JSON.stringify({ answers }),
  })

  if (!response.ok) {
    const body = await parseJson<{ message?: string }>(response)
    throw new Error(body.message ?? 'Unable to save brief.')
  }
}

export async function deleteProjectBrief(projectId: string) {
  const response = await apiFetch(`/api/projects/${projectId}/brief`, {
    method: 'DELETE',
  })

  if (!response.ok) {
    const body = await parseJson<{ message?: string }>(response)
    throw new Error(body.message ?? 'Unable to clear brief.')
  }
}

export async function createProjectComment(projectId: string, payload: CreateCommentPayload) {
  const response = await apiFetch(`/api/projects/${projectId}/comments`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const body = await parseJson<{ message?: string }>(response)
    throw new Error(body.message ?? 'Unable to post comment.')
  }

  return parseJson<CreateCommentResponse>(response)
}

export async function uploadProjectFile(projectId: string, file: File) {
  const formData = new FormData()
  formData.append('file', file)

  const response = await apiFetch(`/api/projects/${projectId}/files`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const body = await parseJson<{ message?: string }>(response)
    throw new Error(body.message ?? 'Unable to upload file.')
  }

  return parseJson<{ success: boolean; path: string }>(response)
}

export async function deleteProjectFile(projectId: string, path: string) {
  const response = await apiFetch(`/api/projects/${projectId}/files`, {
    method: 'DELETE',
    body: JSON.stringify({ path }),
  })

  if (!response.ok) {
    const body = await parseJson<{ message?: string }>(response)
    throw new Error(body.message ?? 'Unable to delete file.')
  }
}

export async function createProjectFileDownloadUrl(projectId: string, path: string) {
  const response = await apiFetch(`/api/projects/${projectId}/files/sign`, {
    method: 'POST',
    body: JSON.stringify({ path }),
  })

  if (!response.ok) {
    const body = await parseJson<{ message?: string }>(response)
    throw new Error(body.message ?? 'Unable to prepare download link.')
  }

  return parseJson<{ url: string }>(response)
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
  KanbanProject,
  KanbanProjectsResponse,
  ProjectUpdatePayload,
  ProjectUpdateResponse,
  SaveInvoicePayload,
  SaveInvoiceResponse,
  CreateCommentPayload,
}
