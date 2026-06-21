import { ApiError } from '../../../shared/http/api-response'

export const ADMIN_ROLE_ID = 1

export type ResolveReportScopeInput = {
  requestedBranchId?: string | null
  userRoleId: number | null
  userBranchId: string | null
  userOrganizationId: string | null
}

export type ResolvedReportScope = {
  organizationId: string
  branchId: string | null
  isAdmin: boolean
}

export function resolveReportScope(
  input: ResolveReportScopeInput,
): ResolvedReportScope {
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
    throw new ApiError('No podés consultar reportes de otra sucursal', 400)
  }
  return {
    organizationId: input.userOrganizationId,
    branchId: input.userBranchId,
    isAdmin: false,
  }
}
