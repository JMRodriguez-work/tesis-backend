import { ApiError } from '../../../shared/http/api-response'
import type { DB } from '../../../shared/db'
import {
  findActiveProviderByNameInOrganization,
  findProviderById,
  updateProvider,
} from '../infra/repository/provider.repository'

export type UpdateProviderInput = {
  id: string
  organizationId: string
  data: {
    name?: string
    companyName?: string | null
    contactName?: string | null
    contactEmail?: string | null
    contactPhone?: string | null
    isActive?: boolean
  }
}

export class UpdateProvider {
  constructor(private readonly db: DB) {}

  async execute(input: UpdateProviderInput) {
    const existing = await findProviderById(this.db, input.id)
    if (!existing) throw new ApiError('Proveedor no encontrado', 404)
    if (existing.organizationId !== input.organizationId) {
      throw new ApiError('Proveedor no encontrado', 404)
    }

    const updates: Parameters<typeof updateProvider>[2] = {}

    if (input.data.name !== undefined) {
      const trimmed = input.data.name.trim()
      if (trimmed.length === 0) {
        throw new ApiError('El nombre es obligatorio', 400)
      }
      const dup = await findActiveProviderByNameInOrganization(
        this.db,
        input.organizationId,
        trimmed,
        input.id,
      )
      if (dup) {
        throw new ApiError('Ya existe un proveedor con ese nombre en la organización', 409)
      }
      updates.name = trimmed
    }

    if (input.data.companyName !== undefined) {
      updates.companyName = input.data.companyName?.trim() || null
    }
    if (input.data.contactName !== undefined) {
      updates.contactName = input.data.contactName?.trim() || null
    }
    if (input.data.contactEmail !== undefined) {
      updates.contactEmail = input.data.contactEmail?.trim() || null
    }
    if (input.data.contactPhone !== undefined) {
      updates.contactPhone = input.data.contactPhone?.trim() || null
    }
    if (input.data.isActive !== undefined) {
      updates.isActive = input.data.isActive
    }

    if (Object.keys(updates).length === 0) {
      return existing
    }

    const updated = await updateProvider(this.db, input.id, updates)
    if (!updated) throw new ApiError('No se pudo actualizar el proveedor', 500)

    const enriched = await findProviderById(this.db, input.id)
    if (!enriched) throw new ApiError('Proveedor no encontrado', 404)
    return enriched
  }
}
