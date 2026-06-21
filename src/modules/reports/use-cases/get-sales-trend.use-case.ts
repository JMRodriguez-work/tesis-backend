import { ApiError } from '../../../shared/http/api-response'
import type { DB } from '../../../shared/db'
import {
  findBranchOrg,
  getSalesTrend,
  type ReportPeriodFilters,
} from '../infra/repository/reports.repository'
import { resolveReportScope, type ResolveReportScopeInput } from './resolve-report-scope'
import { validateBucketRange } from './validate-bucket-range'
import type { SalesTrendBucket, TrendInterval } from '../domain/report.entity'

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

export type GetSalesTrendInput = ResolveReportScopeInput & {
  from?: Date
  to?: Date
  interval: TrendInterval
}

export class GetSalesTrend {
  constructor(private readonly db: DB) {}

  async execute(input: GetSalesTrendInput) {
    const scope = resolveReportScope(input)
    if (!scope.organizationId) throw new ApiError('No autorizado', 403)

    let branchId = scope.branchId
    if (branchId) {
      const ok = await findBranchOrg(this.db, branchId, scope.organizationId)
      if (!ok) {
        throw new ApiError('La sucursal no pertenece a tu organización', 400)
      }
    }

    const now = new Date()
    const to = input.to ?? now
    const from = input.from ?? new Date(to.getTime() - THIRTY_DAYS_MS)
    validateBucketRange(from, to, input.interval)

    const filters: ReportPeriodFilters = {
      organizationId: scope.organizationId,
      branchId,
      from,
      to,
    }
    const data: SalesTrendBucket[] = await getSalesTrend(this.db, filters, input.interval)

    return {
      data,
      interval: input.interval,
      from: from.toISOString(),
      to: to.toISOString(),
      meta: { total: data.length },
    }
  }
}
