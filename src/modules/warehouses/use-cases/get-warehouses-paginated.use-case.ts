import type { DB } from '../../../shared/db'
import {
  countWarehousesByOrganization,
  countWarehousesByBranch,
  findWarehousesByOrganization,
  findWarehousesByBranch,
  type ListWarehousesFilters,
  type WarehouseWithRelations,
} from '../infra/repository/warehouse.repository'
import { resolveListScope, type ScopeInput } from './resolve-warehouse-access'

export type GetWarehousesPaginatedInput = ScopeInput & {
  filters: ListWarehousesFilters
  page: number
  limit: number
}

export type GetWarehousesPaginatedOutput = {
  data: WarehouseWithRelations[]
  meta: { page: number; limit: number; total: number; totalPages: number }
}

export class GetWarehousesPaginated {
  constructor(private readonly db: DB) {}

  async execute(input: GetWarehousesPaginatedInput): Promise<GetWarehousesPaginatedOutput> {
    const { branchId, isAdmin } = resolveListScope(input)
    const offset = (input.page - 1) * input.limit

    if (isAdmin) {
      const orgId = input.userOrganizationId!
      const [data, total] = await Promise.all([
        findWarehousesByOrganization(this.db, orgId, input.filters, input.limit, offset),
        countWarehousesByOrganization(this.db, orgId, input.filters),
      ])
      return {
        data,
        meta: { page: input.page, limit: input.limit, total, totalPages: total === 0 ? 0 : Math.ceil(total / input.limit) },
      }
    }

    const [data, total] = await Promise.all([
      findWarehousesByBranch(this.db, branchId!, input.filters, input.limit, offset),
      countWarehousesByBranch(this.db, branchId!, input.filters),
    ])
    return {
      data,
      meta: { page: input.page, limit: input.limit, total, totalPages: total === 0 ? 0 : Math.ceil(total / input.limit) },
    }
  }
}
