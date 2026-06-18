import { eq } from 'drizzle-orm'
import { ApiError } from '../../../shared/http/api-response'
import type { DB } from '../../../shared/db'
import * as schema from '../../../shared/db/schema'
import { findBranchByIdRaw } from '../infra/repository/item-category.repository'

export const ADMIN_ROLE_ID = 1

export type ResolveBranchInput = {
  requestedBranchId?: string | null
  userRoleId: number | null
  userBranchId: string | null
  userOrganizationId: string | null
}

export type ResolvedBranch = {
  branchId: string
}

/**
 * Determina la branch efectiva para una operación sobre item-categories.
 *
 * - Admin (roleId === 1) sin branchId solicitada → 400 (debe elegir branch).
 * - Admin con branchId solicitada → valida que la branch pertenece a su org.
 * - Manager/Employee → fuerza user.branchId. Si el body trae branchId de otra branch → 400.
 */
export async function resolveBranchForWrite(
  db: DB,
  input: ResolveBranchInput,
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

    const branch = await findBranchByIdRaw(db, requestedBranchId)
    if (!branch || branch.organizationId !== userOrganizationId) {
      throw new ApiError('La sucursal no pertenece a tu organización', 400)
    }

    return { branchId: requestedBranchId }
  }

  if (userBranchId === null) {
    throw new ApiError('No autorizado', 403)
  }

  if (requestedBranchId !== null && requestedBranchId !== undefined && requestedBranchId !== userBranchId) {
    throw new ApiError('No podés crear o modificar categorías en otra sucursal', 400)
  }

  return { branchId: userBranchId }
}

/**
 * Resuelve la branch para operaciones de lectura (GET /item-categories).
 *
 * - Admin sin branchId en query → 400 (debe elegir branch).
 * - Admin con branchId → valida que pertenece a su org.
 * - Manager/Employee → fuerza user.branchId. Si trae branchId de otra branch en query → ignora (no es peligroso, es solo lectura).
 */
export async function resolveBranchForRead(
  db: DB,
  input: ResolveBranchInput,
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

    const branch = await findBranchByIdRaw(db, requestedBranchId)
    if (!branch || branch.organizationId !== userOrganizationId) {
      throw new ApiError('La sucursal no pertenece a tu organización', 400)
    }

    return { branchId: requestedBranchId }
  }

  if (userBranchId === null) {
    throw new ApiError('No autorizado', 403)
  }

  if (requestedBranchId !== null && requestedBranchId !== undefined && requestedBranchId !== userBranchId) {
    throw new ApiError('No podés consultar categorías de otra sucursal', 400)
  }

  return { branchId: userBranchId }
}
