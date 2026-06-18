import { eq } from 'drizzle-orm'
import type { DB } from '../../../shared/db'
import {
  countBranchesByOrganization,
  findBranchesByOrganization,
  type ListBranchesFilters,
  type BranchWithRelations,
} from '../infra/repository/branch.repository'

export type GetBranchesPaginatedInput = {
  organizationId: string
  page: number
  limit: number
  filters: ListBranchesFilters
}

export type GetBranchesPaginatedOutput = {
  data: BranchWithRelations[]
  meta: { page: number; limit: number; total: number; totalPages: number }
}

export class GetBranchesPaginated {
  constructor(private readonly db: DB) {}

  async execute({
    organizationId,
    page,
    limit,
    filters,
  }: GetBranchesPaginatedInput): Promise<GetBranchesPaginatedOutput> {
    const offset = (page - 1) * limit
    const [data, total] = await Promise.all([
      findBranchesByOrganization(this.db, organizationId, filters, limit, offset),
      countBranchesByOrganization(this.db, organizationId, filters),
    ])

    return {
      data,
      meta: { page, limit, total, totalPages: total === 0 ? 0 : Math.ceil(total / limit) },
    }
  }
}
