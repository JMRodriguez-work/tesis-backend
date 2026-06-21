import { eq } from 'drizzle-orm'
import { ApiError } from '../../../shared/http/api-response'
import type { DB } from '../../../shared/db'
import * as schema from '../../../shared/db/schema'
import { updateMinStockForItem } from '../infra/repository/warehouse.repository'
import { ADMIN_ROLE_ID, type ScopeInput } from './resolve-warehouse-access'

export class UpdateMinStock {
  constructor(private readonly db: DB) {}

  async execute(itemId: string, minStock: string, input: ScopeInput) {
    if (!input.userOrganizationId) throw new ApiError('No autorizado', 403)

    const item = await this.db
      .select()
      .from(schema.items)
      .where(eq(schema.items.id, itemId))
      .limit(1)
      .then((r) => r[0] ?? null)

    if (!item || item.deletedAt !== null) {
      throw new ApiError('Item no encontrado', 404)
    }

    const isAdmin = input.userRoleId === ADMIN_ROLE_ID
    if (isAdmin) {
      const branch = await this.db
        .select({ organizationId: schema.branches.organizationId })
        .from(schema.branches)
        .where(eq(schema.branches.id, item.branchId))
        .limit(1)
      if (!branch[0] || branch[0].organizationId !== input.userOrganizationId) {
        throw new ApiError('Item no encontrado', 404)
      }
    } else {
      if (input.userBranchId === null || item.branchId !== input.userBranchId) {
        throw new ApiError('Item no encontrado', 404)
      }
    }

    await updateMinStockForItem(this.db, itemId, minStock)
    return { itemId, minStock }
  }
}
