export type DatabaseQueryMethod = 'select' | 'insert' | 'update' | 'delete' | 'upsert'

export type DatabaseFilter =
  | { type: 'eq'; column: string; value: unknown }
  | { type: 'in'; column: string; value: unknown[] }
  | { type: 'ilike'; column: string; value: string }
  | { type: 'not'; column: string; operator: string; value: unknown }

export type DatabaseOrder = {
  column: string
  ascending?: boolean
  nullsFirst?: boolean
}

export type DatabaseQueryRequest = {
  table: string
  method?: DatabaseQueryMethod
  columns?: string | undefined
  payload?: unknown
  filters?: DatabaseFilter[]
  orderBy?: DatabaseOrder[]
  limit?: number
  response?: 'default' | 'single' | 'maybeSingle'
}

export type DatabaseQueryResponse<T = unknown> = {
  data: T
  error: { message: string; details?: string | null; hint?: string | null; code?: string | null } | null
  status: number
  statusText: string
}

export type StorageListRequest = {
  bucket: string
  path?: string
  options?: {
    limit?: number
    offset?: number
    sortBy?: { column: string; order: 'asc' | 'desc' }
    search?: string
  }
}

export type StorageSignedUrlRequest = {
  bucket: string
  path: string
  expiresIn: number
}

export type StorageRemoveRequest = {
  bucket: string
  paths: string[]
}

export type StorageUploadRequest = {
  bucket: string
  path: string
  upsert?: boolean
}
