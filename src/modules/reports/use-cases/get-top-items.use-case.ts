import { ApiError } from '../../../shared/http/api-response'
import type { DB } from '../../../shared/db'
import {
  findBranchOrg,
  getTopItems,
  type ReportPeriodFilters,
} from '../infra/repository/reports.repository'
import { resolveReportScope, type ResolveReportScopeInput } from './resolve-report-scope'
import type { TopItemRow, TopItemSortBy } from '../domain/report.entity'

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

export type GetTopItemsInput = ResolveReportScopeInput & {
  from?: Date
  to?: Date
  sortBy: TopItemSortBy
  limit: number
}

export class GetTopItems {
  constructor(private readonly db: DB) {}

  async execute(input: GetTopItemsInput) {
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

    const filters: ReportPeriodFilters = {
      organizationId: scope.organizationId,
      branchId,
      from,
      to,
    }
    const data: TopItemRow[] = await getTopItems(this.db, filters, input.sortBy, input.limit)

    return {
      data,
      meta: {
        from: from.toISOString(),
        to: to.toISOString(),
        sortBy: input.sortBy,
        limit: input.limit,
      },
    }
  }
}
