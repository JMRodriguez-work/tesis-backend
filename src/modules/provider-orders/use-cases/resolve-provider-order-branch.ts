import { ApiError } from '../../../shared/http/api-response'

export const ADMIN_ROLE_ID = 1

export type ResolveProviderOrderBranchInput = {
  requestedBranchId?: string | null
  userRoleId: number | null
  userBranchId: string | null
  userOrganizationId: string | null
}

export type ResolvedBranch = { branchId: string }

export type ResolveProviderOrderListInput = {
  requestedBranchId?: string | null
  userRoleId: number | null
  userBranchId: string | null
  userOrganizationId: string | null
}

export type ResolvedListScope = {
  organizationId: string
  branchId: string | null
  isAdmin: boolean
}

export function resolveProviderOrderBranchForWrite(
  input: ResolveProviderOrderBranchInput,
): ResolvedBranch {
  const { requestedBranchId, userRoleId, userBranchId, userOrganizationId } = input
  if (!userOrganizationId) throw new ApiError('No autorizado', 403)

  const isAdmin = userRoleId === ADMIN_ROLE_ID
  if (isAdmin) {
    if (requestedBranchId === null || requestedBranchId === undefined) {
      throw new ApiError('Debes indicar branchId en el body', 400)
    }
    return { branchId: requestedBranchId }
  }

  if (userBranchId === null) throw new ApiError('No autorizado', 403)
  if (
    requestedBranchId !== null &&
    requestedBranchId !== undefined &&
    requestedBranchId !== userBranchId
  ) {
    throw new ApiError('No podés crear órdenes en otra sucursal', 400)
  }
  return { branchId: userBranchId }
}

export function resolveProviderOrderListScope(
  input: ResolveProviderOrderListInput,
): ResolvedListScope {
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
    throw new ApiError('No podés consultar órdenes de otra sucursal', 400)
  }
  return {
    organizationId: input.userOrganizationId,
    branchId: input.userBranchId,
    isAdmin: false,
  }
}
