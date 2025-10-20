export const ACTIVE_ACCOUNT_STORAGE_KEY = 'twinmind.activeAccountId'
export const ACTIVE_ACCOUNT_COOKIE = 'twinmind_active_account'

type RoleHierarchy = 'member' | 'owner'

export const ACCOUNT_ROLE_RANK: Record<RoleHierarchy, number> = {
  member: 1,
  owner: 2
}

export const isAccountRoleAtLeast = (
  role: RoleHierarchy | null | undefined,
  minimum: RoleHierarchy
): boolean => {
  if (!role) {
    return false
  }

  return ACCOUNT_ROLE_RANK[role] >= ACCOUNT_ROLE_RANK[minimum]
}
