import { ApiError } from '../../../shared/http/api-response'
import type { DB } from '../../../shared/db'
import {
  createItem,
  findActiveItemByBarcode,
  findActiveItemByCodeInBranch,
  findActiveItemByNameInBranch,
  findItemById,
  findItemCategoryByIdRaw,
  findUnitById,
  type ItemWithRelations,
} from '../infra/repository/item.repository'
import {
  resolveItemBranchForWrite,
  type ResolveItemBranchInput,
} from './resolve-item-branch'
import { computePricingWarning, type PricingWarning } from '../domain/pricing-warning'

export type CreateItemInput = ResolveItemBranchInput & {
  name: string
  description?: string
  categoryId?: string
  baseUnitId?: number
  purchasePrice?: string
  salePrice?: string
  code?: string
  barcode?: string
  isActive?: boolean
}

export type CreateItemResult = {
  item: ItemWithRelations
  warning: PricingWarning | null
}

export class CreateItem {
  constructor(private readonly db: DB) {}

  async execute(input: CreateItemInput): Promise<CreateItemResult> {
    const { branchId } = await resolveItemBranchForWrite(this.db, input)

    const trimmedName = input.name.trim()
    if (trimmedName.length === 0) {
      throw new ApiError('El nombre es obligatorio', 400)
    }

    const trimmedCode = input.code?.trim()
    const trimmedBarcode = input.barcode?.trim()

    const existingName = await findActiveItemByNameInBranch(this.db, branchId, trimmedName)
    if (existingName) {
      throw new ApiError('Ya existe un item con ese nombre en esta sucursal', 409)
    }

    if (trimmedBarcode) {
      const existingBarcode = await findActiveItemByBarcode(this.db, trimmedBarcode)
      if (existingBarcode) {
        throw new ApiError('Ya existe un item con ese código de barras', 409)
      }
    }

    if (trimmedCode) {
      const existingCode = await findActiveItemByCodeInBranch(
        this.db,
        branchId,
        trimmedCode,
      )
      if (existingCode) {
        throw new ApiError('Ya existe un item con ese código interno en esta sucursal', 409)
      }
    }

    if (input.categoryId) {
      const category = await findItemCategoryByIdRaw(this.db, input.categoryId)
      if (!category) {
        throw new ApiError('La categoría no existe', 400)
      }
      if (category.branchId !== branchId) {
        throw new ApiError('La categoría no pertenece a la sucursal', 400)
      }
    }

    if (input.baseUnitId !== undefined) {
      const unit = await findUnitById(this.db, input.baseUnitId)
      if (!unit) {
        throw new ApiError('La unidad de medida no existe', 400)
      }
    }

    const created = await createItem(this.db, {
      branchId,
      name: trimmedName,
      description: input.description,
      categoryId: input.categoryId,
      baseUnitId: input.baseUnitId,
      purchasePrice: input.purchasePrice,
      salePrice: input.salePrice,
      code: trimmedCode,
      barcode: trimmedBarcode,
      isActive: input.isActive ?? true,
    })

    if (!created) throw new ApiError('No se pudo crear el item', 500)

    const enriched = await findItemById(this.db, created.id)
    if (!enriched) throw new ApiError('No se pudo recuperar el item creado', 500)

    const warning = computePricingWarning(enriched.salePrice, enriched.purchasePrice)
    if (warning) {
      console.warn(
        `[items:create] pricing warning: item ${enriched.id} salePrice=${enriched.salePrice} < purchasePrice=${enriched.purchasePrice}`,
      )
    }

    return { item: enriched, warning }
  }
}
