import Link from 'next/link'
import { notFound } from 'next/navigation'

import { AddContactForm } from './AddContactForm'

import { createServerSupabase } from '@/lib/supabase/server'

type ClientRow = {
  id: string
  name: string
}

export default async function NewClientContactPage({
  params
}: {
  params: { clientId: string }
}) {
  const supabase = createServerSupabase()

  const { data: client, error } = await supabase
    .from('clients')
    .select('id, name')
    .eq('id', params.clientId)
    .single<ClientRow>()

  if (error || !client) {
    console.error('Load client error:', error)
    notFound()
  }

  const clientName = client.name ?? 'Client'

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3 text-sm text-white/60">
        <Link href="/app/clients" className="transition hover:text-white/90">
          Clients
        </Link>
        <span aria-hidden="true">/</span>
        <Link href={`/app/clients/${client.id}`} className="transition hover:text-white/90">
          {clientName}
        </Link>
        <span aria-hidden="true">/</span>
        <span className="text-white/80">Add contact</span>
      </div>

      <div className="rounded-2xl border border-white/10 bg-base-900/40 p-6">
        <AddContactForm clientId={client.id} clientName={clientName} />
      </div>
    </div>
  )
}
