import { NextResponse } from 'next/server'

import type { Database } from '@/types/supabase'

import { getAccessContext, HttpError } from '../../../_lib/access'

const PROJECTS = 'projects' as const
const MAX_LABEL_LENGTH = 20

export const runtime = 'nodejs'

type AddLabelPayload = {
  label?: unknown
}

type ProjectLabelsResponse = {
  project: { id: string; labels: string[] }
}

function sanitizeLabel(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim().replace(/\s+/g, ' ')
  if (trimmed.length === 0) {
    return null
  }

  if (trimmed.length > MAX_LABEL_LENGTH) {
    return null
  }

  return trimmed
}

export async function POST(request: Request, context: { params: { projectId: string } }) {
  let payload: AddLabelPayload

  try {
    payload = (await request.json()) as AddLabelPayload
  } catch (error) {
    console.error('project label parse error:', error)
    return NextResponse.json({ message: 'Invalid request body.' }, { status: 400 })
  }

  const normalizedLabel = sanitizeLabel(payload.label)
  if (!normalizedLabel) {
    return NextResponse.json(
      { message: `Labels must be ${MAX_LABEL_LENGTH} characters or fewer.` },
      { status: 400 },
    )
  }

  const projectId = context.params.projectId

  try {
    const { supabase, role, clientMemberships } = await getAccessContext({
      allowEmptyClientMemberships: true,
    })

    if (role === 'client' && clientMemberships.length === 0) {
      return NextResponse.json({ message: 'Project not found.' }, { status: 404 })
    }

    let projectLookup = supabase
      .from(PROJECTS)
      .select('id, labels, client_id')
      .eq('id', projectId)

    if (role === 'client') {
      projectLookup = projectLookup.in('client_id', clientMemberships)
    }

    const { data: existingProject, error: existingProjectError } = await projectLookup.maybeSingle<{
      id: string
      client_id: string | null
      labels: Database['public']['Tables']['projects']['Row']['labels']
    }>()

    if (existingProjectError) {
      console.error('project label lookup error:', existingProjectError)
      return NextResponse.json({ message: 'Unable to update project labels.' }, { status: 500 })
    }

    if (!existingProject) {
      return NextResponse.json({ message: 'Project not found.' }, { status: 404 })
    }

    const currentLabels = Array.isArray(existingProject.labels)
      ? existingProject.labels
          .map((label) => (typeof label === 'string' ? label.trim() : ''))
          .filter((label): label is string => label.length > 0)
      : []

    const hasExistingLabel = currentLabels.some(
      (label) => label.localeCompare(normalizedLabel, undefined, { sensitivity: 'accent' }) === 0,
    )

    if (hasExistingLabel) {
      return NextResponse.json<ProjectLabelsResponse>({
        project: { id: existingProject.id, labels: currentLabels },
      })
    }

    const nextLabels = [...currentLabels, normalizedLabel]

    let updateQuery = supabase.from(PROJECTS).update({ labels: nextLabels }).eq('id', projectId)

    if (role === 'client') {
      updateQuery = updateQuery.in('client_id', clientMemberships)
    }

    const { data, error } = await updateQuery.select('id, labels').maybeSingle<{
      id: string
      labels: string[] | null
    }>()

    if (error) {
      console.error('project label update error:', error)
      return NextResponse.json({ message: 'Unable to update project labels.' }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ message: 'Project not found.' }, { status: 404 })
    }

    const updatedLabels = Array.isArray(data.labels)
      ? data.labels.filter((label): label is string => typeof label === 'string' && label.length > 0)
      : []

    return NextResponse.json<ProjectLabelsResponse>({
      project: { id: data.id, labels: updatedLabels },
    })
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ message: error.message }, { status: error.status })
    }

    console.error('project label unexpected error:', error)
    return NextResponse.json({ message: 'Unable to update project labels.' }, { status: 500 })
  }
}
