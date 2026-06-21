import { eq } from 'drizzle-orm'
import { ApiError } from '../../../shared/http/api-response'
import type { DB } from '../../../shared/db'
import * as schema from '../../../shared/db/schema'
import {
  findActiveItemByBarcode,
  findActiveItemByCodeInBranch,
  findActiveItemByNameInBranch,
  findItemById,
  findItemByIdRaw,
  findItemCategoryByIdRaw,
  findUnitById,
  updateItem,
  type ItemWithRelations,
} from '../infra/repository/item.repository'
import { ADMIN_ROLE_ID, type ResolveItemBranchInput } from './resolve-item-branch'

export type UpdateItemInput = ResolveItemBranchInput & {
  id: string
  data: {
    name?: string
    description?: string | null
    categoryId?: string | null
    baseUnitId?: number | null
    purchasePrice?: string | null
    salePrice?: string | null
    code?: string | null
    barcode?: string | null
    isActive?: boolean
  }
}

export class UpdateItem {
  constructor(private readonly db: DB) {}

  async execute(input: UpdateItemInput): Promise<ItemWithRelations | null> {
    const existing = await findItemByIdRaw(this.db, input.id)
    if (!existing) return null

    if (!input.userOrganizationId) return null

    const isAdmin = input.userRoleId === ADMIN_ROLE_ID

    if (isAdmin) {
      const branch = await this.db
        .select({ organizationId: schema.branches.organizationId })
        .from(schema.branches)
        .where(eq(schema.branches.id, existing.branchId))
        .limit(1)

      if (!branch[0] || branch[0].organizationId !== input.userOrganizationId) {
        return null
      }
    } else {
      if (input.userBranchId === null || existing.branchId !== input.userBranchId) {
        return null
      }
    }

    const patch: Partial<typeof schema.items.$inferInsert> = {}

    if (input.data.name !== undefined) {
      const trimmed = input.data.name.trim()
      if (trimmed.length === 0) {
        throw new ApiError('El nombre es obligatorio', 400)
      }
      const dup = await findActiveItemByNameInBranch(
        this.db,
        existing.branchId,
        trimmed,
        input.id,
      )
      if (dup) {
        throw new ApiError('Ya existe un item con ese nombre en esta sucursal', 409)
      }
      patch.name = trimmed
    }

    if (input.data.code !== undefined) {
      const trimmed = input.data.code === null ? null : input.data.code.trim()
      if (trimmed && trimmed.length > 0) {
        const dup = await findActiveItemByCodeInBranch(
          this.db,
          existing.branchId,
          trimmed,
          input.id,
        )
        if (dup) {
          throw new ApiError('Ya existe un item con ese código interno en esta sucursal', 409)
        }
      }
      patch.code = trimmed
    }

    if (input.data.barcode !== undefined) {
      const trimmed = input.data.barcode === null ? null : input.data.barcode.trim()
      if (trimmed && trimmed.length > 0) {
        const dup = await findActiveItemByBarcode(this.db, trimmed, input.id)
        if (dup) {
          throw new ApiError('Ya existe un item con ese código de barras', 409)
        }
      }
      patch.barcode = trimmed
    }

    if (input.data.categoryId !== undefined) {
      if (input.data.categoryId === null) {
        patch.categoryId = null
      } else {
        const category = await findItemCategoryByIdRaw(this.db, input.data.categoryId)
        if (!category) {
          throw new ApiError('La categoría no existe', 400)
        }
        if (category.branchId !== existing.branchId) {
          throw new ApiError('La categoría no pertenece a la sucursal del item', 400)
        }
        patch.categoryId = input.data.categoryId
      }
    }

    if (input.data.baseUnitId !== undefined) {
      if (input.data.baseUnitId === null) {
        patch.baseUnitId = null
      } else {
        const unit = await findUnitById(this.db, input.data.baseUnitId)
        if (!unit) {
          throw new ApiError('La unidad de medida no existe', 400)
        }
        patch.baseUnitId = input.data.baseUnitId
      }
    }

    if (input.data.description !== undefined) patch.description = input.data.description
    if (input.data.purchasePrice !== undefined) patch.purchasePrice = input.data.purchasePrice
    if (input.data.salePrice !== undefined) patch.salePrice = input.data.salePrice
    if (input.data.isActive !== undefined) patch.isActive = input.data.isActive

    if (Object.keys(patch).length === 0) {
      return findItemById(this.db, input.id)
    }

    const updated = await updateItem(this.db, input.id, patch)
    if (!updated) return null

    return findItemById(this.db, input.id)
  }
}
