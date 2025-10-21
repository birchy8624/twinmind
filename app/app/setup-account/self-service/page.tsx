import type { Metadata } from 'next'

import SetupAccountForm from '../SetupAccountForm'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Finish your account setup | TwinMinds Studio',
  description:
    'Confirm your details to start collaborating inside the TwinMinds Studio workspace.',
}

export default function SelfServiceSetupAccountPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <SetupAccountForm mode="self-service" />
    </div>
  )
}
