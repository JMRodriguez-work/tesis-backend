import type { DB } from '../../../shared/db'
import * as schema from '../../../shared/db/schema'
import {
  findActiveWarehouseByNameInOrganization,
  findWarehouseById,
  findWarehouseByIdRaw,
  updateWarehouse,
  type WarehouseWithRelations,
} from '../infra/repository/warehouse.repository'
import { ApiError } from '../../../shared/http/api-response'

export type UpdateWarehouseInput = {
  id: string
  organizationId: string
  data: {
    name?: string
    description?: string | null
    isActive?: boolean
  }
}

export class UpdateWarehouse {
  constructor(private readonly db: DB) {}

  async execute(input: UpdateWarehouseInput): Promise<WarehouseWithRelations | null> {
    const existing = await findWarehouseByIdRaw(this.db, input.id)
    if (!existing || existing.deletedAt !== null) return null
    if (existing.organizationId !== input.organizationId) return null

    const patch: Partial<typeof schema.warehouses.$inferInsert> = {}

    if (input.data.name !== undefined) {
      const trimmed = input.data.name.trim()
      if (trimmed.length === 0) throw new ApiError('El nombre es obligatorio', 400)
      const dup = await findActiveWarehouseByNameInOrganization(
        this.db,
        input.organizationId,
        trimmed,
        input.id,
      )
      if (dup) throw new ApiError('Ya existe un depósito con ese nombre en la organización', 409)
      patch.name = trimmed
    }

    if (input.data.description !== undefined) patch.description = input.data.description
    if (input.data.isActive !== undefined) patch.isActive = input.data.isActive

    if (Object.keys(patch).length === 0) {
      return findWarehouseById(this.db, input.id)
    }

    const updated = await updateWarehouse(this.db, input.id, patch)
    if (!updated) return null
    return findWarehouseById(this.db, input.id)
  }
}
