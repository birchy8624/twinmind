import { apiFetch } from './fetch'

type SignUpProfile = {
  profile: {
    id: string
    full_name: string | null
    email: string | null
    company: string | null
  }
  account: {
    id: string
    name: string
  } | null
}

type CompleteSignUpPayload = {
  fullName: string
  companyName: string
}

async function parseJson<T>(response: Response): Promise<T> {
  const text = await response.text()

  try {
    return JSON.parse(text) as T
  } catch (error) {
    console.error('Failed to parse JSON response:', error, text)
    throw new Error('Unexpected response from API.')
  }
}

export async function fetchSignUpProfile() {
  const response = await apiFetch('/api/sign-up/complete')

  if (!response.ok) {
    const body = await parseJson<{ message?: string }>(response)
    throw new Error(body.message ?? 'Unable to load your profile details.')
  }

  return parseJson<SignUpProfile>(response)
}

export async function completeSignUp(payload: CompleteSignUpPayload) {
  const response = await apiFetch('/api/sign-up/complete', {
    method: 'POST',
    body: JSON.stringify(payload)
  })

  if (!response.ok) {
    const body = await parseJson<{ message?: string }>(response)
    throw new Error(body.message ?? 'Unable to save your details.')
  }

  return { success: true }
}

export type { SignUpProfile, CompleteSignUpPayload }
