import { eq } from 'drizzle-orm'
import { ApiError } from '../../../shared/http/api-response'
import type { DB } from '../../../shared/db'
import * as schema from '../../../shared/db/schema'
import {
  findStockMovementById,
  findStockMovementByIdRaw,
} from '../infra/repository/stock-movement.repository'

export type GetStockMovementByIdInput = {
  movementId: string
  userOrganizationId: string | null
  userBranchId: string | null
  userRoleId: number | null
  isAdmin: boolean
}

export class GetStockMovementById {
  constructor(private readonly db: DB) {}

  async execute(input: GetStockMovementByIdInput) {
    if (!input.userOrganizationId) throw new ApiError('No autorizado', 403)

    const movement = await findStockMovementByIdRaw(this.db, input.movementId)
    if (!movement) throw new ApiError('Movimiento no encontrado', 404)

    const branch = await this.db
      .select({ organizationId: schema.branches.organizationId })
      .from(schema.branches)
      .where(eq(schema.branches.id, movement.branchId))
      .limit(1)
    if (!branch[0] || branch[0].organizationId !== input.userOrganizationId) {
      throw new ApiError('Movimiento no encontrado', 404)
    }

    if (!input.isAdmin) {
      if (input.userBranchId === null || movement.branchId !== input.userBranchId) {
        throw new ApiError('Movimiento no encontrado', 404)
      }
    }

    const enriched = await findStockMovementById(this.db, input.movementId)
    if (!enriched) throw new ApiError('Movimiento no encontrado', 404)
    return enriched
  }
}
