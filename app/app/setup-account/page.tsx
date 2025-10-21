import type { Metadata } from 'next'

import SetupAccountForm from './SetupAccountForm'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Complete your account | TwinMinds Studio',
  description:
    'Verify your TwinMinds Studio invitation, set your name, and choose a password to access the workspace dashboard.'
}

type SetupAccountPageProps = {
  searchParams: Record<string, string | string[] | undefined>
}

export default function SetupAccountPage({ searchParams }: SetupAccountPageProps) {
  const searchMode = typeof searchParams?.mode === 'string' ? searchParams.mode : null
  const searchSource = typeof searchParams?.source === 'string' ? searchParams.source : null
  const mode = searchMode === 'self-service' || searchSource === 'self-service' ? 'self-service' : 'invite'

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <SetupAccountForm mode={mode} />
    </div>
  )
}
