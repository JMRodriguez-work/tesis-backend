import type { DB } from '../../../shared/db'
import {
  countCustomersByBranch,
  countCustomersByOrganization,
  findCustomersByBranch,
  findCustomersByOrganization,
  type CustomerWithRelations,
  type ListCustomersFilters,
} from '../infra/repository/customer.repository'
import {
  resolveCustomerListScope,
  type ResolveCustomerListInput,
} from './resolve-customer-branch'

export type GetCustomersPaginatedInput = ResolveCustomerListInput & {
  filters: ListCustomersFilters
  page: number
  limit: number
}

export type GetCustomersPaginatedOutput = {
  data: CustomerWithRelations[]
  meta: { page: number; limit: number; total: number; totalPages: number }
}

export class GetCustomersPaginated {
  constructor(private readonly db: DB) {}

  async execute(input: GetCustomersPaginatedInput): Promise<GetCustomersPaginatedOutput> {
    const { organizationId, branchId, isAdmin } = resolveCustomerListScope(input)
    const offset = (input.page - 1) * input.limit

    if (isAdmin) {
      const [data, total] = await Promise.all([
        findCustomersByOrganization(
          this.db,
          organizationId,
          branchId,
          input.filters,
          input.limit,
          offset,
        ),
        countCustomersByOrganization(
          this.db,
          organizationId,
          branchId,
          input.filters,
        ),
      ])
      return {
        data,
        meta: { page: input.page, limit: input.limit, total, totalPages: total === 0 ? 0 : Math.ceil(total / input.limit) },
      }
    }

    const [data, total] = await Promise.all([
      findCustomersByBranch(this.db, branchId!, input.filters, input.limit, offset),
      countCustomersByBranch(this.db, branchId!, input.filters),
    ])
    return {
      data,
      meta: { page: input.page, limit: input.limit, total, totalPages: total === 0 ? 0 : Math.ceil(total / input.limit) },
    }
  }
}
