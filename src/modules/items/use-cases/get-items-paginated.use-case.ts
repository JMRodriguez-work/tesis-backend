import type { DB } from '../../../shared/db'
import {
  countItemsByBranch,
  findItemsByBranch,
  type ItemWithRelations,
  type ListItemsFilters,
} from '../infra/repository/item.repository'
import {
  resolveItemBranchForRead,
  type ResolveItemBranchInput,
} from './resolve-item-branch'

export type GetItemsPaginatedInput = ResolveItemBranchInput & {
  filters: ListItemsFilters
  page: number
  limit: number
}

export type GetItemsPaginatedOutput = {
  data: ItemWithRelations[]
  meta: { page: number; limit: number; total: number; totalPages: number }
}

export class GetItemsPaginated {
  constructor(private readonly db: DB) {}

  async execute(input: GetItemsPaginatedInput): Promise<GetItemsPaginatedOutput> {
    const { branchId } = await resolveItemBranchForRead(this.db, input)
    const offset = (input.page - 1) * input.limit

    const [data, total] = await Promise.all([
      findItemsByBranch(this.db, branchId, input.filters, input.limit, offset),
      countItemsByBranch(this.db, branchId, input.filters),
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
