import { eq } from 'drizzle-orm'
import { ApiError } from '../../../shared/http/api-response'
import type { DB } from '../../../shared/db'
import * as schema from '../../../shared/db/schema'
import { findRecommendationById, findRecommendationByIdRaw } from '../infra/repository/recommendation.repository'

export type GetRecommendationByIdInput = {
  recommendationId: string
  userOrganizationId: string | null
  userBranchId: string | null
  userRoleId: number | null
  isAdmin: boolean
}

export class GetRecommendationById {
  constructor(private readonly db: DB) {}

  async execute(input: GetRecommendationByIdInput) {
    if (!input.userOrganizationId) throw new ApiError('No autorizado', 403)

    const rec = await findRecommendationByIdRaw(this.db, input.recommendationId)
    if (!rec) throw new ApiError('Recomendación no encontrada', 404)

    const branch = await this.db
      .select({ organizationId: schema.branches.organizationId })
      .from(schema.branches)
      .where(eq(schema.branches.id, rec.branchId))
      .limit(1)
    if (!branch[0] || branch[0].organizationId !== input.userOrganizationId) {
      throw new ApiError('Recomendación no encontrada', 404)
    }
    if (!input.isAdmin) {
      if (input.userBranchId === null || rec.branchId !== input.userBranchId) {
        throw new ApiError('Recomendación no encontrada', 404)
      }
    }

    const enriched = await findRecommendationById(this.db, input.recommendationId)
    if (!enriched) throw new ApiError('Recomendación no encontrada', 404)
    return enriched
  }
}
