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

const WizardSchema = z.object({
  client: z.object({
    name: z.string().min(1),
    website: z
      .string()
      .trim()
      .min(1)
      .optional(),
    timezone: z.string().optional(),
    budget: z.string().optional(),
    gdpr_consent: z.boolean().default(false)
  }),
  contact: z.object({
    title: z.string().optional(),
    first_name: z.string().min(1),
    last_name: z.string().min(1),
    email: z.string().email(),
    phone: z.string().optional()
  }),
  project: z.object({
    name: z.string().min(1),
    description: z.string().min(1),
    due_date: z.string().optional(),
    invoice_amount: z.number().optional(),
    currency: z.string().default('EUR')
  }),
  brief: BriefSchema
})

export type WizardPayload = z.infer<typeof WizardSchema>

type ActionResult =
  | { ok: true; projectId: string }
  | { ok: false; message: string }

export async function createClientProject(input: unknown): Promise<ActionResult> {
  const parsed = WizardSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: 'Invalid input.' }
  }

  const { client, contact, project, brief } = parsed.data

  const ownerClient = createServerSupabase()
  const {
    data: { user: ownerUser },
    error: ownerError
  } = await ownerClient.auth.getUser()

  if (ownerError || !ownerUser) {
    return { ok: false, message: 'Not authenticated.' }
  }

  const admin = supabaseAdmin()

  const contactFirstName = contact.first_name.trim()
  const contactLastName = contact.last_name.trim()
  const contactFullName = [contactFirstName, contactLastName].filter(Boolean).join(' ')
  const contactTitle = contact.title?.trim() || null
  const contactPhone = contact.phone?.trim() || null

  let clientId: string | null = null
  let projectId: string | null = null

  const cleanup = async () => {
    if (projectId) {
      await admin.from('briefs').delete().eq('project_id', projectId)
      await admin.from('invoices').delete().eq('project_id', projectId)
      await admin.from('projects').delete().eq('id', projectId)
    }

    if (clientId) {
      await admin.from('contacts').delete().eq('client_id', clientId)
      await admin.from('clients').delete().eq('id', clientId)
    }
  }

  type SupabaseActionError = { message?: string } | null

  const fail = async (
    context: string,
    error: SupabaseActionError = null
  ): Promise<ActionResult> => {
    if (error) {
      console.error(`${context} error:`, error)
    }

    await cleanup()

    if (error?.message) {
      return { ok: false, message: `${context}: ${error.message}` }
    }

    return { ok: false, message: context }
  }

  const clientInsert: Database['public']['Tables']['clients']['Insert'] = {
    name: client.name,
    website: client.website ?? null,
    account_status: 'active'
  }

  const { data: clientRow, error: clientError } = await admin
    .from('clients')
    .insert(clientInsert)
    .select('id')
    .single()

  if (clientError) {
    console.error('Create client error:', clientError)
    return { ok: false, message: `Create client: ${clientError.message}` }
  }

  if (!clientRow) {
    return { ok: false, message: 'Create client: Missing client row.' }
  }

  clientId = clientRow.id

  if (!clientId) {
    return fail('Create primary contact', { message: 'Missing client id.' })
  }

  const contactInsert: Database['public']['Tables']['contacts']['Insert'] = {
    client_id: clientId,
    first_name: contactFirstName,
    last_name: contactLastName,
    email: contact.email,
    phone: contactPhone,
    title: contactTitle,
    is_primary: true,
    gdpr_consent: client.gdpr_consent,
    profile_id: null
  }

  const { error: contactError } = await admin.from('contacts').insert(contactInsert)

  if (contactError) {
    return fail('Create primary contact', contactError)
  }

  const projectInsert: Database['public']['Tables']['projects']['Insert'] = {
    client_id: clientId,
    name: project.name,
    description: project.description,
    status: 'Backlog',
    due_date: project.due_date ?? null,
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
    answers:
      brief as Database['public']['Tables']['briefs']['Insert']['answers'],
    completed: true
  }

  const { error: briefError } = await admin.from('briefs').insert(briefInsert)

  if (briefError) {
    return fail('Save brief', briefError)
  }

  if (project.invoice_amount && project.invoice_amount > 0) {
    const invoiceInsert: Database['public']['Tables']['invoices']['Insert'] = {
      project_id: projectId,
      status: 'Quote',
      amount: project.invoice_amount,
      currency: project.currency ?? 'EUR',
      issued_at: new Date().toISOString()
    }

    const { error: invoiceError } = await admin
      .from('invoices')
      .insert(invoiceInsert)

    if (invoiceError) {
      return fail('Create quote', invoiceError)
    }
  }

  if (!projectId) {
    return fail('Create project', { message: 'Missing project id.' })
  }

  return { ok: true, projectId }
}
