import { NextResponse } from 'next/server'

import type { Database } from '@/types/supabase'

import { getAccessContext, HttpError } from '../../_lib/access'

const MAX_RESULTS = 6

export const runtime = 'nodejs'

type ClientSummary = Pick<Database['public']['Tables']['clients']['Row'], 'id' | 'name'>
type ProjectSummary = Pick<Database['public']['Tables']['projects']['Row'], 'id' | 'name' | 'client_id'>

type WorkspaceSearchResponse = {
  clients: ClientSummary[]
  projects: Array<Pick<ProjectSummary, 'id' | 'name'>>
}

function escapeForILike(value: string) {
  return value.replace(/[%_]/g, '\\$&')
}

function isLikelyUuid(value: string) {
  return /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.test(value.trim())
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const query = url.searchParams.get('q')?.trim()

  if (!query || query.length < 2) {
    return NextResponse.json({ message: 'Query must be at least 2 characters.' }, { status: 400 })
  }

  try {
    const { supabase, role, clientMemberships } = await getAccessContext({
      allowEmptyClientMemberships: true,
    })

    if (role === 'client' && clientMemberships.length === 0) {
      return NextResponse.json<WorkspaceSearchResponse>({ clients: [], projects: [] })
    }

    const pattern = `%${escapeForILike(query)}%`

    let clientQuery = supabase
      .from('clients')
      .select('id, name')
      .ilike('name', pattern)
      .order('name', { ascending: true })
      .limit(MAX_RESULTS)

    if (role === 'client') {
      clientQuery = clientQuery.in('id', clientMemberships)
    }

    const clientPromises = [
      clientQuery.returns<ClientSummary[] | null>(),
    ]

    if (isLikelyUuid(query)) {
      let clientIdQuery = supabase.from('clients').select('id, name').eq('id', query).limit(1)
      if (role === 'client') {
        clientIdQuery = clientIdQuery.in('id', clientMemberships)
      }
      clientPromises.push(clientIdQuery.returns<ClientSummary[] | null>())
    }

    const clientResults = await Promise.all(clientPromises)

    for (const result of clientResults) {
      if (result.error) {
        console.error('workspace search client query error:', result.error)
        return NextResponse.json({ message: 'Unable to search workspace.' }, { status: 500 })
      }
    }

    const clients: ClientSummary[] = []
    const clientIds = new Set<string>()

    for (const result of clientResults) {
      const rows = Array.isArray(result.data) ? result.data : []
      for (const client of rows) {
        if (typeof client?.id !== 'string' || typeof client?.name !== 'string') {
          continue
        }
        if (!clientIds.has(client.id)) {
          clientIds.add(client.id)
          clients.push({ id: client.id, name: client.name })
        }
      }
    }

    const limitedClients = clients.slice(0, MAX_RESULTS)

    let projectQuery = supabase
      .from('projects')
      .select('id, name, client_id')
      .ilike('name', pattern)
      .order('name', { ascending: true })
      .limit(MAX_RESULTS)

    if (role === 'client') {
      projectQuery = projectQuery.in('client_id', clientMemberships)
    }

    const projectPromises = [
      projectQuery.returns<ProjectSummary[] | null>(),
    ]

    if (isLikelyUuid(query)) {
      let projectIdQuery = supabase.from('projects').select('id, name, client_id').eq('id', query).limit(1)
      if (role === 'client') {
        projectIdQuery = projectIdQuery.in('client_id', clientMemberships)
      }
      projectPromises.push(projectIdQuery.returns<ProjectSummary[] | null>())
    }

    const projectResults = await Promise.all(projectPromises)

    for (const result of projectResults) {
      if (result.error) {
        console.error('workspace search project query error:', result.error)
        return NextResponse.json({ message: 'Unable to search workspace.' }, { status: 500 })
      }
    }

    const projects: Array<Pick<ProjectSummary, 'id' | 'name'>> = []
    const projectIds = new Set<string>()

    for (const result of projectResults) {
      const rows = Array.isArray(result.data) ? result.data : []
      for (const project of rows) {
        if (typeof project?.id !== 'string' || typeof project?.name !== 'string') {
          continue
        }

        if (role === 'client') {
          const clientId = project?.client_id
          if (!clientId || !clientMemberships.includes(clientId)) {
            continue
          }
        }

        if (!projectIds.has(project.id)) {
          projectIds.add(project.id)
          projects.push({ id: project.id, name: project.name })
        }
      }
    }

    const limitedProjects = projects.slice(0, MAX_RESULTS)

    return NextResponse.json<WorkspaceSearchResponse>({
      clients: limitedClients,
      projects: limitedProjects,
    })
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ message: error.message }, { status: error.status })
    }

    console.error('workspace search unexpected error:', error)
    return NextResponse.json({ message: 'Unable to search workspace.' }, { status: 500 })
  }
}
