import { ApiError } from '../../../shared/http/api-response'
import type { DB } from '../../../shared/db'
import {
  countCustomersWithStats,
  getCustomersWithStats,
} from '../infra/repository/customer-analytics.repository'
import {
  findBranchOrg,
  resolveCustomerAnalyticsScope,
  type ResolveCustomerAnalyticsScopeInput,
} from './resolve-customer-analytics-scope'
import { computeSegment } from '../triggers/customer-segments'
import type { CustomerSegment, SegmentRow } from '../domain/customer-analytics.entity'

export type GetCustomerSegmentsInput = ResolveCustomerAnalyticsScopeInput & {
  segment?: CustomerSegment
  page: number
  limit: number
}

export class GetCustomerSegments {
  constructor(private readonly db: DB) {}

  async execute(input: GetCustomerSegmentsInput) {
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

    const offset = (input.page - 1) * input.limit
    const [rawRows, total] = await Promise.all([
      getCustomersWithStats(
        this.db,
        scope.organizationId,
        scope.branchId,
        input.limit,
        offset,
      ),
      countCustomersWithStats(this.db, scope.organizationId, scope.branchId),
    ])

    const now = new Date()
    const enriched: SegmentRow[] = rawRows
      .map((r) => {
        const segment = computeSegment({
          purchaseCount: r.purchaseCount,
          totalSpent: r.totalSpent,
          lastPurchaseAt: r.lastPurchaseAt,
          now,
        })
        return {
          customerId: r.customerId,
          customerFullname: r.fullname,
          email: r.email,
          phone: r.phone,
          branchId: r.branchId,
          branchName: r.branchName,
          segment,
          totalSpent: r.totalSpent,
          purchaseCount: r.purchaseCount,
          lastPurchaseAt: r.lastPurchaseAt,
        }
      })
      .filter((r) => (input.segment ? r.segment === input.segment : true))

    return {
      data: enriched,
      meta: {
        page: input.page,
        limit: input.limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / input.limit),
      },
    }
  }
}
