import { NextResponse } from 'next/server'

import { createServerSupabase } from '@/lib/supabase/server'
import type { Database } from '@/types/supabase'

const PROJECTS = 'projects' as const
const CLIENTS = 'clients' as const
const PROFILES = 'profiles' as const
const INVOICES = 'invoices' as const
const BRIEFS = 'briefs' as const

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
  const { data, error } = await supabase
    .from('client_members')
    .select('client_id')
    .eq('profile_id', profileId)

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
      .maybeSingle<ProjectDetailsRow>()

    if (profileRole === 'client') {
      projectQuery = projectQuery.in('client_id', clientMemberships)
    }

    const [projectResult, clientsResult, assigneesResult, invoicesResult, briefResult] = await Promise.all([
      projectQuery,
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
