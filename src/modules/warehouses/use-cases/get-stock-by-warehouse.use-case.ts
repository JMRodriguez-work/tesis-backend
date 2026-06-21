import type { DB } from '../../../shared/db'
import {
  countItemWarehouseStocksByWarehouse,
  findItemWarehouseStocksByWarehouse,
  type ListStockFilters,
} from '../infra/repository/warehouse.repository'
import { assertWarehouseAccess, type ScopeInput } from './resolve-warehouse-access'

export type GetStockByWarehouseInput = ScopeInput & {
  warehouseId: string
  filters: ListStockFilters
  page: number
  limit: number
}

export class GetStockByWarehouse {
  constructor(private readonly db: DB) {}

  async execute(input: GetStockByWarehouseInput) {
    await assertWarehouseAccess(this.db, input.warehouseId, input)
    const offset = (input.page - 1) * input.limit

    const [data, total] = await Promise.all([
      findItemWarehouseStocksByWarehouse(
        this.db,
        input.warehouseId,
        input.filters,
        input.limit,
        offset,
      ),
      countItemWarehouseStocksByWarehouse(this.db, input.warehouseId, input.filters),
    ])

    return {
      data,
      meta: { page: input.page, limit: input.limit, total, totalPages: total === 0 ? 0 : Math.ceil(total / input.limit) },
    }
  }
}
