import { eq } from 'drizzle-orm'
import { ApiError } from '../../../shared/http/api-response'
import type { DB } from '../../../shared/db'
import * as schema from '../../../shared/db/schema'
import {
  countStockMovements,
  findStockMovementsPaginated,
  type ListStockMovementsFilters,
} from '../infra/repository/stock-movement.repository'
import {
  resolveStockMovementListScope,
  type ResolveStockMovementListInput,
} from './resolve-stock-movement-access'

export type GetStockMovementsPaginatedInput = ResolveStockMovementListInput & {
  filters: Omit<ListStockMovementsFilters, 'branchId' | 'organizationId'>
  page: number
  limit: number
}

export class GetStockMovementsPaginated {
  constructor(private readonly db: DB) {}

  async execute(input: GetStockMovementsPaginatedInput) {
    const scope = resolveStockMovementListScope(input)
    if (!scope.organizationId) throw new ApiError('No autorizado', 403)

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

    const filters: ListStockMovementsFilters = {
      itemId: input.filters.itemId,
      type: input.filters.type,
      branchId,
      warehouseId: input.filters.warehouseId,
      referenceType: input.filters.referenceType,
      referenceId: input.filters.referenceId,
      from: input.filters.from,
      to: input.filters.to,
    }

    const offset = (input.page - 1) * input.limit
    const [data, total] = await Promise.all([
      findStockMovementsPaginated(this.db, scope.organizationId, filters, input.limit, offset),
      countStockMovements(this.db, scope.organizationId, filters),
    ])

    return {
      data,
      meta: {
        page: input.page,
        limit: input.limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / input.limit),
      },
    }
  }
}
