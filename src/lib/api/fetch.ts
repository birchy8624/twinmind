import { cookies, headers } from 'next/headers'

function resolveBaseUrl() {
  const headerList = headers()
  const host = headerList.get('x-forwarded-host') ?? headerList.get('host')
  const protocol = headerList.get('x-forwarded-proto') ?? 'https'

  if (host) {
    return `${protocol}://${host}`
  }

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

function resolveCookieHeader() {
  const store = cookies()
  const entries = store.getAll()

  if (entries.length === 0) {
    return null
  }

  return entries.map(({ name, value }) => `${name}=${value}`).join('; ')
}

export async function apiFetch(path: string, init: RequestInit = {}) {
  const url = new URL(path, resolveBaseUrl())
  const headersInit = new Headers(init.headers ?? {})

  const cookieHeader = resolveCookieHeader()
  if (cookieHeader && !headersInit.has('cookie')) {
    headersInit.set('cookie', cookieHeader)
  }

  if (init.body && typeof init.body === 'string' && !headersInit.has('content-type')) {
    headersInit.set('content-type', 'application/json')
  }

  if (!headersInit.has('accept')) {
    headersInit.set('accept', 'application/json')
  }

  return fetch(url.toString(), {
    ...init,
    headers: headersInit,
    cache: 'no-store',
    credentials: 'include'
  })
}
