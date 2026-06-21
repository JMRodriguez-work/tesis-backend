import { ApiError } from '../../../shared/http/api-response'
import type { DB } from '../../../shared/db'
import { createItemCategory, findItemCategoryById, type ItemCategoryWithRelations } from '../infra/repository/item-category.repository'
import { resolveBranchForWrite, type ResolveBranchInput } from './resolve-branch'

export type CreateItemCategoryInput = ResolveBranchInput & {
  name: string
  description?: string
  isActive?: boolean
}

export class CreateItemCategory {
  constructor(private readonly db: DB) {}

  async execute(input: CreateItemCategoryInput): Promise<ItemCategoryWithRelations> {
    const { branchId } = await resolveBranchForWrite(this.db, input)

    const created = await createItemCategory(this.db, {
      branchId,
      name: input.name.trim(),
      description: input.description,
      isActive: input.isActive ?? true,
    })

    if (!created) throw new ApiError('No se pudo crear la categoría', 500)

    const enriched = await findItemCategoryById(this.db, created.id)
    if (!enriched) throw new ApiError('No se pudo recuperar la categoría creada', 500)
    return enriched
  }
}
