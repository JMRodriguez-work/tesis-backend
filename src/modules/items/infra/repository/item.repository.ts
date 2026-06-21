import { and, count, eq, ilike, isNull, ne, or, sum, type SQL } from 'drizzle-orm'
import type { DB } from '../../../../shared/db'
import * as schema from '../../../../shared/db/schema'

export const itemTable = schema.items

export async function findItemByIdRaw(db: DB, id: string) {
  const result = await db
    .select()
    .from(schema.items)
    .where(eq(schema.items.id, id))
    .limit(1)
  return result[0] ?? null
}

export type ItemWithRelations = {
  id: string
  name: string
  description: string | null
  categoryId: string | null
  baseUnitId: number | null
  purchasePrice: string | null
  salePrice: string | null
  code: string | null
  barcode: string | null
  isActive: boolean
  branchId: string
  branch: { id: string; name: string }
  category: { id: string; name: string } | null
  baseUnit: {
    id: number
    name: string
    abbreviation: string
    unitType: string
    conversionFactor: string
  } | null
  createdAt: Date
  updatedAt: Date
}

async function enrichRow(
  row: {
    id: string
    name: string
    description: string | null
    categoryId: string | null
    baseUnitId: number | null
    purchasePrice: string | null
    salePrice: string | null
    code: string | null
    barcode: string | null
    isActive: boolean
    branchId: string
    createdAt: Date
    updatedAt: Date
    branchIdRel?: string | null
    branchName?: string | null
    categoryIdRel?: string | null
    categoryName?: string | null
    unitIdRel?: number | null | undefined
    unitName?: string | null
    unitAbbreviation?: string | null
    unitType?: string | null
    unitConversionFactor?: string | null
  } | undefined,
): Promise<ItemWithRelations | null> {
  if (!row) return null

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    categoryId: row.categoryId,
    baseUnitId: row.baseUnitId,
    purchasePrice: row.purchasePrice,
    salePrice: row.salePrice,
    code: row.code,
    barcode: row.barcode,
    isActive: row.isActive,
    branchId: row.branchId,
    branch: {
      id: row.branchIdRel ?? row.branchId,
      name: row.branchName ?? '',
    },
    category:
      row.categoryId && row.categoryIdRel
        ? { id: row.categoryIdRel, name: row.categoryName ?? '' }
        : null,
    baseUnit:
      row.baseUnitId !== null && row.unitIdRel != null
        ? {
            id: row.unitIdRel,
            name: row.unitName ?? '',
            abbreviation: row.unitAbbreviation ?? '',
            unitType: row.unitType ?? '',
            conversionFactor: row.unitConversionFactor ?? '1',
          }
        : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export async function findItemById(db: DB, id: string): Promise<ItemWithRelations | null> {
  const result = await db
    .select({
      id: schema.items.id,
      name: schema.items.name,
      description: schema.items.description,
      categoryId: schema.items.categoryId,
      baseUnitId: schema.items.baseUnitId,
      purchasePrice: schema.items.purchasePrice,
      salePrice: schema.items.salePrice,
      code: schema.items.code,
      barcode: schema.items.barcode,
      isActive: schema.items.isActive,
      branchId: schema.items.branchId,
      createdAt: schema.items.createdAt,
      updatedAt: schema.items.updatedAt,
      branchIdRel: schema.branches.id,
      branchName: schema.branches.name,
      categoryIdRel: schema.itemCategories.id,
      categoryName: schema.itemCategories.name,
      unitIdRel: schema.units.id,
      unitName: schema.units.name,
      unitAbbreviation: schema.units.abbreviation,
      unitType: schema.units.unitType,
      unitConversionFactor: schema.units.conversionFactor,
    })
    .from(schema.items)
    .leftJoin(schema.branches, eq(schema.branches.id, schema.items.branchId))
    .leftJoin(
      schema.itemCategories,
      eq(schema.itemCategories.id, schema.items.categoryId),
    )
    .leftJoin(schema.units, eq(schema.units.id, schema.items.baseUnitId))
    .where(and(eq(schema.items.id, id), isNull(schema.items.deletedAt)))
    .limit(1)

  return enrichRow(result[0])
}

export async function findItemByBarcode(
  db: DB,
  barcode: string,
): Promise<ItemWithRelations | null> {
  const result = await db
    .select({
      id: schema.items.id,
      name: schema.items.name,
      description: schema.items.description,
      categoryId: schema.items.categoryId,
      baseUnitId: schema.items.baseUnitId,
      purchasePrice: schema.items.purchasePrice,
      salePrice: schema.items.salePrice,
      code: schema.items.code,
      barcode: schema.items.barcode,
      isActive: schema.items.isActive,
      branchId: schema.items.branchId,
      createdAt: schema.items.createdAt,
      updatedAt: schema.items.updatedAt,
      branchIdRel: schema.branches.id,
      branchName: schema.branches.name,
      categoryIdRel: schema.itemCategories.id,
      categoryName: schema.itemCategories.name,
      unitIdRel: schema.units.id,
      unitName: schema.units.name,
      unitAbbreviation: schema.units.abbreviation,
      unitType: schema.units.unitType,
      unitConversionFactor: schema.units.conversionFactor,
    })
    .from(schema.items)
    .leftJoin(schema.branches, eq(schema.branches.id, schema.items.branchId))
    .leftJoin(
      schema.itemCategories,
      eq(schema.itemCategories.id, schema.items.categoryId),
    )
    .leftJoin(schema.units, eq(schema.units.id, schema.items.baseUnitId))
    .where(
      and(
        eq(schema.items.barcode, barcode),
        isNull(schema.items.deletedAt),
      ),
    )
    .limit(1)

  return enrichRow(result[0])
}

export type ListItemsFilters = {
  search?: string
  categoryId?: string
  isActive?: boolean
}

export async function findItemsByBranch(
  db: DB,
  branchId: string,
  filters: ListItemsFilters,
  limit: number,
  offset: number,
): Promise<ItemWithRelations[]> {
  const conditions: SQL[] = [
    eq(schema.items.branchId, branchId),
    isNull(schema.items.deletedAt),
  ]

  if (filters.isActive !== undefined) {
    conditions.push(eq(schema.items.isActive, filters.isActive))
  }

  if (filters.categoryId) {
    conditions.push(eq(schema.items.categoryId, filters.categoryId))
  }

  if (filters.search) {
    const pattern = `%${filters.search}%`
    conditions.push(
      or(
        ilike(schema.items.name, pattern),
        ilike(schema.items.code, pattern),
        ilike(schema.items.barcode, pattern),
      )!,
    )
  }

  const result = await db
    .select({
      id: schema.items.id,
      name: schema.items.name,
      description: schema.items.description,
      categoryId: schema.items.categoryId,
      baseUnitId: schema.items.baseUnitId,
      purchasePrice: schema.items.purchasePrice,
      salePrice: schema.items.salePrice,
      code: schema.items.code,
      barcode: schema.items.barcode,
      isActive: schema.items.isActive,
      branchId: schema.items.branchId,
      createdAt: schema.items.createdAt,
      updatedAt: schema.items.updatedAt,
      branchIdRel: schema.branches.id,
      branchName: schema.branches.name,
      categoryIdRel: schema.itemCategories.id,
      categoryName: schema.itemCategories.name,
      unitIdRel: schema.units.id,
      unitName: schema.units.name,
      unitAbbreviation: schema.units.abbreviation,
      unitType: schema.units.unitType,
      unitConversionFactor: schema.units.conversionFactor,
    })
    .from(schema.items)
    .leftJoin(schema.branches, eq(schema.branches.id, schema.items.branchId))
    .leftJoin(
      schema.itemCategories,
      eq(schema.itemCategories.id, schema.items.categoryId),
    )
    .leftJoin(schema.units, eq(schema.units.id, schema.items.baseUnitId))
    .where(and(...conditions))
    .orderBy(schema.items.name)
    .limit(limit)
    .offset(offset)

  const enriched = await Promise.all(result.map((row) => enrichRow(row)))
  return enriched.filter((item): item is ItemWithRelations => item !== null)
}

export async function countItemsByBranch(
  db: DB,
  branchId: string,
  filters: ListItemsFilters,
): Promise<number> {
  const conditions: SQL[] = [
    eq(schema.items.branchId, branchId),
    isNull(schema.items.deletedAt),
  ]

  if (filters.isActive !== undefined) {
    conditions.push(eq(schema.items.isActive, filters.isActive))
  }

  if (filters.categoryId) {
    conditions.push(eq(schema.items.categoryId, filters.categoryId))
  }

  if (filters.search) {
    const pattern = `%${filters.search}%`
    conditions.push(
      or(
        ilike(schema.items.name, pattern),
        ilike(schema.items.code, pattern),
        ilike(schema.items.barcode, pattern),
      )!,
    )
  }

  const result = await db
    .select({ value: count() })
    .from(schema.items)
    .where(and(...conditions))

  return result[0]?.value ?? 0
}

export async function findActiveItemByNameInBranch(
  db: DB,
  branchId: string,
  name: string,
  excludeId?: string,
): Promise<{ id: string } | null> {
  const conditions = [
    eq(schema.items.branchId, branchId),
    eq(schema.items.name, name),
    isNull(schema.items.deletedAt),
  ]
  if (excludeId) {
    conditions.push(ne(schema.items.id, excludeId))
  }
  const result = await db
    .select({ id: schema.items.id })
    .from(schema.items)
    .where(and(...conditions))
    .limit(1)
  return result[0] ?? null
}

export async function findActiveItemByBarcode(
  db: DB,
  barcode: string,
  excludeId?: string,
): Promise<{ id: string } | null> {
  const conditions = [
    eq(schema.items.barcode, barcode),
    isNull(schema.items.deletedAt),
  ]
  if (excludeId) {
    conditions.push(ne(schema.items.id, excludeId))
  }
  const result = await db
    .select({ id: schema.items.id })
    .from(schema.items)
    .where(and(...conditions))
    .limit(1)
  return result[0] ?? null
}

export async function findActiveItemByCodeInBranch(
  db: DB,
  branchId: string,
  code: string,
  excludeId?: string,
): Promise<{ id: string } | null> {
  const conditions = [
    eq(schema.items.branchId, branchId),
    eq(schema.items.code, code),
    isNull(schema.items.deletedAt),
  ]
  if (excludeId) {
    conditions.push(ne(schema.items.id, excludeId))
  }
  const result = await db
    .select({ id: schema.items.id })
    .from(schema.items)
    .where(and(...conditions))
    .limit(1)
  return result[0] ?? null
}

export async function findItemCategoryByIdRaw(db: DB, id: string) {
  const result = await db
    .select()
    .from(schema.itemCategories)
    .where(
      and(eq(schema.itemCategories.id, id), isNull(schema.itemCategories.deletedAt)),
    )
    .limit(1)
  return result[0] ?? null
}

export async function findUnitById(db: DB, id: number) {
  const result = await db
    .select()
    .from(schema.units)
    .where(eq(schema.units.id, id))
    .limit(1)
  return result[0] ?? null
}

export async function countActiveSalesByItem(db: DB, itemId: string): Promise<number> {
  const result = await db
    .select({ value: count() })
    .from(schema.sales)
    .innerJoin(schema.saleItems, eq(schema.saleItems.saleId, schema.sales.id))
    .where(
      and(
        eq(schema.saleItems.itemId, itemId),
        eq(schema.sales.isActive, true),
        isNull(schema.sales.deletedAt),
      ),
    )
  return result[0]?.value ?? 0
}

/**
 * Sums the `quantity` of all `warehouse_item_stocks` rows for an item,
 * across every warehouse (including ones from other branches of the same
 * org). Returns `"0"` if no rows.
 *
 * Used by `SoftDeleteItem` to refuse the deletion if there's any stock
 * left. The merchant must first move the stock out (transfer/adjustment)
 * to be able to soft-delete the item.
 */
export async function sumStockByItem(db: DB, itemId: string): Promise<string> {
  const result = await db
    .select({ value: sum(schema.warehouseItemStocks.quantity) })
    .from(schema.warehouseItemStocks)
    .where(eq(schema.warehouseItemStocks.itemId, itemId))
  const v = result[0]?.value
  return v ?? "0"
}

export async function createItem(
  db: DB,
  data: typeof schema.items.$inferInsert,
) {
  const result = await db.insert(schema.items).values(data).returning()
  return result[0]
}

export async function updateItem(
  db: DB,
  id: string,
  data: Partial<typeof schema.items.$inferInsert>,
) {
  const result = await db
    .update(schema.items)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(schema.items.id, id), isNull(schema.items.deletedAt)))
    .returning()
  return result[0] ?? null
}

export async function softDeleteItem(db: DB, id: string) {
  const result = await db
    .update(schema.items)
    .set({ deletedAt: new Date(), isActive: false, updatedAt: new Date() })
    .where(and(eq(schema.items.id, id), isNull(schema.items.deletedAt)))
    .returning({ id: schema.items.id })
  return result[0] ?? null
}
