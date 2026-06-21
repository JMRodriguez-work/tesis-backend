import type { DB } from '../../../shared/db'
import {
  countProvidersByOrganization,
  findProvidersByOrganization,
  type ListProvidersFilters,
} from '../infra/repository/provider.repository'

export type GetProvidersPaginatedInput = {
  organizationId: string
  filters: ListProvidersFilters
  page: number
  limit: number
}

export class GetProvidersPaginated {
  constructor(private readonly db: DB) {}

  async execute(input: GetProvidersPaginatedInput) {
    const offset = (input.page - 1) * input.limit

    const [data, total] = await Promise.all([
      findProvidersByOrganization(
        this.db,
        input.organizationId,
        input.filters,
        input.limit,
        offset,
      ),
      countProvidersByOrganization(this.db, input.organizationId, input.filters),
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
