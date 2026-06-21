import { eq } from 'drizzle-orm'
import { ApiError } from '../../../shared/http/api-response'
import type { DB } from '../../../shared/db'
import * as schema from '../../../shared/db/schema'

export const ADMIN_ROLE_ID = 1

export type ResolveCustomerAnalyticsScopeInput = {
  requestedBranchId?: string | null
  userRoleId: number | null
  userBranchId: string | null
  userOrganizationId: string | null
}

export type ResolvedCustomerAnalyticsScope = {
  organizationId: string
  branchId: string | null
  isAdmin: boolean
}

export function resolveCustomerAnalyticsScope(
  input: ResolveCustomerAnalyticsScopeInput,
): ResolvedCustomerAnalyticsScope {
  if (!input.userOrganizationId) throw new ApiError('No autorizado', 403)
  const isAdmin = input.userRoleId === ADMIN_ROLE_ID
  if (isAdmin) {
    if (input.requestedBranchId !== null && input.requestedBranchId !== undefined) {
      return {
        organizationId: input.userOrganizationId,
        branchId: input.requestedBranchId,
        isAdmin: true,
      }
    }
    return {
      organizationId: input.userOrganizationId,
      branchId: null,
      isAdmin: true,
    }
  }
  if (input.userBranchId === null) throw new ApiError('No autorizado', 403)
  if (
    input.requestedBranchId !== null &&
    input.requestedBranchId !== undefined &&
    input.requestedBranchId !== input.userBranchId
  ) {
    throw new ApiError('No podés consultar otra sucursal', 400)
  }
  return {
    organizationId: input.userOrganizationId,
    branchId: input.userBranchId,
    isAdmin: false,
  }
}

export async function findBranchOrg(
  db: DB,
  branchId: string,
  userOrganizationId: string,
): Promise<boolean> {
  const rows = await db
    .select({ organizationId: schema.branches.organizationId })
    .from(schema.branches)
    .where(eq(schema.branches.id, branchId))
    .limit(1)
  const orgId = rows[0]?.organizationId
  return !!orgId && orgId === userOrganizationId
}
