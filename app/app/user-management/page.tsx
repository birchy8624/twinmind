import { redirect } from 'next/navigation'

import UserManagementClient from './UserManagementClient'
import { fetchWorkspaceUsers } from '@/lib/api/user-management'

export default async function UserManagementPage() {
  try {
    const { currentUserId, users } = await fetchWorkspaceUsers()

    return (
      <UserManagementClient currentUserId={currentUserId} initialUsers={users} />
    )
  } catch (error) {
    console.error('Failed to load workspace users:', error)

    if (error instanceof Error && error.message === 'Not authenticated.') {
      redirect('/sign_in')
    }

    redirect('/app')
  }
}
