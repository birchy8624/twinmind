import { NextResponse } from 'next/server'

import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/types/supabase'

import { getAccessContext, HttpError, type ServerSupabaseClient } from '../../../_lib/access'

const INVOICES = 'invoices' as const
const PROJECTS = 'projects' as const

export const runtime = 'nodejs'

type InvoiceRow = Pick<
  Database['public']['Tables']['invoices']['Row'],
  | 'id'
  | 'project_id'
  | 'amount'
  | 'currency'
  | 'status'
  | 'issued_at'
  | 'due_at'
  | 'external_url'
  | 'paid_at'
  | 'created_at'
  | 'updated_at'
>

type SaveInvoicePayload = {
  invoiceId?: string
  amount: number
  currency: string
  status?: Database['public']['Enums']['invoice_status'] | null
  issued_at?: string | null
  due_at?: string | null
  external_url?: string | null
  paid_at?: string | null
}

type DeleteInvoicePayload = {
  invoiceId: string
}

async function ensureProjectAccess(
  supabase: ServerSupabaseClient,
  projectId: string,
  role: Database['public']['Enums']['role_enum'] | null,
  clientMemberships: string[],
) {
  if (role !== 'client') {
    return
  }

  const typedSupabase = supabase as unknown as SupabaseClient<Database>

  const { data, error } = await typedSupabase
    .from(PROJECTS)
    .select('client_id')
    .eq('id', projectId)
    .maybeSingle<{ client_id: string | null }>()

  if (error) {
    console.error('invoice project verification error:', error)
    throw new HttpError('Unable to verify project access.', 500)
  }

  if (!data?.client_id || !clientMemberships.includes(data.client_id)) {
    throw new HttpError('Project not found.', 404)
  }
}

function sanitizeCurrency(value: string): string {
  return value.trim().toUpperCase()
}

export async function POST(
  request: Request,
  context: { params: { projectId: string } },
) {
  try {
    const access = await getAccessContext()
    await ensureProjectAccess(access.supabase, context.params.projectId, access.role, access.clientMemberships)

    const supabase = access.supabase as unknown as SupabaseClient<Database>

    let payload: SaveInvoicePayload
    try {
      payload = (await request.json()) as SaveInvoicePayload
    } catch (error) {
      console.error('invoice payload parse error:', error)
      return NextResponse.json({ message: 'Invalid request body.' }, { status: 400 })
    }

    if (typeof payload.amount !== 'number' || Number.isNaN(payload.amount)) {
      return NextResponse.json({ message: 'Invoice amount must be a number.' }, { status: 400 })
    }

    if (!payload.currency || typeof payload.currency !== 'string') {
      return NextResponse.json({ message: 'Invoice currency is required.' }, { status: 400 })
    }

    const normalizedCurrency = sanitizeCurrency(payload.currency)

    if (payload.invoiceId) {
      const updatePayload: Database['public']['Tables']['invoices']['Update'] = {
        amount: payload.amount,
        currency: normalizedCurrency,
        issued_at: payload.issued_at ?? null,
        due_at: payload.due_at ?? null,
        external_url: payload.external_url ?? null,
        paid_at: payload.paid_at ?? null,
      }

      if (payload.status) {
        updatePayload.status = payload.status
      }

      const { data, error } = await supabase
        .from(INVOICES)
        .update(updatePayload)
        .eq('id', payload.invoiceId)
        .eq('project_id', context.params.projectId)
        .select(
          'id, project_id, amount, currency, status, issued_at, due_at, external_url, paid_at, created_at, updated_at',
        )
        .maybeSingle<InvoiceRow>()

      if (error) {
        console.error('invoice update error:', error)
        return NextResponse.json({ message: 'Unable to update invoice.' }, { status: 500 })
      }

      if (!data) {
        return NextResponse.json({ message: 'Invoice not found.' }, { status: 404 })
      }

      return NextResponse.json({ invoice: data })
    }

    const insertPayload: Database['public']['Tables']['invoices']['Insert'] = {
      project_id: context.params.projectId,
      amount: payload.amount,
      currency: normalizedCurrency,
      issued_at: payload.issued_at ?? null,
      due_at: payload.due_at ?? null,
      external_url: payload.external_url ?? null,
      paid_at: payload.paid_at ?? null,
    }

    if (payload.status) {
      insertPayload.status = payload.status
    }

    const { data, error } = await supabase
      .from(INVOICES)
      .insert(insertPayload)
      .select('id, project_id, amount, currency, status, issued_at, due_at, external_url, paid_at, created_at, updated_at')
      .maybeSingle<InvoiceRow>()

    if (error) {
      console.error('invoice insert error:', error)
      return NextResponse.json({ message: 'Unable to create invoice.' }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ message: 'Unable to create invoice.' }, { status: 500 })
    }

    return NextResponse.json({ invoice: data })
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ message: error.message }, { status: error.status })
    }

    console.error('invoice upsert unexpected error:', error)
    return NextResponse.json({ message: 'Unable to save invoice.' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  context: { params: { projectId: string } },
) {
  try {
    const access = await getAccessContext()
    await ensureProjectAccess(access.supabase, context.params.projectId, access.role, access.clientMemberships)

    const supabase = access.supabase as unknown as SupabaseClient<Database>

    let payload: DeleteInvoicePayload
    try {
      payload = (await request.json()) as DeleteInvoicePayload
    } catch (error) {
      console.error('invoice delete payload parse error:', error)
      return NextResponse.json({ message: 'Invalid request body.' }, { status: 400 })
    }

    if (!payload.invoiceId) {
      return NextResponse.json({ message: 'Invoice ID is required.' }, { status: 400 })
    }

    const { error } = await supabase
      .from(INVOICES)
      .delete()
      .eq('id', payload.invoiceId)
      .eq('project_id', context.params.projectId)

    if (error) {
      console.error('invoice delete error:', error)
      return NextResponse.json({ message: 'Unable to delete invoice.' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ message: error.message }, { status: error.status })
    }

    console.error('invoice delete unexpected error:', error)
    return NextResponse.json({ message: 'Unable to delete invoice.' }, { status: 500 })
  }
}
