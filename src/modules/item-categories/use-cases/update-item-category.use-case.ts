import type { DB } from '../../../shared/db'
import * as schema from '../../../shared/db/schema'
import {
  findBranchByIdRaw,
  findItemCategoryById,
  findItemCategoryByIdRaw,
  updateItemCategory,
  type ItemCategoryWithRelations,
} from '../infra/repository/item-category.repository'
import { ADMIN_ROLE_ID, type ResolveBranchInput } from './resolve-branch'

export type UpdateItemCategoryInput = ResolveBranchInput & {
  id: string
  data: {
    name?: string
    description?: string | null
    isActive?: boolean
  }
}

export class UpdateItemCategory {
  constructor(private readonly db: DB) {}

  async execute(input: UpdateItemCategoryInput): Promise<ItemCategoryWithRelations | null> {
    const existing = await findItemCategoryByIdRaw(this.db, input.id)
    if (!existing || existing.deletedAt !== null) return null

    if (!input.userOrganizationId) return null

    const isAdmin = input.userRoleId === ADMIN_ROLE_ID

    if (isAdmin) {
      const branch = await findBranchByIdRaw(this.db, existing.branchId)
      if (!branch || branch.organizationId !== input.userOrganizationId) return null
    } else {
      if (input.userBranchId === null) return null
      if (existing.branchId !== input.userBranchId) return null
    }

    const patch: Partial<typeof schema.itemCategories.$inferInsert> = {}
    if (input.data.name !== undefined) patch.name = input.data.name.trim()
    if (input.data.description !== undefined) patch.description = input.data.description
    if (input.data.isActive !== undefined) patch.isActive = input.data.isActive

    if (Object.keys(patch).length === 0) {
      return findItemCategoryById(this.db, input.id)
    }

    const updated = await updateItemCategory(this.db, input.id, patch)
    if (!updated) return null
    return findItemCategoryById(this.db, input.id)
  }
}
