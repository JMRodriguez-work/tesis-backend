import { and, eq } from 'drizzle-orm'
import { ApiError } from '../../../shared/http/api-response'
import type { DB } from '../../../shared/db'
import * as schema from '../../../shared/db/schema'

export const ADMIN_ROLE_ID = 1

export type ScopeInput = {
  userRoleId: number | null
  userBranchId: string | null
  userOrganizationId: string | null
}

/**
 * Devuelve el branchId efectivo para el listado de warehouses:
 * - Admin: no tiene branch efectiva, ve todos los warehouses de la org.
 * - Manager/Employee: su branchId. Si no tiene, error.
 */
export function resolveListScope(input: ScopeInput): { branchId: string | null; isAdmin: boolean } {
  if (!input.userOrganizationId) {
    throw new ApiError('No autorizado', 403)
  }
  const isAdmin = input.userRoleId === ADMIN_ROLE_ID
  if (isAdmin) return { branchId: null, isAdmin: true }
  if (input.userBranchId === null) throw new ApiError('No autorizado', 403)
  return { branchId: input.userBranchId, isAdmin: false }
}

/**
 * Valida que un warehouse (por id) sea accesible para el user.
 * - Admin: warehouse pertenece a su org.
 * - Manager/Employee: warehouse está asignado a su branch.
 * Devuelve el warehouse (raw) si OK, sino tira 404.
 */
export async function assertWarehouseAccess(
  db: DB,
  warehouseId: string,
  input: ScopeInput,
): Promise<typeof schema.warehouses.$inferSelect> {
  const wh = await db
    .select()
    .from(schema.warehouses)
    .where(
      and(
        eq(schema.warehouses.id, warehouseId),
        eq(schema.warehouses.organizationId, input.userOrganizationId ?? ''),
        // include soft-deleted? for the DELETE endpoint we want to see them
        // to return proper 404; the soft-delete filter is done by the caller
        // when needed.
      ),
    )
    .limit(1)
    .then((r) => r[0] ?? null)

  if (!wh) throw new ApiError('Depósito no encontrado', 404)

  const isAdmin = input.userRoleId === ADMIN_ROLE_ID
  if (isAdmin) return wh

  if (input.userBranchId === null) throw new ApiError('No autorizado', 403)

  const assignment = await db
    .select({ id: schema.warehouseBranches.warehouseId })
    .from(schema.warehouseBranches)
    .where(
      and(
        eq(schema.warehouseBranches.warehouseId, warehouseId),
        eq(schema.warehouseBranches.branchId, input.userBranchId),
      ),
    )
    .limit(1)

  if (!assignment[0]) throw new ApiError('Depósito no encontrado', 404)
  return wh
}
