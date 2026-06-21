import { ApiError } from '../../../shared/http/api-response'
import type { DB } from '../../../shared/db'
import {
  findWarehouseBranchAssignment,
  findWarehouseByIdRaw,
  assignWarehouseToBranch,
  findBranchByIdRaw,
} from '../infra/repository/warehouse.repository'

export class AssignWarehouseToBranch {
  constructor(private readonly db: DB) {}

  async execute(warehouseId: string, branchId: string, organizationId: string): Promise<void> {
    const wh = await findWarehouseByIdRaw(this.db, warehouseId)
    if (!wh || wh.deletedAt !== null) throw new ApiError('Depósito no encontrado', 404)
    if (wh.organizationId !== organizationId) throw new ApiError('Depósito no encontrado', 404)

    const branch = await findBranchByIdRaw(this.db, branchId)
    if (!branch) throw new ApiError('La sucursal no existe', 400)
    if (branch.organizationId !== organizationId) {
      throw new ApiError('La sucursal no pertenece a tu organización', 400)
    }

    const existing = await findWarehouseBranchAssignment(this.db, warehouseId, branchId)
    if (existing) {
      throw new ApiError('El depósito ya está asignado a esa sucursal', 409)
    }

    await assignWarehouseToBranch(this.db, warehouseId, branchId)
  }
}
