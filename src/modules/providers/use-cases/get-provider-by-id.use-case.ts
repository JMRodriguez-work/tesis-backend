import { ApiError } from '../../../shared/http/api-response'
import type { DB } from '../../../shared/db'
import { findProviderById } from '../infra/repository/provider.repository'

export type GetProviderByIdInput = {
  id: string
  organizationId: string
}

export class GetProviderById {
  constructor(private readonly db: DB) {}

  async execute(input: GetProviderByIdInput) {
    const provider = await findProviderById(this.db, input.id)
    if (!provider) throw new ApiError('Proveedor no encontrado', 404)
    if (provider.organizationId !== input.organizationId) {
      throw new ApiError('Proveedor no encontrado', 404)
    }
    return provider
  }
}
