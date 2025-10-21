import type { Metadata } from 'next'

import SetupAccountForm from './SetupAccountForm'

export const metadata: Metadata = {
  title: 'Complete your account | TwinMinds Studio',
  description:
    'Verify your TwinMinds Studio invitation or sign-up, add your details, and finish preparing your workspace.'
}

export default function SetupAccountPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <SetupAccountForm />
    </div>
  )
}
