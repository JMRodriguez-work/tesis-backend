import { eq } from 'drizzle-orm'
import { ApiError } from '../../../shared/http/api-response'
import type { DB } from '../../../shared/db'
import * as schema from '../../../shared/db/schema'

export const ADMIN_ROLE_ID = 1

export type ResolveItemBranchInput = {
  requestedBranchId?: string | null
  userRoleId: number | null
  userBranchId: string | null
  userOrganizationId: string | null
}

export type ResolvedBranch = {
  branchId: string
}

export async function resolveItemBranchForWrite(
  db: DB,
  input: ResolveItemBranchInput,
): Promise<ResolvedBranch> {
  const { requestedBranchId, userRoleId, userBranchId, userOrganizationId } = input

  if (!userOrganizationId) {
    throw new ApiError('No autorizado', 403)
  }

  const isAdmin = userRoleId === ADMIN_ROLE_ID

  if (isAdmin) {
    if (requestedBranchId === null || requestedBranchId === undefined) {
      throw new ApiError('Debes indicar branchId en el body', 400)
    }

    const branch = await db
      .select({ id: schema.branches.id, organizationId: schema.branches.organizationId })
      .from(schema.branches)
      .where(eq(schema.branches.id, requestedBranchId))
      .limit(1)

    if (!branch[0] || branch[0].organizationId !== userOrganizationId) {
      throw new ApiError('La sucursal no pertenece a tu organización', 400)
    }

    return { branchId: requestedBranchId }
  }

  if (userBranchId === null) {
    throw new ApiError('No autorizado', 403)
  }

  if (
    requestedBranchId !== null &&
    requestedBranchId !== undefined &&
    requestedBranchId !== userBranchId
  ) {
    throw new ApiError('No podés crear o modificar items en otra sucursal', 400)
  }

  return { branchId: userBranchId }
}

export async function resolveItemBranchForRead(
  db: DB,
  input: ResolveItemBranchInput,
): Promise<ResolvedBranch> {
  const { requestedBranchId, userRoleId, userBranchId, userOrganizationId } = input

  if (!userOrganizationId) {
    throw new ApiError('No autorizado', 403)
  }

  const isAdmin = userRoleId === ADMIN_ROLE_ID

  if (isAdmin) {
    if (requestedBranchId === null || requestedBranchId === undefined) {
      throw new ApiError('Debes indicar branchId en query (?branchId=...)', 400)
    }

    const branch = await db
      .select({ id: schema.branches.id, organizationId: schema.branches.organizationId })
      .from(schema.branches)
      .where(eq(schema.branches.id, requestedBranchId))
      .limit(1)

    if (!branch[0] || branch[0].organizationId !== userOrganizationId) {
      throw new ApiError('La sucursal no pertenece a tu organización', 400)
    }

    return { branchId: requestedBranchId }
  }

  if (userBranchId === null) {
    throw new ApiError('No autorizado', 403)
  }

  if (
    requestedBranchId !== null &&
    requestedBranchId !== undefined &&
    requestedBranchId !== userBranchId
  ) {
    throw new ApiError('No podés consultar items de otra sucursal', 400)
  }

  return { branchId: userBranchId }
}
