import type { Metadata } from 'next'

import SetupAccountForm from './SetupAccountForm'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Complete your account | TwinMinds Studio',
  description:
    'Verify your TwinMinds Studio invitation, set your name, and choose a password to access the workspace dashboard.'
}

export default function SetupAccountPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <SetupAccountForm mode="invite" />
    </div>
  )
}
