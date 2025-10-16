'use server'

import { z } from 'zod'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { createServerClient } from '@/utils/supabaseServer'

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
  inviteClient: z.boolean().default(false),
  client: z.object({
    name: z.string().min(1),
    email: z.string().email(),
    company: z.string().optional(),
    website: z.string().url().optional(),
    phone: z.string().optional(),
    timezone: z.string().optional(),
    budget: z.string().optional(),
    gdpr_consent: z.boolean().default(false)
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

  const { inviteClient, client, project, brief } = parsed.data

  const ownerClient = createServerClient()
  const {
    data: { user: ownerUser },
    error: ownerError
  } = await ownerClient.auth.getUser()

  if (ownerError || !ownerUser) {
    return { ok: false, message: 'Not authenticated.' }
  }

  const admin = supabaseAdmin()

  let clientId: string | null = null
  let projectId: string | null = null
  let invitedProfileId: string | null = null

  const cleanup = async () => {
    if (projectId) {
      await admin.from('briefs').delete().eq('project_id', projectId)
      await admin.from('invoices').delete().eq('project_id', projectId)
      await admin.from('projects').delete().eq('id', projectId)
    }

    if (invitedProfileId) {
      await admin.from('client_members').delete().eq('profile_id', invitedProfileId)
      await admin.from('profiles').delete().eq('id', invitedProfileId)
      await admin.auth.admin.deleteUser(invitedProfileId)
    }

    if (clientId) {
      await admin.from('client_members').delete().eq('client_id', clientId)
      await admin.from('clients').delete().eq('id', clientId)
    }
  }

  const fail = async (message: string): Promise<ActionResult> => {
    await cleanup()
    return { ok: false, message }
  }

  const { data: clientRow, error: clientError } = await admin
    .from('clients')
    .insert({
      name: client.name,
      website: client.website ?? null,
      notes: null,
      status: 'active'
    })
    .select('id')
    .single()

  if (clientError || !clientRow) {
    return { ok: false, message: 'Failed to create client.' }
  }

  clientId = clientRow.id

  if (inviteClient) {
    const { data: authResponse, error: authError } = await admin.auth.admin.createUser({
      email: client.email,
      email_confirm: true,
      user_metadata: {
        full_name: client.name,
        company: client.company ?? null
      }
    })

    if (authError || !authResponse?.user) {
      return fail('Failed to invite client user.')
    }

    invitedProfileId = authResponse.user.id

    const { error: profileError } = await admin
      .from('profiles')
      .upsert(
        {
          id: invitedProfileId,
          role: 'client',
          full_name: client.name,
          company: client.company ?? null,
          email: client.email,
          phone: client.phone ?? null,
          timezone: client.timezone ?? null,
          gdpr_consent: client.gdpr_consent,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'id' }
      )

    if (profileError) {
      return fail('Failed to create client profile.')
    }

    const { error: memberError } = await admin.from('client_members').upsert({
      client_id: clientId,
      profile_id: invitedProfileId
    })

    if (memberError) {
      return fail('Failed to link client membership.')
    }

    // TODO: Trigger email invite for the client portal user.
  }

  const { data: projectRow, error: projectError } = await admin
    .from('projects')
    .insert({
      client_id: clientId,
      name: project.name,
      description: project.description,
      status: 'Brief Gathered',
      due_date: project.due_date ?? null,
      assignee_profile_id: ownerUser.id
    })
    .select('id')
    .single()

  if (projectError || !projectRow) {
    return fail('Failed to create project.')
  }

  projectId = projectRow.id

  const { error: briefError } = await admin.from('briefs').insert({
    project_id: projectId,
    answers: brief,
    completed: true
  })

  if (briefError) {
    return fail('Failed to save brief.')
  }

  if (project.invoice_amount && project.invoice_amount > 0) {
    const { error: invoiceError } = await admin.from('invoices').insert({
      project_id: projectId,
      status: 'Quote',
      amount: project.invoice_amount,
      currency: project.currency ?? 'EUR',
      issued_at: new Date().toISOString()
    })

    if (invoiceError) {
      return fail('Failed to create quote.')
    }
  }

  if (!projectId) {
    return fail('Failed to create project.')
  }

  return { ok: true, projectId }
}
