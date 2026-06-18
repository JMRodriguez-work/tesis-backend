import { and, count, eq, ilike, isNull } from 'drizzle-orm'
import type { DB } from '../../../../shared/db'
import * as schema from '../../../../shared/db/schema'

export const itemCategoryTable = schema.itemCategories

export async function createItemCategory(
  db: DB,
  data: typeof schema.itemCategories.$inferInsert,
) {
  const result = await db.insert(schema.itemCategories).values(data).returning()
  return result[0]
}

export async function findItemCategoryByIdRaw(db: DB, id: string) {
  const result = await db
    .select()
    .from(schema.itemCategories)
    .where(eq(schema.itemCategories.id, id))
    .limit(1)
  return result[0] ?? null
}

export type ItemCategoryWithRelations = {
  id: string
  name: string
  description: string | null
  isActive: boolean
  branchId: string
  branch: { id: string; name: string }
  createdAt: Date
  updatedAt: Date
}

export async function findItemCategoryById(
  db: DB,
  id: string,
): Promise<ItemCategoryWithRelations | null> {
  const result = await db
    .select({
      id: schema.itemCategories.id,
      name: schema.itemCategories.name,
      description: schema.itemCategories.description,
      isActive: schema.itemCategories.isActive,
      branchId: schema.itemCategories.branchId,
      createdAt: schema.itemCategories.createdAt,
      updatedAt: schema.itemCategories.updatedAt,
      branchIdRel: schema.branches.id,
      branchName: schema.branches.name,
    })
    .from(schema.itemCategories)
    .leftJoin(
      schema.branches,
      eq(schema.branches.id, schema.itemCategories.branchId),
    )
    .where(and(eq(schema.itemCategories.id, id), isNull(schema.itemCategories.deletedAt)))
    .limit(1)

  const row = result[0]
  if (!row) return null

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    isActive: row.isActive,
    branchId: row.branchId,
    branch: {
      id: row.branchIdRel ?? row.branchId,
      name: row.branchName ?? '',
    },
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export type ListItemCategoriesFilters = {
  search?: string
  isActive?: boolean
}

export async function findItemCategoriesByBranch(
  db: DB,
  branchId: string,
  filters: ListItemCategoriesFilters,
  limit: number,
  offset: number,
): Promise<ItemCategoryWithRelations[]> {
  const conditions = [
    eq(schema.itemCategories.branchId, branchId),
    isNull(schema.itemCategories.deletedAt),
  ]

  if (filters.isActive !== undefined) {
    conditions.push(eq(schema.itemCategories.isActive, filters.isActive))
  }

  if (filters.search) {
    const pattern = `%${filters.search}%`
    conditions.push(ilike(schema.itemCategories.name, pattern)!)
  }

  const result = await db
    .select({
      id: schema.itemCategories.id,
      name: schema.itemCategories.name,
      description: schema.itemCategories.description,
      isActive: schema.itemCategories.isActive,
      branchId: schema.itemCategories.branchId,
      createdAt: schema.itemCategories.createdAt,
      updatedAt: schema.itemCategories.updatedAt,
      branchIdRel: schema.branches.id,
      branchName: schema.branches.name,
    })
    .from(schema.itemCategories)
    .leftJoin(
      schema.branches,
      eq(schema.branches.id, schema.itemCategories.branchId),
    )
    .where(and(...conditions))
    .orderBy(schema.itemCategories.createdAt)
    .limit(limit)
    .offset(offset)

  return result.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    isActive: row.isActive,
    branchId: row.branchId,
    branch: {
      id: row.branchIdRel ?? row.branchId,
      name: row.branchName ?? '',
    },
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }))
}

export async function countItemCategoriesByBranch(
  db: DB,
  branchId: string,
  filters: ListItemCategoriesFilters,
): Promise<number> {
  const conditions = [
    eq(schema.itemCategories.branchId, branchId),
    isNull(schema.itemCategories.deletedAt),
  ]

  if (filters.isActive !== undefined) {
    conditions.push(eq(schema.itemCategories.isActive, filters.isActive))
  }

  if (filters.search) {
    const pattern = `%${filters.search}%`
    conditions.push(ilike(schema.itemCategories.name, pattern)!)
  }

  const result = await db
    .select({ value: count() })
    .from(schema.itemCategories)
    .where(and(...conditions))

  return result[0]?.value ?? 0
}

export async function countActiveItemsByCategory(
  db: DB,
  categoryId: string,
): Promise<number> {
  const result = await db
    .select({ value: count() })
    .from(schema.items)
    .where(
      and(
        eq(schema.items.categoryId, categoryId),
        eq(schema.items.isActive, true),
        isNull(schema.items.deletedAt),
      ),
    )
  return result[0]?.value ?? 0
}

export async function findBranchByIdRaw(db: DB, id: string) {
  const result = await db
    .select()
    .from(schema.branches)
    .where(and(eq(schema.branches.id, id), isNull(schema.branches.deletedAt)))
    .limit(1)
  return result[0] ?? null
}

export async function updateItemCategory(
  db: DB,
  id: string,
  data: Partial<typeof schema.itemCategories.$inferInsert>,
) {
  const result = await db
    .update(schema.itemCategories)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(schema.itemCategories.id, id), isNull(schema.itemCategories.deletedAt)))
    .returning()
  return result[0] ?? null
}

export async function softDeleteItemCategory(db: DB, id: string) {
  const result = await db
    .update(schema.itemCategories)
    .set({ deletedAt: new Date(), isActive: false, updatedAt: new Date() })
    .where(and(eq(schema.itemCategories.id, id), isNull(schema.itemCategories.deletedAt)))
    .returning({ id: schema.itemCategories.id })
  return result[0] ?? null
}
