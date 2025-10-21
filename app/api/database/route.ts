import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'

import type { Database } from '@/types/supabase'

import type { DatabaseFilter, DatabaseQueryRequest } from '@/lib/api/types'

function applyFilter(query: any, filter: DatabaseFilter) {
  switch (filter.type) {
    case 'eq':
      return query.eq(filter.column, filter.value)
    case 'in':
      return query.in(filter.column, filter.value)
    case 'ilike':
      return query.ilike(filter.column, filter.value)
    case 'not':
      return query.not(filter.column, filter.operator, filter.value)
    default:
      return query
  }
}

export async function POST(request: Request) {
  const payload = (await request.json()) as DatabaseQueryRequest

  const cookieStore = cookies()
  const supabase = createRouteHandlerClient<Database>({ cookies: cookieStore })

  const { table, method = 'select', columns, payload: values, filters = [], orderBy = [], limit, response } = payload

  let query = supabase.from(table)

  if (method === 'select') {
    query = query.select(columns ?? '*')
  } else if (method === 'insert') {
    query = query.insert(values)
    if (columns) {
      query = query.select(columns)
    }
  } else if (method === 'update') {
    query = query.update(values)
    if (columns) {
      query = query.select(columns)
    }
  } else if (method === 'upsert') {
    query = query.upsert(values)
    if (columns) {
      query = query.select(columns)
    }
  } else if (method === 'delete') {
    query = query.delete()
    if (columns) {
      query = query.select(columns)
    }
  }

  for (const filter of filters) {
    query = applyFilter(query, filter)
  }

  for (const order of orderBy) {
    query = query.order(order.column, {
      ascending: order.ascending ?? true,
      nullsFirst: order.nullsFirst,
    })
  }

  if (typeof limit === 'number') {
    query = query.limit(limit)
  }

  let result

  if (response === 'single') {
    result = await query.single()
  } else if (response === 'maybeSingle') {
    result = await query.maybeSingle()
  } else {
    result = await query
  }

  const status = result.status && result.status !== 204 ? result.status : 200

  return NextResponse.json(result, { status })
}
