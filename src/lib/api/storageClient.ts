import { fetchWithAuth } from '../fetchWithAuth'
import type { StorageListRequest, StorageRemoveRequest, StorageSignedUrlRequest } from './types'

const STORAGE_BASE = '/api/storage'

async function jsonFetch<T>(path: string, body: unknown) {
  const response = await fetchWithAuth(`${STORAGE_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const payload = await response.json()
  return { response, payload: payload as T }
}

export function createStorageProxy() {
  return {
    from(bucket: string) {
      return {
        async list(path = '', options: StorageListRequest['options'] = {}) {
          const { response, payload } = await jsonFetch<{ data: unknown; error: unknown }>(
            '/list',
            { bucket, path, options } satisfies StorageListRequest,
          )

          return { ...(payload as { data: unknown; error: unknown }), status: response.status }
        },

        async createSignedUrl(path: string, expiresIn: number) {
          const { response, payload } = await jsonFetch<{ data: unknown; error: unknown }>(
            '/create-signed-url',
            { bucket, path, expiresIn } satisfies StorageSignedUrlRequest,
          )

          return { ...(payload as { data: unknown; error: unknown }), status: response.status }
        },

        async remove(paths: string[]) {
          const { response, payload } = await jsonFetch<{ data: unknown; error: unknown }>(
            '/remove',
            { bucket, paths } satisfies StorageRemoveRequest,
          )

          return { ...(payload as { data: unknown; error: unknown }), status: response.status }
        },

        async upload(path: string, file: File | Blob, options: { upsert?: boolean } = {}) {
          const formData = new FormData()
          formData.append('bucket', bucket)
          formData.append('path', path)
          formData.append('file', file)
          formData.append('metadata', JSON.stringify({ upsert: options.upsert ?? false }))

          const response = await fetchWithAuth(`${STORAGE_BASE}/upload`, {
            method: 'POST',
            body: formData,
          })

          const payload = await response.json()
          return { ...(payload as { data: unknown; error: unknown }), status: response.status }
        },
      }
    },
  }
}

export type StorageProxyClient = ReturnType<typeof createStorageProxy>
