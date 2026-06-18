import type { AuthUser } from '../types/app'

export function getUserScope(user: AuthUser) {
  return {
    organizationId: user.organizationId,
    branchId: user.branchId,
  }
}
