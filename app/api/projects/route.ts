import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { createServerSupabase } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import type { Database } from '@/types/supabase'

const BriefSchema = z.object({
  goals: z.string().min(1),
  personas: z.array(z.string()).default([]),
  features: z.array(z.string()).default([]),
  integrations: z.array(z.string()).default([]),
  timeline: z.string().optional(),
  successMetrics: z.string().optional(),
  competitors: z.array(z.string()).default([]),
  risks: z.string().optional()
})

const ProjectWizardSchema = z.object({
  project: z.object({
    name: z.string().min(1),
    description: z.string().min(1),
    clientId: z.string().min(1),
    dueDate: z.string().optional()
  }),
  invoice: z
    .object({
      amount: z.number().positive(),
      currency: z.string().min(1)
    })
    .optional(),
  brief: BriefSchema
})

export async function POST(request: Request) {
  let payload: unknown

  try {
    payload = await request.json()
  } catch (error) {
    console.error('Failed to parse project creation payload:', error)
    return NextResponse.json({ message: 'Invalid input.' }, { status: 400 })
  }

  const parsed = ProjectWizardSchema.safeParse(payload)

  if (!parsed.success) {
    return NextResponse.json({ message: 'Invalid input.' }, { status: 400 })
  }

  const {
    project: { name, description, clientId, dueDate },
    invoice,
    brief
  } = parsed.data

  const ownerClient = createServerSupabase()
  const {
    data: { user: ownerUser },
    error: ownerError
  } = await ownerClient.auth.getUser()

  if (ownerError || !ownerUser) {
    return NextResponse.json({ message: 'Not authenticated.' }, { status: 401 })
  }

  const admin = supabaseAdmin()

  let projectId: string | null = null

  const cleanup = async () => {
    if (projectId) {
      await admin.from('briefs').delete().eq('project_id', projectId)
      await admin.from('invoices').delete().eq('project_id', projectId)
      await admin.from('projects').delete().eq('id', projectId)
    }
  }

  type SupabaseActionError = { message?: string } | null

  const fail = async (context: string, error: SupabaseActionError = null) => {
    if (error) {
      console.error(`${context} error:`, error)
    }

    await cleanup()

    const message = error?.message ? `${context}: ${error.message}` : context
    return NextResponse.json({ message }, { status: 500 })
  }

  const projectInsert: Database['public']['Tables']['projects']['Insert'] = {
    client_id: clientId,
    name,
    description,
    status: 'Backlog',
    due_date: dueDate ?? null,
    assignee_profile_id: ownerUser.id
  }

  const { data: projectRow, error: projectError } = await admin
    .from('projects')
    .insert(projectInsert)
    .select('id')
    .single()

  if (projectError) {
    return fail('Create project', projectError)
  }

  if (!projectRow) {
    return fail('Create project', { message: 'Missing project row.' })
  }

  projectId = projectRow.id

  const briefInsert: Database['public']['Tables']['briefs']['Insert'] = {
    project_id: projectId,
    answers: brief as Database['public']['Tables']['briefs']['Insert']['answers'],
    completed: true
  }

  const { error: briefError } = await admin.from('briefs').insert(briefInsert)

  if (briefError) {
    return fail('Save brief', briefError)
  }

  if (invoice) {
    const invoiceInsert: Database['public']['Tables']['invoices']['Insert'] = {
      project_id: projectId,
      status: 'Quote',
      amount: invoice.amount,
      currency: invoice.currency,
      issued_at: new Date().toISOString()
    }

    const { error: invoiceError } = await admin.from('invoices').insert(invoiceInsert)

    if (invoiceError) {
      return fail('Create quote', invoiceError)
    }
  }

  revalidatePath('/app/projects')
  revalidatePath('/app/dashboard')
  revalidatePath('/app/kanban')

  return NextResponse.json({ ok: true, projectId })
}
