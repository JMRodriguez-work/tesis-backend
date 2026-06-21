import { ApiError } from '../../../shared/http/api-response'
import type { DB } from '../../../shared/db'
import { assertCustomerAccess } from '../../customers/use-cases/resolve-customer-branch'
import {
  countSalesByCustomer,
  findSalesByCustomer,
  getCustomerPurchaseSummary,
} from '../infra/repository/sale.repository'

export type GetCustomerPurchaseHistoryInput = {
  customerId: string
  userRoleId: number | null
  userBranchId: string | null
  userOrganizationId: string | null
  page: number
  limit: number
  includeCancelled: boolean
}

export class GetCustomerPurchaseHistory {
  constructor(private readonly db: DB) {}

  async execute(input: GetCustomerPurchaseHistoryInput) {
    if (!input.userOrganizationId) throw new ApiError('No autorizado', 403)

    const customer = await assertCustomerAccess(this.db, input.customerId, {
      requestedBranchId: null,
      userRoleId: input.userRoleId,
      userBranchId: input.userBranchId,
      userOrganizationId: input.userOrganizationId,
    })
    if (!customer) throw new ApiError('Cliente no encontrado', 404)

    const offset = (input.page - 1) * input.limit
    const [data, total, summary] = await Promise.all([
      findSalesByCustomer(
        this.db,
        input.customerId,
        input.includeCancelled,
        input.limit,
        offset,
      ),
      countSalesByCustomer(this.db, input.customerId, input.includeCancelled),
      getCustomerPurchaseSummary(this.db, input.customerId),
    ])

    return {
      data,
      summary,
      meta: {
        page: input.page,
        limit: input.limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / input.limit),
      },
    }
  }
}
