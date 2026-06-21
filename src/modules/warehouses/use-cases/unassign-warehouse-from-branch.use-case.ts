import { ApiError } from '../../../shared/http/api-response'
import type { DB } from '../../../shared/db'
import {
  findWarehouseByIdRaw,
  unassignWarehouseFromBranch,
} from '../infra/repository/warehouse.repository'

export class UnassignWarehouseFromBranch {
  constructor(private readonly db: DB) {}

  async execute(warehouseId: string, branchId: string, organizationId: string): Promise<void> {
    const wh = await findWarehouseByIdRaw(this.db, warehouseId)
    if (!wh || wh.deletedAt !== null) throw new ApiError('Depósito no encontrado', 404)
    if (wh.organizationId !== organizationId) throw new ApiError('Depósito no encontrado', 404)

    // Idempotent: no error if the assignment doesn't exist.
    await unassignWarehouseFromBranch(this.db, warehouseId, branchId)
  }
}
