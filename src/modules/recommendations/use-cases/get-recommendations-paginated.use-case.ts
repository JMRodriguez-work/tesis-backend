import { eq } from 'drizzle-orm'
import { ApiError } from '../../../shared/http/api-response'
import type { DB } from '../../../shared/db'
import * as schema from '../../../shared/db/schema'
import {
  countRecommendations,
  findRecommendationsPaginated,
  type ListRecommendationsFilters,
} from '../infra/repository/recommendation.repository'
import {
  resolveRecommendationListScope,
  type ResolveRecommendationListInput,
} from './resolve-recommendation-access'

export type GetRecommendationsPaginatedInput = ResolveRecommendationListInput & {
  filters: Omit<ListRecommendationsFilters, 'branchId' | 'organizationId'>
  page: number
  limit: number
}

export class GetRecommendationsPaginated {
  constructor(private readonly db: DB) {}

  async execute(input: GetRecommendationsPaginatedInput) {
    const scope = resolveRecommendationListScope(input)
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

    const filters: ListRecommendationsFilters = {
      branchId,
      type: input.filters.type,
      status: input.filters.status,
      itemId: input.filters.itemId,
    }

    const offset = (input.page - 1) * input.limit
    const [data, total] = await Promise.all([
      findRecommendationsPaginated(this.db, scope.organizationId, filters, input.limit, offset),
      countRecommendations(this.db, scope.organizationId, filters),
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
