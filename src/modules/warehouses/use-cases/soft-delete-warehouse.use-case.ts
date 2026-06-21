import { ApiError } from '../../../shared/http/api-response'
import type { DB } from '../../../shared/db'
import {
  countWarehouseItemStocksGreaterThanZero,
  findWarehouseByIdRaw,
  softDeleteWarehouse,
} from '../infra/repository/warehouse.repository'

export class SoftDeleteWarehouse {
  constructor(private readonly db: DB) {}

  async execute(id: string, organizationId: string): Promise<void> {
    const existing = await findWarehouseByIdRaw(this.db, id)
    if (!existing || existing.deletedAt !== null) {
      throw new ApiError('Depósito no encontrado', 404)
    }
    if (existing.organizationId !== organizationId) {
      throw new ApiError('Depósito no encontrado', 404)
    }

    const nonZero = await countWarehouseItemStocksGreaterThanZero(this.db, id)
    if (nonZero > 0) {
      throw new ApiError(
        `No se puede eliminar el depósito porque tiene ${nonZero} item(s) con stock > 0`,
        400,
      )
    }

    await softDeleteWarehouse(this.db, id)
  }
}
