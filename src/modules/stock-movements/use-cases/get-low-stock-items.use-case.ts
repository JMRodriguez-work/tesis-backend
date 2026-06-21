import { eq } from 'drizzle-orm'
import { ApiError } from '../../../shared/http/api-response'
import type { DB } from '../../../shared/db'
import * as schema from '../../../shared/db/schema'
import { findLowStockItems } from '../infra/repository/stock-movement.repository'
import {
  resolveStockMovementListScope,
  type ResolveStockMovementListInput,
} from './resolve-stock-movement-access'

export type GetLowStockItemsInput = ResolveStockMovementListInput & {}

export class GetLowStockItems {
  constructor(private readonly db: DB) {}

  async execute(input: GetLowStockItemsInput) {
    const scope = resolveStockMovementListScope(input)
    if (!scope.organizationId) throw new ApiError('No autorizado', 403)

    if (input.requestedBranchId && !scope.isAdmin) {
      throw new ApiError('No autorizado', 403)
    }

    let branchId: string | null
    if (scope.isAdmin) {
      branchId = scope.branchId
      if (branchId) {
        const branch = await this.db
          .select({ organizationId: schema.branches.organizationId })
          .from(schema.branches)
          .where(eq(schema.branches.id, branchId))
          .limit(1)
        if (!branch[0] || branch[0].organizationId !== scope.organizationId) {
          throw new ApiError('La sucursal no pertenece a tu organización', 400)
        }
      }
    } else {
      branchId = scope.branchId
    }

    const data = await findLowStockItems(this.db, scope.organizationId, branchId)
    return data
  }
}
