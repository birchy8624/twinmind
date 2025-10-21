import { fetchWithAuth } from '../fetchWithAuth'
import type {
  DatabaseFilter,
  DatabaseOrder,
  DatabaseQueryRequest,
  DatabaseQueryResponse,
  DatabaseQueryMethod,
} from './types'

type PostgrestResponse = DatabaseQueryResponse<unknown>

const DATABASE_ENDPOINT = '/api/database'

function normalizeRequest(request: DatabaseQueryRequest): DatabaseQueryRequest {
  const normalized: DatabaseQueryRequest = {
    ...request,
    filters: request.filters ?? [],
    orderBy: request.orderBy ?? [],
  }

  if (!normalized.method) {
    normalized.method = 'select'
  }

  if (normalized.method === 'select' && !normalized.columns) {
    normalized.columns = '*'
  }

  return normalized
}

async function executeRequest(payload: DatabaseQueryRequest): Promise<PostgrestResponse> {
  const normalized = normalizeRequest(payload)

  const response = await fetchWithAuth(DATABASE_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(normalized),
  })

  if (!response.ok) {
    let errorBody: Partial<PostgrestResponse> | null = null
    try {
      errorBody = (await response.json()) as Partial<PostgrestResponse>
    } catch {
      errorBody = null
    }

    return {
      data: null,
      error:
        errorBody?.error ?? {
          message: `Database request failed with status ${response.status}`,
        },
      status: response.status,
      statusText: response.statusText,
    }
  }

  const payloadBody = (await response.json()) as PostgrestResponse

  return payloadBody
}

class RemoteQueryBuilder implements PromiseLike<PostgrestResponse> {
  private request: DatabaseQueryRequest

  constructor(table: string) {
    this.request = {
      table,
      filters: [],
      orderBy: [],
    }
  }

  private addFilter(filter: DatabaseFilter) {
    this.request.filters = this.request.filters ?? []
    this.request.filters.push(filter)
    return this
  }

  private addOrder(order: DatabaseOrder) {
    this.request.orderBy = this.request.orderBy ?? []
    this.request.orderBy.push(order)
    return this
  }

  private setMethod(method: DatabaseQueryMethod) {
    this.request.method = method
  }

  select(columns?: string) {
    this.setMethod('select')
    this.request.columns = columns
    return this
  }

  insert(values: unknown) {
    this.setMethod('insert')
    this.request.payload = values
    return this
  }

  update(values: unknown) {
    this.setMethod('update')
    this.request.payload = values
    return this
  }

  upsert(values: unknown) {
    this.setMethod('upsert')
    this.request.payload = values
    return this
  }

  delete() {
    this.setMethod('delete')
    return this
  }

  eq(column: string, value: unknown) {
    return this.addFilter({ type: 'eq', column, value })
  }

  in(column: string, value: unknown[]) {
    return this.addFilter({ type: 'in', column, value })
  }

  ilike(column: string, value: string) {
    return this.addFilter({ type: 'ilike', column, value })
  }

  not(column: string, operator: string, value: unknown) {
    return this.addFilter({ type: 'not', column, operator, value })
  }

  order(column: string, options: { ascending?: boolean; nullsFirst?: boolean } = {}) {
    return this.addOrder({ column, ascending: options.ascending, nullsFirst: options.nullsFirst })
  }

  limit(count: number) {
    this.request.limit = count
    return this
  }

  single() {
    this.request.response = 'single'
    return this
  }

  maybeSingle() {
    this.request.response = 'maybeSingle'
    return this
  }

  private execute() {
    return executeRequest(this.request)
  }

  then<TResult1 = PostgrestResponse, TResult2 = never>(
    onfulfilled?: ((value: PostgrestResponse) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return this.execute().then(onfulfilled ?? undefined, onrejected ?? undefined)
  }

  catch<TResult = never>(onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null) {
    return this.execute().catch(onrejected ?? undefined)
  }

  finally(onfinally?: (() => void) | null) {
    return this.execute().finally(onfinally ?? undefined)
  }
}

export function createDatabaseProxy() {
  return {
    from(table: string) {
      return new RemoteQueryBuilder(table)
    },
  }
}

export type DatabaseProxyClient = ReturnType<typeof createDatabaseProxy>
