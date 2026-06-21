import { ApiError } from '../../../shared/http/api-response'
import type { DB } from '../../../shared/db'
import {
  findActiveWarehouseByNameInOrganization,
  findBranchByIdRaw,
  findWarehouseById,
  warehouseBranchesTable,
  warehouseTable,
} from '../infra/repository/warehouse.repository'

export type CreateWarehouseInput = {
  name: string
  description?: string
  branchIds: string[]
  organizationId: string
}

export class CreateWarehouse {
  constructor(private readonly db: DB) {}

  async execute(input: CreateWarehouseInput) {
    if (input.branchIds.length === 0) {
      throw new ApiError('Debes asignar el depósito a al menos una sucursal', 400)
    }

    const trimmedName = input.name.trim()
    if (trimmedName.length === 0) {
      throw new ApiError('El nombre es obligatorio', 400)
    }

    const dup = await findActiveWarehouseByNameInOrganization(
      this.db,
      input.organizationId,
      trimmedName,
    )
    if (dup) {
      throw new ApiError('Ya existe un depósito con ese nombre en la organización', 409)
    }

    const deduped = Array.from(new Set(input.branchIds))

    for (const branchId of deduped) {
      const branch = await findBranchByIdRaw(this.db, branchId)
      if (!branch || branch.organizationId !== input.organizationId) {
        throw new ApiError(`La sucursal ${branchId} no pertenece a tu organización`, 400)
      }
    }

    const wh = await this.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(warehouseTable)
        .values({
          organizationId: input.organizationId,
          name: trimmedName,
          description: input.description,
          isActive: true,
        })
        .returning()
      if (!created) throw new ApiError('No se pudo crear el depósito', 500)

      for (const branchId of deduped) {
        await tx
          .insert(warehouseBranchesTable)
          .values({ warehouseId: created.id, branchId })
      }

      return created
    })

    const enriched = await findWarehouseById(this.db, wh.id)
    if (!enriched) throw new ApiError('No se pudo recuperar el depósito creado', 500)
    return enriched
  }
}
