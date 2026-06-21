import { ApiError } from '../../../shared/http/api-response'
import type { DB } from '../../../shared/db'
import type { ProviderWithRelations } from '../domain/provider.entity'
import {
  createProvider,
  findActiveProviderByNameInOrganization,
  findProviderById,
} from '../infra/repository/provider.repository'

export type CreateProviderInput = {
  organizationId: string
  name: string
  companyName?: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
}

export class CreateProvider {
  constructor(private readonly db: DB) {}

  async execute(input: CreateProviderInput): Promise<ProviderWithRelations> {
    const trimmedName = input.name.trim()
    if (trimmedName.length === 0) {
      throw new ApiError('El nombre es obligatorio', 400)
    }

    const dup = await findActiveProviderByNameInOrganization(
      this.db,
      input.organizationId,
      trimmedName,
    )
    if (dup) {
      throw new ApiError('Ya existe un proveedor con ese nombre en la organización', 409)
    }

    const created = await createProvider(this.db, {
      organizationId: input.organizationId,
      name: trimmedName,
      companyName: input.companyName?.trim() || null,
      contactName: input.contactName?.trim() || null,
      contactEmail: input.contactEmail?.trim() || null,
      contactPhone: input.contactPhone?.trim() || null,
      isActive: true,
    })

    if (!created) throw new ApiError('No se pudo crear el proveedor', 500)

    const enriched = await findProviderById(this.db, created.id)
    if (!enriched) throw new ApiError('No se pudo recuperar el proveedor creado', 500)
    return enriched
  }
}
