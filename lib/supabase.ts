export type ClientOnboardingSubmission = {
  client_name: string
  client_email: string
  company: string
  website: string | null
  phone: string | null
  timezone: string
  budget: string | null
  gdpr_consent: boolean
  project_name: string
  project_description: string
  project_due_date: string | null
  goals: string
  target_users: string
  core_features: string
  integrations: string
  timeline: string
  success_metrics: string
  competitors: string[]
  risks: string
  invite_client: boolean
}

export type ClientOnboardingResponse = ClientOnboardingSubmission & {
  id: string
  created_at: string
}

function getSupabaseCredentials() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error('Supabase environment variables are not configured.')
  }

  return { url, anonKey }
}

export async function insertClientOnboarding(
  payload: ClientOnboardingSubmission
): Promise<ClientOnboardingResponse | null> {
  const { url, anonKey } = getSupabaseCredentials()

  const response = await fetch(`${url}/rest/v1/client_onboarding_submissions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      Prefer: 'return=representation'
    },
    body: JSON.stringify(payload)
  })

  if (!response.ok) {
    let message = 'Failed to save client onboarding details.'
    try {
      const error = (await response.json()) as { message?: string }
      if (error?.message) {
        message = error.message
      }
    } catch (parseError) {
      // ignore JSON parse errors and fallback to default message
    }
    throw new Error(message)
  }

  const data = (await response.json()) as ClientOnboardingResponse[]
  return data[0] ?? null
}
