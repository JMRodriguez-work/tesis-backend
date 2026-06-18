import type { DB } from '../../../shared/db'
import {
  countItemCategoriesByBranch,
  findItemCategoriesByBranch,
  type ItemCategoryWithRelations,
  type ListItemCategoriesFilters,
} from '../infra/repository/item-category.repository'
import { resolveBranchForRead, type ResolveBranchInput } from './resolve-branch'

export type GetItemCategoriesPaginatedInput = ResolveBranchInput & {
  filters: ListItemCategoriesFilters
  page: number
  limit: number
}

export type GetItemCategoriesPaginatedOutput = {
  data: ItemCategoryWithRelations[]
  meta: { page: number; limit: number; total: number; totalPages: number }
}

export class GetItemCategoriesPaginated {
  constructor(private readonly db: DB) {}

  async execute(
    input: GetItemCategoriesPaginatedInput,
  ): Promise<GetItemCategoriesPaginatedOutput> {
    const { branchId } = await resolveBranchForRead(this.db, input)
    const offset = (input.page - 1) * input.limit

    const [data, total] = await Promise.all([
      findItemCategoriesByBranch(this.db, branchId, input.filters, input.limit, offset),
      countItemCategoriesByBranch(this.db, branchId, input.filters),
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
