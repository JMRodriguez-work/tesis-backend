import { eq } from 'drizzle-orm'
import { ApiError } from '../../../shared/http/api-response'
import type { DB } from '../../../shared/db'
import * as schema from '../../../shared/db/schema'

const ADMIN_ROLE_ID = 1

export type RoleAssignment = {
  roleId: number
  branchId: string | null
}

export async function assertRoleExists(db: DB, roleId: number) {
  const result = await db
    .select({ id: schema.roles.id })
    .from(schema.roles)
    .where(eq(schema.roles.id, roleId))
    .limit(1)

  if (!result[0]) {
    throw new ApiError(`El rol con id ${roleId} no existe`, 400)
  }
}

export function assertBranchRoleConsistency({ roleId, branchId }: RoleAssignment) {
  if (roleId === ADMIN_ROLE_ID) {
    if (branchId !== null && branchId !== undefined) {
      throw new ApiError('Los usuarios Admin no pueden tener una sucursal asignada', 400)
    }
    return
  }

  if (branchId === null || branchId === undefined) {
    throw new ApiError('Los usuarios con rol distinto a Admin deben tener una sucursal asignada', 400)
  }
}
