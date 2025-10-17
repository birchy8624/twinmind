export function normalizeUrl(value?: string | null): string | undefined {
  if (!value) {
    return undefined
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return undefined
  }

  return trimmed.startsWith('http://') || trimmed.startsWith('https://') ? trimmed : `https://${trimmed}`
}

export function isValidUrl(value: string): boolean {
  try {
    // eslint-disable-next-line no-new
    new URL(value.startsWith('http') ? value : `https://${value}`)
    return true
  } catch (error) {
    return false
  }
}
