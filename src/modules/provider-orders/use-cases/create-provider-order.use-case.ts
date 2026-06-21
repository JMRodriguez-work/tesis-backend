import { ApiError } from '../../../shared/http/api-response'
import type { DB } from '../../../shared/db'
import * as schema from '../../../shared/db/schema'
import {
  findBranchByIdRaw,
  findItemByIdRaw,
  findProviderByIdRaw,
  findProviderOrderById,
} from '../infra/repository/provider-order.repository'
import { resolveProviderOrderBranchForWrite, type ResolveProviderOrderBranchInput } from './resolve-provider-order-branch'

export type CreateProviderOrderItemInput = {
  itemId: string
  quantity: string
  cost: string
  unitId?: number
}

export type CreateProviderOrderInput = ResolveProviderOrderBranchInput & {
  userId: string
  providerId: string
  estimatedDelivery?: Date
  items: CreateProviderOrderItemInput[]
}

function round2(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2)
}

export class CreateProviderOrder {
  constructor(private readonly db: DB) {}

  async execute(input: CreateProviderOrderInput) {
    if (!input.userOrganizationId) throw new ApiError('No autorizado', 403)
    if (input.items.length === 0) {
      throw new ApiError('La orden debe tener al menos un item', 400)
    }

    const { branchId } = resolveProviderOrderBranchForWrite(input)

    // Validate branch belongs to org
    const branch = await findBranchByIdRaw(this.db, branchId)
    if (!branch || branch.organizationId !== input.userOrganizationId) {
      throw new ApiError('La sucursal no pertenece a tu organización', 400)
    }

    // Validate provider exists, is active, belongs to org
    const provider = await findProviderByIdRaw(this.db, input.providerId)
    if (!provider) {
      throw new ApiError('El proveedor no existe', 400)
    }
    if (provider.organizationId !== input.userOrganizationId) {
      throw new ApiError('El proveedor no pertenece a tu organización', 400)
    }
    if (!provider.isActive) {
      throw new ApiError('El proveedor está inactivo', 400)
    }

    // Validate each item belongs to the branch
    for (const raw of input.items) {
      if (Number(raw.quantity) <= 0) {
        throw new ApiError('La cantidad debe ser mayor a 0', 400)
      }
      if (Number(raw.cost) < 0) {
        throw new ApiError('El costo no puede ser negativo', 400)
      }
      const item = await findItemByIdRaw(this.db, raw.itemId)
      if (!item || item.deletedAt !== null || !item.isActive) {
        throw new ApiError(`El item ${raw.itemId} no existe o está inactivo`, 400)
      }
      if (item.branchId !== branchId) {
        throw new ApiError(
          `El item "${item.name}" no pertenece a la sucursal de la orden`,
          400,
        )
      }
    }

    // Calculate total
    const total = input.items.reduce(
      (acc, it) => acc + Number(it.cost) * Number(it.quantity),
      0,
    )
    const totalStr = round2(total)

    const order = await this.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(schema.providerOrders)
        .values({
          branchId,
          providerId: input.providerId,
          createdBy: input.userId,
          total: totalStr,
          status: 'pending',
          estimatedDelivery: input.estimatedDelivery ?? null,
        })
        .returning()

      if (!created) throw new ApiError('No se pudo crear la orden', 500)

      const itemsToInsert = input.items.map((it) => ({
        orderId: created.id,
        itemId: it.itemId,
        unitId: it.unitId ?? null,
        quantity: it.quantity,
        cost: it.cost,
      }))
      await tx.insert(schema.providerOrderItems).values(itemsToInsert)

      return created
    })

    const enriched = await findProviderOrderById(this.db, order.id)
    if (!enriched) throw new ApiError('No se pudo recuperar la orden creada', 500)
    return enriched
  }
}
