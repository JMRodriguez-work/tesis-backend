import { and, eq } from 'drizzle-orm'
import { ApiError } from '../../../shared/http/api-response'
import type { DB } from '../../../shared/db'
import * as schema from '../../../shared/db/schema'
import { findWarehouseBranchAssignment, upsertItemWarehouseStock } from '../infra/repository/warehouse.repository'
import { ADMIN_ROLE_ID, type ScopeInput } from './resolve-warehouse-access'

export type UpsertStockInput = ScopeInput & {
  warehouseId: string
  itemId: string
  quantity: string
  minStock?: string
}

export class UpsertStock {
  constructor(private readonly db: DB) {}

  async execute(input: UpsertStockInput) {
    if (!input.userOrganizationId) throw new ApiError('No autorizado', 403)

    const item = await this.db
      .select()
      .from(schema.items)
      .where(eq(schema.items.id, input.itemId))
      .limit(1)
      .then((r) => r[0] ?? null)

    if (!item || item.deletedAt !== null) {
      throw new ApiError('Item no encontrado', 400)
    }

    const wh = await this.db
      .select()
      .from(schema.warehouses)
      .where(eq(schema.warehouses.id, input.warehouseId))
      .limit(1)
      .then((r) => r[0] ?? null)

    if (!wh || wh.deletedAt !== null || wh.organizationId !== input.userOrganizationId) {
      throw new ApiError('Depósito no encontrado', 400)
    }

    const isAdmin = input.userRoleId === ADMIN_ROLE_ID
    if (!isAdmin) {
      if (input.userBranchId === null) throw new ApiError('No autorizado', 403)
      if (item.branchId !== input.userBranchId) {
        throw new ApiError('El item no pertenece a tu sucursal', 400)
      }
      const assigned = await findWarehouseBranchAssignment(this.db, input.warehouseId, input.userBranchId)
      if (!assigned) {
        throw new ApiError('El depósito no está asignado a tu sucursal', 400)
      }
    }

    const result = await upsertItemWarehouseStock(this.db, input.itemId, input.warehouseId, {
      quantity: input.quantity,
      ...(input.minStock !== undefined ? { minStock: input.minStock } : {}),
    })

    if (!result) throw new ApiError('No se pudo guardar el stock', 500)
    return result
  }
}
