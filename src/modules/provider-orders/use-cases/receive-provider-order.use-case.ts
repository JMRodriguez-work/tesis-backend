import { and, eq } from 'drizzle-orm'
import { ApiError } from '../../../shared/http/api-response'
import type { DB } from '../../../shared/db'
import * as schema from '../../../shared/db/schema'
import {
  findProviderOrderById,
  findProviderOrderByIdRaw,
  findWarehouseBranchAssignment,
  findWarehouseByIdRaw,
} from '../infra/repository/provider-order.repository'
import { upsertIncrementStock } from '../../sales/infra/repository/sale.repository'
import { onStockIncreased } from '../../recommendations/triggers/on-stock-increased'

export type ReceiveProviderOrderInput = {
  orderId: string
  warehouseId: string
  userId: string
  userOrganizationId: string | null
  userBranchId: string | null
  userRoleId: number | null
  isAdmin: boolean
}

export class ReceiveProviderOrder {
  constructor(private readonly db: DB) {}

  async execute(input: ReceiveProviderOrderInput) {
    if (!input.userOrganizationId) throw new ApiError('No autorizado', 403)

    const order = await findProviderOrderByIdRaw(this.db, input.orderId)
    if (!order) throw new ApiError('Orden no encontrada', 404)

    // Tenant isolation
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

    if (order.status === 'received') {
      throw new ApiError('La orden ya fue recibida', 400)
    }
    if (order.status === 'cancelled') {
      throw new ApiError('La orden está cancelada', 400)
    }

    // Validate warehouse
    const warehouse = await findWarehouseByIdRaw(this.db, input.warehouseId)
    if (!warehouse || warehouse.deletedAt !== null || warehouse.organizationId !== input.userOrganizationId) {
      throw new ApiError('El depósito no existe o no pertenece a tu organización', 400)
    }
    const assigned = await findWarehouseBranchAssignment(
      this.db,
      input.warehouseId,
      order.branchId,
    )
    if (!assigned) {
      throw new ApiError('El depósito no está asignado a la sucursal de la orden', 400)
    }

    // Fetch items to receive
    const items = await this.db
      .select()
      .from(schema.providerOrderItems)
      .where(eq(schema.providerOrderItems.orderId, input.orderId))

    if (items.length === 0) {
      throw new ApiError('La orden no tiene items para recibir', 500)
    }

    // Transaction: mark received + increment stock + create movements
    await this.db.transaction(async (tx) => {
      const updated = await tx
        .update(schema.providerOrders)
        .set({ status: 'received' })
        .where(eq(schema.providerOrders.id, input.orderId))
        .returning()
      if (!updated[0]) throw new ApiError('No se pudo marcar la orden como recibida', 500)

      for (const it of items) {
        const upserted = await upsertIncrementStock(
          tx as unknown as DB,
          it.itemId,
          input.warehouseId,
          it.quantity,
        )
        await tx.insert(schema.stockMovements).values({
          branchId: order.branchId,
          itemId: it.itemId,
          fromWarehouseId: null,
          toWarehouseId: input.warehouseId,
          createdBy: input.userId,
          type: 'in',
          quantity: it.quantity,
          referenceId: order.id,
          referenceType: 'provider_order',
        })
        // HU-017: if receiving restored stock above minStock, close recommendations
        const stockRow = await tx
          .select({ minStock: schema.warehouseItemStocks.minStock })
          .from(schema.warehouseItemStocks)
          .where(
            and(
              eq(schema.warehouseItemStocks.itemId, it.itemId),
              eq(schema.warehouseItemStocks.warehouseId, input.warehouseId),
            ),
          )
          .limit(1)
        const minStock = stockRow[0]?.minStock ?? '0'
        await onStockIncreased(tx as unknown as DB, {
          branchId: order.branchId,
          itemId: it.itemId,
          newQuantity: upserted.quantity,
          minStock,
        })
      }
    })

    const enriched = await findProviderOrderById(this.db, input.orderId)
    if (!enriched) throw new ApiError('Orden no encontrada', 404)
    return enriched
  }
}
