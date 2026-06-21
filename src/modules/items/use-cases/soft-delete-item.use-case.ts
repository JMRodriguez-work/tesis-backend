import { eq } from 'drizzle-orm'
import { ApiError } from '../../../shared/http/api-response'
import type { DB } from '../../../shared/db'
import * as schema from '../../../shared/db/schema'
import {
  countActiveSalesByItem,
  findItemByIdRaw,
  softDeleteItem,
  sumStockByItem,
} from '../infra/repository/item.repository'
import { ADMIN_ROLE_ID, type ResolveItemBranchInput } from './resolve-item-branch'

export type SoftDeleteItemInput = ResolveItemBranchInput & {
  id: string
}

export class SoftDeleteItem {
  constructor(private readonly db: DB) {}

  async execute(input: SoftDeleteItemInput): Promise<void> {
    const existing = await findItemByIdRaw(this.db, input.id)
    if (!existing || existing.deletedAt !== null) return

    if (!input.userOrganizationId) {
      throw new ApiError('No autorizado', 403)
    }

    const isAdmin = input.userRoleId === ADMIN_ROLE_ID

    if (isAdmin) {
      const branch = await this.db
        .select({ organizationId: schema.branches.organizationId })
        .from(schema.branches)
        .where(eq(schema.branches.id, existing.branchId))
        .limit(1)

      if (!branch[0] || branch[0].organizationId !== input.userOrganizationId) {
        throw new ApiError('Item no encontrado', 404)
      }
    } else {
      if (input.userBranchId === null || existing.branchId !== input.userBranchId) {
        throw new ApiError('Item no encontrado', 404)
      }
    }

    const activeSales = await countActiveSalesByItem(this.db, input.id)
    if (activeSales > 0) {
      throw new ApiError(
        `No se puede eliminar el item porque tiene ${activeSales} venta(s) activa(s) asociada(s). Desactivá o cancelá las ventas primero`,
        400,
      )
    }

    const totalStock = await sumStockByItem(this.db, input.id)
    if (Number(totalStock) > 0) {
      throw new ApiError(
        `No se puede eliminar el item porque tiene stock total ${totalStock} en los depósitos. Ajustá el stock a 0 o transferí la mercadería antes`,
        400,
      )
    }

    await softDeleteItem(this.db, input.id)
  }
}
