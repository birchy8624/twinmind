'use server'

import { z } from 'zod'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { createServerSupabase } from '@/lib/supabase/server'
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

export type ProjectWizardPayload = z.infer<typeof ProjectWizardSchema>

type ActionResult = { ok: true; projectId: string } | { ok: false; message: string }

type SupabaseActionError = { message?: string } | null

export async function createProject(input: unknown): Promise<ActionResult> {
  const parsed = ProjectWizardSchema.safeParse(input)

  if (!parsed.success) {
    return { ok: false, message: 'Invalid input.' }
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
    return { ok: false, message: 'Not authenticated.' }
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

  const fail = async (context: string, error: SupabaseActionError = null): Promise<ActionResult> => {
    if (error) {
      console.error(`${context} error:`, error)
    }

    await cleanup()

    if (error?.message) {
      return { ok: false, message: `${context}: ${error.message}` }
    }

    return { ok: false, message: context }
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

  return { ok: true, projectId }
}
