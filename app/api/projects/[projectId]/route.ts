import { NextResponse } from 'next/server'

import { createServerSupabase } from '@/lib/supabase/server'
import type { Database } from '@/types/supabase'

const PROJECTS = 'projects' as const
const CLIENTS = 'clients' as const
const PROFILES = 'profiles' as const
const INVOICES = 'invoices' as const
const BRIEFS = 'briefs' as const
const PROJECT_STAGE_EVENTS = 'project_stage_events' as const

export const runtime = 'nodejs'

type ProfileRole = Database['public']['Enums']['role_enum'] | null

type ProjectRow = Database['public']['Tables']['projects']['Row']

type ProjectDetailsRow = ProjectRow & {
  clients: Pick<Database['public']['Tables']['clients']['Row'], 'id' | 'name'> | null
  assignee_profile: Pick<Database['public']['Tables']['profiles']['Row'], 'id' | 'full_name'> | null
}

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

type BriefRow = Pick<Database['public']['Tables']['briefs']['Row'], 'answers'>

type ProjectDetailsResponse = {
  project: (ProjectRow & {
    client: ClientOption | null
    assignee: AssigneeOption | null
  }) | null
  clients: ClientOption[]
  assignees: AssigneeOption[]
  invoices: InvoiceRow[]
  briefAnswers: BriefRow['answers'] | null
}

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

async function resolveProfileRole(
  supabase: ReturnType<typeof createServerSupabase>,
  profileId: string
): Promise<ProfileRole> {
  const { data, error } = await supabase
    .from(PROFILES)
    .select('role')
    .eq('id', profileId)
    .maybeSingle<{ role: ProfileRole }>()

  if (error) {
    console.error('resolveProfileRole error:', error)
    throw new Error('Unable to verify permissions.')
  }

  return data?.role ?? null
}

async function resolveClientMemberships(
  supabase: ReturnType<typeof createServerSupabase>,
  profileId: string
) {
  type ClientMembershipRow = Pick<Database['public']['Tables']['client_members']['Row'], 'client_id'>

  const { data, error } = await supabase
    .from('client_members')
    .select('client_id')
    .eq('profile_id', profileId)
    .returns<ClientMembershipRow[]>()

  if (error) {
    console.error('resolveClientMemberships error:', error)
    throw new Error('Unable to load client memberships.')
  }

  return (data ?? [])
    .map((row) => row?.client_id)
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
}

