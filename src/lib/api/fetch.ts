function resolveBaseUrlFromEnv() {
  const envSiteUrl = process.env.NEXT_PUBLIC_SITE_URL
  if (envSiteUrl) {
    try {
      const url = new URL(envSiteUrl)
      return url.origin
    } catch (error) {
      console.error('Invalid NEXT_PUBLIC_SITE_URL value provided:', error)
    }
  }

  const vercelUrl = process.env.NEXT_PUBLIC_VERCEL_URL
  if (vercelUrl) {
    return `https://${vercelUrl}`
  }

  return 'http://localhost:3000'
}

function ensureHeaders(init: RequestInit) {
  const headersInit = new Headers(init.headers ?? {})

  if (init.body && typeof init.body === 'string' && !headersInit.has('content-type')) {
    headersInit.set('content-type', 'application/json')
  }

  if (!headersInit.has('accept')) {
    headersInit.set('accept', 'application/json')
  }

  return headersInit
}

async function serverFetch(path: string, init: RequestInit) {
  const { headers, cookies } = await import('next/headers')

  const headerList = headers()
  const host = headerList.get('x-forwarded-host') ?? headerList.get('host')
  const protocol = headerList.get('x-forwarded-proto') ?? 'https'
  const baseUrl = host ? `${protocol}://${host}` : resolveBaseUrlFromEnv()

  const headersInit = ensureHeaders(init)

  const cookieStore = cookies()
  const cookieEntries = cookieStore.getAll()
  if (cookieEntries.length > 0 && !headersInit.has('cookie')) {
    headersInit.set(
      'cookie',
      cookieEntries.map(({ name, value }) => `${name}=${value}`).join('; ')
    )
  }

  return fetch(new URL(path, baseUrl).toString(), {
    ...init,
    headers: headersInit,
    cache: 'no-store',
    credentials: 'include'
  })
}

function clientFetch(path: string, init: RequestInit) {
  const headersInit = ensureHeaders(init)

  return fetch(path, {
    ...init,
    headers: headersInit,
    credentials: init.credentials ?? 'include'
  })
}

export async function apiFetch(path: string, init: RequestInit = {}) {
  if (typeof window === 'undefined') {
    return serverFetch(path, init)
  }

  return clientFetch(path, init)
}
