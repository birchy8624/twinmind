import type { Database, Json } from '@/types/supabase'

type ClientOnboardingTable =
  Database['public']['Tables']['client_onboarding_submissions']

export type ClientOnboardingSubmission = Omit<
  ClientOnboardingTable['Insert'],
  'id' | 'created_at' | 'competitors'
> & { competitors: string[] }

export type ClientOnboardingResponse = Omit<
  ClientOnboardingTable['Row'],
  'competitors'
> & { competitors: string[] }

function getSupabaseCredentials() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error('Supabase environment variables are not configured.')
  }

  return { url, anonKey }
}

const normalizeCompetitors = (value: Json): string[] => {
  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
    return value as string[]
  }

  return []
}

export async function insertClientOnboarding(
  payload: ClientOnboardingSubmission
): Promise<ClientOnboardingResponse | null> {
  const { url, anonKey } = getSupabaseCredentials()

  const supabasePayload: ClientOnboardingTable['Insert'] = {
    ...payload,
    competitors: payload.competitors,
  }

  const response = await fetch(`${url}/rest/v1/client_onboarding_submissions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      Prefer: 'return=representation'
    },
    body: JSON.stringify(supabasePayload)
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

  const data = (await response.json()) as ClientOnboardingTable['Row'][]

  if (!data[0]) {
    return null
  }

  const { competitors, ...rest } = data[0]

  return {
    ...rest,
    competitors: normalizeCompetitors(competitors ?? []),
  }
}
