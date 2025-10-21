'use server'

import { z } from 'zod'

import { apiFetch } from '@/lib/api/fetch'

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

  try {
    const response = await apiFetch('/api/clients', {
      method: 'POST',
      body: JSON.stringify(parsed.data)
    })

    if (!response.ok) {
      let message = 'Unable to create client project.'

      try {
        const body = (await response.json()) as { message?: string }
        if (body.message) {
          message = body.message
        }
      } catch (error) {
        console.error('createClientProject parse error:', error)
      }

      return { ok: false, message }
    }

    const body = (await response.json()) as { projectId?: string }

    if (!body.projectId) {
      return { ok: false, message: 'Unable to create client project.' }
    }

    return { ok: true, projectId: body.projectId }
  } catch (error) {
    console.error('createClientProject request error:', error)
    return { ok: false, message: 'Unable to create client project.' }
  }
}
