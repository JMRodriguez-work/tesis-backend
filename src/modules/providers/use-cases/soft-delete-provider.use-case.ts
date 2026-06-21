import { ApiError } from '../../../shared/http/api-response'
import type { DB } from '../../../shared/db'
import {
  countActiveProviderOrdersByProvider,
  findProviderByIdRaw,
  softDeleteProvider,
} from '../infra/repository/provider.repository'

export type SoftDeleteProviderInput = {
  id: string
  organizationId: string
}

export class SoftDeleteProvider {
  constructor(private readonly db: DB) {}

  async execute(input: SoftDeleteProviderInput): Promise<void> {
    const existing = await findProviderByIdRaw(this.db, input.id)
    if (!existing || existing.organizationId !== input.organizationId) {
      throw new ApiError('Proveedor no encontrado', 404)
    }
    if (existing.deletedAt !== null) return

    const activeOrders = await countActiveProviderOrdersByProvider(this.db, input.id)
    if (activeOrders > 0) {
      throw new ApiError(
        `No se puede eliminar el proveedor porque tiene ${activeOrders} orden(es) activa(s). Cancélelas o complételas primero.`,
        400,
      )
    }

    await softDeleteProvider(this.db, input.id)
  }
}
