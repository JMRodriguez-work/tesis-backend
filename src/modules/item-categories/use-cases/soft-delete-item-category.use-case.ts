import { ApiError } from '../../../shared/http/api-response'
import type { DB } from '../../../shared/db'
import {
  countActiveItemsByCategory,
  findBranchByIdRaw,
  findItemCategoryByIdRaw,
  softDeleteItemCategory,
} from '../infra/repository/item-category.repository'
import { ADMIN_ROLE_ID, type ResolveBranchInput } from './resolve-branch'

export type SoftDeleteItemCategoryInput = ResolveBranchInput & {
  id: string
}

export class SoftDeleteItemCategory {
  constructor(private readonly db: DB) {}

  async execute(input: SoftDeleteItemCategoryInput): Promise<void> {
    const existing = await findItemCategoryByIdRaw(this.db, input.id)
    if (!existing || existing.deletedAt !== null) return

    if (!input.userOrganizationId) {
      throw new ApiError('No autorizado', 403)
    }

    const isAdmin = input.userRoleId === ADMIN_ROLE_ID

    if (isAdmin) {
      const branch = await findBranchByIdRaw(this.db, existing.branchId)
      if (!branch || branch.organizationId !== input.userOrganizationId) {
        throw new ApiError('Categoría no encontrada', 404)
      }
    } else {
      if (input.userBranchId === null || existing.branchId !== input.userBranchId) {
        throw new ApiError('Categoría no encontrada', 404)
      }
    }

    const activeItems = await countActiveItemsByCategory(this.db, input.id)
    if (activeItems > 0) {
      throw new ApiError(
        `No se puede eliminar la categoría porque tiene ${activeItems} item(s) activo(s) asociado(s). Reasigná o desactivá los items primero`,
        400,
      )
    }

    await softDeleteItemCategory(this.db, input.id)
  }
}
