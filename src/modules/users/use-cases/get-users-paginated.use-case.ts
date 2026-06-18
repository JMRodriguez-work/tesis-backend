import type { DB } from '../../../shared/db'
import {
  countUsersByOrganization,
  findUsersByOrganization,
  type ListUsersFilters,
  type UserWithRelations,
} from '../infra/repository/user.repository'

export type GetUsersPaginatedInput = {
  organizationId: string
  page: number
  limit: number
  filters: ListUsersFilters
}

export type GetUsersPaginatedOutput = {
  data: UserWithRelations[]
  meta: { page: number; limit: number; total: number; totalPages: number }
}

export class GetUsersPaginated {
  constructor(private readonly db: DB) {}

  async execute({
    organizationId,
    page,
    limit,
    filters,
  }: GetUsersPaginatedInput): Promise<GetUsersPaginatedOutput> {
    const offset = (page - 1) * limit
    const [data, total] = await Promise.all([
      findUsersByOrganization(this.db, organizationId, filters, limit, offset),
      countUsersByOrganization(this.db, organizationId, filters),
    ])

    return {
      data,
      meta: { page, limit, total, totalPages: total === 0 ? 0 : Math.ceil(total / limit) },
    }
  }
}
