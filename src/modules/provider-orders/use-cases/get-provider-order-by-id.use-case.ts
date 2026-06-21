import { eq } from 'drizzle-orm'
import { ApiError } from '../../../shared/http/api-response'
import type { DB } from '../../../shared/db'
import * as schema from '../../../shared/db/schema'
import { findProviderOrderById, findProviderOrderByIdRaw } from '../infra/repository/provider-order.repository'

export type GetProviderOrderByIdInput = {
  orderId: string
  userOrganizationId: string | null
  userBranchId: string | null
  userRoleId: number | null
  isAdmin: boolean
}

export class GetProviderOrderById {
  constructor(private readonly db: DB) {}

  async execute(input: GetProviderOrderByIdInput) {
    if (!input.userOrganizationId) throw new ApiError('No autorizado', 403)

    const order = await findProviderOrderByIdRaw(this.db, input.orderId)
    if (!order) throw new ApiError('Orden no encontrada', 404)

    const branch = await this.db
      .select({ organizationId: schema.branches.organizationId })
      .from(schema.branches)
      .where(eq(schema.branches.id, order.branchId))
      .limit(1)

    if (!branch[0] || branch[0].organizationId !== input.userOrganizationId) {
      throw new ApiError('Orden no encontrada', 404)
    }

    if (!input.isAdmin) {
      if (input.userBranchId === null || order.branchId !== input.userBranchId) {
        throw new ApiError('Orden no encontrada', 404)
      }
    }

    const enriched = await findProviderOrderById(this.db, input.orderId)
    if (!enriched) throw new ApiError('Orden no encontrada', 404)
    return enriched
  }
}
