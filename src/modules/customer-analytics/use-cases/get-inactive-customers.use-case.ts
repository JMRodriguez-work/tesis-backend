import { ApiError } from '../../../shared/http/api-response'
import type { DB } from '../../../shared/db'
import {
  countInactiveCustomersWithRecommendations,
  getInactiveCustomersWithRecommendations,
} from '../infra/repository/customer-analytics.repository'
import {
  findBranchOrg,
  resolveCustomerAnalyticsScope,
  type ResolveCustomerAnalyticsScopeInput,
} from './resolve-customer-analytics-scope'

const DAY_MS = 24 * 60 * 60 * 1000

export type GetInactiveCustomersInput = ResolveCustomerAnalyticsScopeInput & {
  limit: number
}

export class GetInactiveCustomers {
  constructor(private readonly db: DB) {}

  async execute(input: GetInactiveCustomersInput) {
    const scope = resolveCustomerAnalyticsScope(input)
    if (!scope.organizationId) throw new ApiError('No autorizado', 403)

    if (input.requestedBranchId && !scope.isAdmin) {
      throw new ApiError('No autorizado', 403)
    }

    if (scope.branchId) {
      const ok = await findBranchOrg(this.db, scope.branchId, scope.organizationId)
      if (!ok) {
        throw new ApiError('La sucursal no pertenece a tu organización', 400)
      }
    }

    const [rows, total] = await Promise.all([
      getInactiveCustomersWithRecommendations(
        this.db,
        scope.organizationId,
        scope.branchId,
        input.limit,
      ),
      countInactiveCustomersWithRecommendations(
        this.db,
        scope.organizationId,
        scope.branchId,
      ),
    ])

    const now = Date.now()
    const enriched = rows.map((r) => ({
      ...r,
      daysSinceLastPurchase: r.lastPurchaseAt
        ? Math.floor((now - r.lastPurchaseAt.getTime()) / DAY_MS)
        : null,
    }))

    return {
      data: enriched,
      meta: { total, limit: input.limit },
    }
  }
}
