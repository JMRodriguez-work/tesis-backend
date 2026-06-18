import type { DB } from '../../../shared/db'
import { findBranchByIdRaw, findItemCategoryById, type ItemCategoryWithRelations } from '../infra/repository/item-category.repository'
import { ADMIN_ROLE_ID, type ResolveBranchInput } from './resolve-branch'

export type GetItemCategoryByIdInput = ResolveBranchInput & {
  id: string
}

export class GetItemCategoryById {
  constructor(private readonly db: DB) {}

  async execute(input: GetItemCategoryByIdInput): Promise<ItemCategoryWithRelations | null> {
    const category = await findItemCategoryById(this.db, input.id)
    if (!category) return null

    if (!input.userOrganizationId) return null

    const isAdmin = input.userRoleId === ADMIN_ROLE_ID

    if (isAdmin) {
      const branch = await findBranchByIdRaw(this.db, category.branchId)
      if (!branch || branch.organizationId !== input.userOrganizationId) return null
      return category
    }

    if (input.userBranchId === null) return null
    if (category.branchId !== input.userBranchId) return null

    return category
  }
}
