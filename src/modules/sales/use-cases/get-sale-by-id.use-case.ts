import { eq } from 'drizzle-orm'
import { ApiError } from '../../../shared/http/api-response'
import type { DB } from '../../../shared/db'
import * as schema from '../../../shared/db/schema'
import { findSaleById, findSaleByIdRaw } from '../infra/repository/sale.repository'

export type GetSaleByIdInput = {
  saleId: string
  userOrganizationId: string | null
  userBranchId: string | null
  userRoleId: number | null
  isAdmin: boolean
}

export class GetSaleById {
  constructor(private readonly db: DB) {}

  async execute(input: GetSaleByIdInput) {
    if (!input.userOrganizationId) throw new ApiError('No autorizado', 403)

    const sale = await findSaleByIdRaw(this.db, input.saleId)
    if (!sale) throw new ApiError('Venta no encontrada', 404)

    const branch = await this.db
      .select({ organizationId: schema.branches.organizationId })
      .from(schema.branches)
      .where(eq(schema.branches.id, sale.branchId))
      .limit(1)

    if (!branch[0] || branch[0].organizationId !== input.userOrganizationId) {
      throw new ApiError('Venta no encontrada', 404)
    }

    if (!input.isAdmin) {
      if (input.userBranchId === null || sale.branchId !== input.userBranchId) {
        throw new ApiError('Venta no encontrada', 404)
      }
    }

    const enriched = await findSaleById(this.db, input.saleId)
    if (!enriched) throw new ApiError('Venta no encontrada', 404)
    return enriched
  }
}
