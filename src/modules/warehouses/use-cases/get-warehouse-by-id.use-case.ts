import { ApiError } from '../../../shared/http/api-response'
import type { DB } from '../../../shared/db'
import { findWarehouseById, type WarehouseWithRelations } from '../infra/repository/warehouse.repository'
import { ADMIN_ROLE_ID, type ScopeInput } from './resolve-warehouse-access'

export type GetWarehouseByIdInput = ScopeInput & {
  id: string
}

export class GetWarehouseById {
  constructor(private readonly db: DB) {}

  async execute(input: GetWarehouseByIdInput): Promise<WarehouseWithRelations | null> {
    if (!input.userOrganizationId) return null

    const wh = await findWarehouseById(this.db, input.id)
    if (!wh) return null

    const isAdmin = input.userRoleId === ADMIN_ROLE_ID
    if (isAdmin) {
      if (wh.organizationId !== input.userOrganizationId) return null
      return wh
    }

    if (input.userBranchId === null) return null
    const assigned = wh.branches.some((b) => b.id === input.userBranchId)
    if (!assigned) return null
    return wh
  }
}
