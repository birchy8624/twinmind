import type { Metadata } from 'next'

import InviteActivationForm from './InviteActivationForm'

export const metadata: Metadata = {
  title: 'Activate portal access | TwinMinds Studio',
  description:
    'Confirm your email invitation and set a password to start collaborating with TwinMinds Studio in the client portal.'
}

export default function PortalInvitePage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <InviteActivationForm />
    </div>
  )
}
