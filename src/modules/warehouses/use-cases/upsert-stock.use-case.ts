import { and, eq } from 'drizzle-orm'
import { ApiError } from '../../../shared/http/api-response'
import type { DB } from '../../../shared/db'
import * as schema from '../../../shared/db/schema'
import { findWarehouseBranchAssignment, upsertItemWarehouseStock } from '../infra/repository/warehouse.repository'
import { ADMIN_ROLE_ID, type ScopeInput } from './resolve-warehouse-access'
import { createStockMovement } from '../../stock-movements/infra/repository/stock-movement.repository'
import { onSaleCreated } from '../../recommendations/triggers/on-sale-created'
import { onStockIncreased } from '../../recommendations/triggers/on-stock-increased'
import { findItemBaseUnit } from '../../items/infra/repository/item.repository'

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

    const unitInfo = item.baseUnitId
      ? await findItemBaseUnit(this.db, input.itemId)
      : null
    const validUnitType: 'count' | 'weight' | 'volume' | null =
      unitInfo?.unitType === 'count' ||
      unitInfo?.unitType === 'weight' ||
      unitInfo?.unitType === 'volume'
        ? unitInfo.unitType
        : null
    const unitPayload = {
      unitType: validUnitType,
      unitName: unitInfo?.unitName ?? null,
      unitAbbreviation: unitInfo?.unitAbbreviation ?? null,
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

    const previousStock = await this.db
      .select({
        id: schema.warehouseItemStocks.id,
        quantity: schema.warehouseItemStocks.quantity,
        minStock: schema.warehouseItemStocks.minStock,
      })
      .from(schema.warehouseItemStocks)
      .where(
        and(
          eq(schema.warehouseItemStocks.itemId, input.itemId),
          eq(schema.warehouseItemStocks.warehouseId, input.warehouseId),
        ),
      )
      .limit(1)
      .then((r) => r[0] ?? null)

    const previousQuantity = previousStock ? Number(previousStock.quantity) : 0
    const newQuantity = Number(input.quantity)
    const delta = newQuantity - previousQuantity

    const result = await this.db.transaction(async (tx) => {
      const upserted = await upsertItemWarehouseStock(
        tx as unknown as DB,
        input.itemId,
        input.warehouseId,
        {
          quantity: input.quantity,
          ...(input.minStock !== undefined ? { minStock: input.minStock } : {}),
        },
      )

      if (!upserted) {
        throw new ApiError('No se pudo guardar el stock', 500)
      }

      if (delta !== 0) {
        const isIncrement = delta > 0
        const signedQty = delta.toString()
        const [created] = await tx
          .insert(schema.stockMovements)
          .values({
            branchId: item.branchId,
            itemId: input.itemId,
            fromWarehouseId: isIncrement ? null : input.warehouseId,
            toWarehouseId: isIncrement ? input.warehouseId : null,
            createdBy: input.userId ?? '',
            type: 'adjustment',
            quantity: signedQty,
            referenceId: null,
            referenceType: 'manual',
            notes: previousStock
              ? 'Ajuste manual vía upsert-stock'
              : 'Stock inicial vía upsert-stock',
          })
          .returning()

        if (!created) {
          throw new ApiError('No se pudo crear el movimiento de auditoría', 500)
        }

        const effectiveMinStock =
          input.minStock !== undefined ? input.minStock : (upserted.minStock ?? '0')

        if (isIncrement) {
          await onStockIncreased(tx as unknown as DB, {
            branchId: item.branchId,
            itemId: input.itemId,
            newQuantity: input.quantity,
            minStock: effectiveMinStock,
          })
        } else {
          await onSaleCreated(tx as unknown as DB, {
            branchId: item.branchId,
            itemId: input.itemId,
            itemName: item.name,
            newQuantity: input.quantity,
            minStock: effectiveMinStock,
            ...unitPayload,
          })
        }
      }

      return upserted
    })

    return result
  }
}
