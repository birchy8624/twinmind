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

export async function createProject(input: unknown): Promise<ActionResult> {
  const parsed = ProjectWizardSchema.safeParse(input)

  if (!parsed.success) {
    return { ok: false, message: 'Invalid input.' }
  }

  try {
    const response = await apiFetch('/api/projects', {
      method: 'POST',
      body: JSON.stringify(parsed.data)
    })

    if (!response.ok) {
      let message = 'Unable to create project.'

      try {
        const body = (await response.json()) as { message?: string }
        if (body.message) {
          message = body.message
        }
      } catch (error) {
        console.error('createProject parse error:', error)
      }

      return { ok: false, message }
    }

    const body = (await response.json()) as { projectId?: string }

    if (!body.projectId) {
      return { ok: false, message: 'Unable to create project.' }
    }

    return { ok: true, projectId: body.projectId }
  } catch (error) {
    console.error('createProject request error:', error)
    return { ok: false, message: 'Unable to create project.' }
  }
}
