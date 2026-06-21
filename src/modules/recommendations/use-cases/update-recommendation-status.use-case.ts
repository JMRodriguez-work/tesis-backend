import { eq } from 'drizzle-orm'
import { ApiError } from '../../../shared/http/api-response'
import type { DB } from '../../../shared/db'
import * as schema from '../../../shared/db/schema'
import {
  findRecommendationById,
  findRecommendationByIdRaw,
  updateRecommendationStatus,
} from '../infra/repository/recommendation.repository'
import type { RecommendationStatus } from '../domain/recommendation.entity'

const VALID_TRANSITIONS: Record<RecommendationStatus, RecommendationStatus[]> = {
  pending: ['applied', 'dismissed'],
  applied: ['pending'],
  dismissed: ['pending'],
}

export type UpdateRecommendationStatusInput = {
  recommendationId: string
  newStatus: RecommendationStatus
  userOrganizationId: string | null
  userBranchId: string | null
  userRoleId: number | null
  isAdmin: boolean
}

export class UpdateRecommendationStatus {
  constructor(private readonly db: DB) {}

  async execute(input: UpdateRecommendationStatusInput) {
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

    const current = rec.status as RecommendationStatus
    if (current === input.newStatus) {
      const enriched = await findRecommendationById(this.db, input.recommendationId)
      if (!enriched) throw new ApiError('Recomendación no encontrada', 404)
      return enriched
    }

    const allowed = VALID_TRANSITIONS[current]
    if (!allowed.includes(input.newStatus)) {
      throw new ApiError(
        `No se puede cambiar de "${current}" a "${input.newStatus}"`,
        400,
      )
    }

    const updated = await updateRecommendationStatus(
      this.db,
      input.recommendationId,
      input.newStatus,
    )
    if (!updated) throw new ApiError('No se pudo actualizar la recomendación', 500)

    const enriched = await findRecommendationById(this.db, input.recommendationId)
    if (!enriched) throw new ApiError('Recomendación no encontrada', 404)
    return enriched
  }
}