export async function GET(
  _request: Request,
  context: { params: { projectId: string } }
) {
  const supabase = createServerSupabase()

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ message: 'Not authenticated.' }, { status: 401 })
  }

  let profileRole: ProfileRole = null

  try {
    profileRole = await resolveProfileRole(supabase, user.id)
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unable to verify permissions.' },
      { status: 500 }
    )
  }

  let clientMemberships: string[] = []

  if (profileRole === 'client') {
    try {
      clientMemberships = await resolveClientMemberships(supabase, user.id)
    } catch (error) {
      return NextResponse.json(
        { message: error instanceof Error ? error.message : 'Unable to load memberships.' },
        { status: 500 }
      )
    }

    if (clientMemberships.length === 0) {
      return NextResponse.json({ message: 'Project not found.' }, { status: 404 })
    }
  }

  const projectId = context.params.projectId

  try {
    let projectQuery = supabase
      .from(PROJECTS)
      .select(
        `
          id,
          name,
          status,
          description,
          due_date,
          created_at,
          updated_at,
          archived,
          labels,
          tags,
          priority,
          client_id,
          account_id,
          assignee_profile_id,
          value_invoiced,
          value_paid,
          value_quote,
          clients:client_id ( id, name ),
          assignee_profile:assignee_profile_id ( id, full_name )
        `
      )
      .eq('id', projectId)

    if (profileRole === 'client') {
      projectQuery = projectQuery.in('client_id', clientMemberships)
    }

    const [projectResult, clientsResult, assigneesResult, invoicesResult, briefResult] = await Promise.all([
      projectQuery.maybeSingle<ProjectDetailsRow>(),
      profileRole === 'client'
        ? supabase.from(CLIENTS).select('id, name').in('id', clientMemberships).order('name', { ascending: true })
        : supabase.from(CLIENTS).select('id, name').order('name', { ascending: true }),
      supabase.from(PROFILES).select('id, full_name').order('full_name', { ascending: true }),
      supabase
        .from(INVOICES)
        .select(
          'id, amount, currency, status, issued_at, due_at, external_url, paid_at, created_at, updated_at'
        )
        .eq('project_id', projectId)
        .order('created_at', { ascending: false }),
      supabase.from(BRIEFS).select('answers').eq('project_id', projectId).maybeSingle<BriefRow>()
    ])

    if (projectResult.error) {
      console.error('project details project query error:', projectResult.error)
      return NextResponse.json({ message: 'Unable to load project.' }, { status: 500 })
    }

    if (!projectResult.data) {
      return NextResponse.json({ message: 'Project not found.' }, { status: 404 })
    }

    const projectRow = projectResult.data

    const project = {
      ...projectRow,
      client: projectRow.clients ?? null,
      assignee: projectRow.assignee_profile ?? null
    }

    if (clientsResult.error) {
      console.error('project details clients error:', clientsResult.error)
    }

    if (assigneesResult.error) {
      console.error('project details assignees error:', assigneesResult.error)
    }

    if (invoicesResult.error) {
      console.error('project details invoices error:', invoicesResult.error)
    }

    if (briefResult.error) {
      console.error('project details brief error:', briefResult.error)
    }

    const response: ProjectDetailsResponse = {
      project,
      clients: (clientsResult.data ?? []) as ClientOption[],
      assignees: (assigneesResult.data ?? []) as AssigneeOption[],
      invoices: (invoicesResult.data ?? []) as InvoiceRow[],
      briefAnswers: briefResult.data?.answers ?? null
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('project details unexpected error:', error)
    return NextResponse.json({ message: 'Unable to load project.' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  context: { params: { projectId: string } }
) {
  const supabase = createServerSupabase()

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ message: 'Not authenticated.' }, { status: 401 })
  }

  let profileRole: ProfileRole = null

  try {
    profileRole = await resolveProfileRole(supabase, user.id)
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unable to verify permissions.' },
      { status: 500 }
    )
  }

  let clientMemberships: string[] = []

  if (profileRole === 'client') {
    try {
      clientMemberships = await resolveClientMemberships(supabase, user.id)
    } catch (error) {
      return NextResponse.json(
        { message: error instanceof Error ? error.message : 'Unable to load memberships.' },
        { status: 500 }
      )
    }

    if (clientMemberships.length === 0) {
      return NextResponse.json({ message: 'Project not found.' }, { status: 404 })
    }
  }

  let payload: ProjectUpdatePayload

  try {
    payload = (await request.json()) as ProjectUpdatePayload
  } catch (error) {
    console.error('project update parse error:', error)
    return NextResponse.json({ message: 'Invalid request body.' }, { status: 400 })
  }

  let projectLookup = supabase.from(PROJECTS).select('id, status').eq('id', context.params.projectId)

  if (profileRole === 'client') {
    projectLookup = projectLookup.in('client_id', clientMemberships)
  }

  const { data: existingProject, error: existingProjectError } = await projectLookup.maybeSingle<{
    id: string
    status: Database['public']['Enums']['project_status']
  }>()

  if (existingProjectError) {
    console.error('project update status lookup error:', existingProjectError)
    return NextResponse.json({ message: 'Unable to update project.' }, { status: 500 })
  }

  if (!existingProject) {
    return NextResponse.json({ message: 'Project not found.' }, { status: 404 })
  }

  const previousStatus = existingProject.status

  const updatePatch: Database['public']['Tables']['projects']['Update'] = {
    name: payload.name,
    description: payload.description,
    status: payload.status,
    client_id: payload.client_id,
    assignee_profile_id: payload.assignee_profile_id,
    due_date: payload.due_date,
    value_quote: payload.value_quote,
    value_invoiced: payload.value_invoiced,
    value_paid: payload.value_paid,
    labels: payload.labels,
    tags: payload.tags
  }

  let updateQuery = supabase
    .from(PROJECTS)
    .update(updatePatch)
    .eq('id', context.params.projectId)

  if (profileRole === 'client') {
    updateQuery = updateQuery.in('client_id', clientMemberships)
  }

  const { data, error: updateError } = await updateQuery
    .select(
      `
        id,
        name,
        status,
        description,
        due_date,
        created_at,
        updated_at,
        client_id,
        assignee_profile_id,
        value_invoiced,
        value_paid,
        value_quote,
        labels,
        tags,
        clients:client_id ( id, name ),
        assignee_profile:assignee_profile_id ( id, full_name )
      `
    )
    .maybeSingle<ProjectDetailsRow>()

  if (updateError) {
    console.error('project update error:', updateError)
    return NextResponse.json({ message: 'Unable to update project.' }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ message: 'Project not found.' }, { status: 404 })
  }

  if (payload.status && previousStatus !== data.status) {
    const { error: stageEventError } = await supabase.from(PROJECT_STAGE_EVENTS).insert({
      project_id: data.id,
      from_status: previousStatus,
      to_status: data.status,
      changed_by_profile_id: user.id,
    })

    if (stageEventError) {
      console.error('project update stage event error:', stageEventError)
      return NextResponse.json({ message: 'Unable to update project.' }, { status: 500 })
    }
  }

  const { clients, assignee_profile, ...rest } = data

  const project = {
    ...rest,
    client: clients ?? null,
    assignee: assignee_profile ?? null
  }

  return NextResponse.json({ project })
}
