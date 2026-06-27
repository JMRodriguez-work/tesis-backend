import { and, count, eq, ilike, isNull, ne, or, type SQL } from 'drizzle-orm'
import type { DB } from '../../../../shared/db'
import * as schema from '../../../../shared/db/schema'

export const warehouseTable = schema.warehouses
export const warehouseBranchesTable = schema.warehouseBranches
export const warehouseItemStocksTable = schema.warehouseItemStocks

export type WarehouseWithRelations = {
  id: string
  name: string
  description: string | null
  isActive: boolean
  organizationId: string
  organization: { id: string; name: string }
  branches: { id: string; name: string }[]
  createdAt: Date
  updatedAt: Date
}

export async function findWarehouseByIdRaw(db: DB, id: string) {
  const result = await db
    .select()
    .from(schema.warehouses)
    .where(eq(schema.warehouses.id, id))
    .limit(1)
  return result[0] ?? null
}

export async function findWarehouseById(
  db: DB,
  id: string,
): Promise<WarehouseWithRelations | null> {
  const wh = await findWarehouseByIdRaw(db, id)
  if (!wh || wh.deletedAt !== null) return null

  const org = await db
    .select({ id: schema.organizations.id, name: schema.organizations.name })
    .from(schema.organizations)
    .where(eq(schema.organizations.id, wh.organizationId))
    .limit(1)

  const branches = await findBranchesAssignedToWarehouse(db, id)

  return {
    id: wh.id,
    name: wh.name,
    description: wh.description,
    isActive: wh.isActive,
    organizationId: wh.organizationId,
    organization: { id: org[0]?.id ?? wh.organizationId, name: org[0]?.name ?? '' },
    branches,
    createdAt: wh.createdAt,
    updatedAt: wh.updatedAt,
  }
}

export async function findBranchesAssignedToWarehouse(
  db: DB,
  warehouseId: string,
): Promise<{ id: string; name: string }[]> {
  const rows = await db
    .select({
      id: schema.branches.id,
      name: schema.branches.name,
    })
    .from(schema.warehouseBranches)
    .innerJoin(schema.branches, eq(schema.branches.id, schema.warehouseBranches.branchId))
    .where(
      and(
        eq(schema.warehouseBranches.warehouseId, warehouseId),
        isNull(schema.branches.deletedAt),
      ),
    )
  return rows
}

export type ListWarehousesFilters = {
  search?: string
  isActive?: boolean
}

export async function findWarehousesByOrganization(
  db: DB,
  organizationId: string,
  filters: ListWarehousesFilters,
  limit: number,
  offset: number,
): Promise<WarehouseWithRelations[]> {
  const conditions: SQL[] = [
    eq(schema.warehouses.organizationId, organizationId),
    isNull(schema.warehouses.deletedAt),
  ]
  if (filters.isActive !== undefined) {
    conditions.push(eq(schema.warehouses.isActive, filters.isActive))
  }
  if (filters.search) {
    const pattern = `%${filters.search}%`
    conditions.push(ilike(schema.warehouses.name, pattern)!)
  }

  const warehouses = await db
    .select()
    .from(schema.warehouses)
    .where(and(...conditions))
    .orderBy(schema.warehouses.name)
    .limit(limit)
    .offset(offset)

  return Promise.all(
    warehouses.map(async (wh) => {
      const branches = await findBranchesAssignedToWarehouse(db, wh.id)
      return {
        id: wh.id,
        name: wh.name,
        description: wh.description,
        isActive: wh.isActive,
        organizationId: wh.organizationId,
        organization: { id: wh.organizationId, name: '' },
        branches,
        createdAt: wh.createdAt,
        updatedAt: wh.updatedAt,
      }
    }),
  )
}

export async function findWarehousesByBranch(
  db: DB,
  branchId: string,
  filters: ListWarehousesFilters,
  limit: number,
  offset: number,
): Promise<WarehouseWithRelations[]> {
  const conditions: SQL[] = [
    eq(schema.warehouseBranches.branchId, branchId),
    isNull(schema.warehouses.deletedAt),
  ]
  if (filters.isActive !== undefined) {
    conditions.push(eq(schema.warehouses.isActive, filters.isActive))
  }
  if (filters.search) {
    const pattern = `%${filters.search}%`
    conditions.push(ilike(schema.warehouses.name, pattern)!)
  }

  const rows = await db
    .select({
      id: schema.warehouses.id,
      name: schema.warehouses.name,
      description: schema.warehouses.description,
      isActive: schema.warehouses.isActive,
      organizationId: schema.warehouses.organizationId,
      createdAt: schema.warehouses.createdAt,
      updatedAt: schema.warehouses.updatedAt,
    })
    .from(schema.warehouses)
    .innerJoin(
      schema.warehouseBranches,
      eq(schema.warehouseBranches.warehouseId, schema.warehouses.id),
    )
    .where(and(...conditions))
    .orderBy(schema.warehouses.name)
    .limit(limit)
    .offset(offset)

  return Promise.all(
    rows.map(async (wh) => {
      const branches = await findBranchesAssignedToWarehouse(db, wh.id)
      return {
        id: wh.id,
        name: wh.name,
        description: wh.description,
        isActive: wh.isActive,
        organizationId: wh.organizationId,
        organization: { id: wh.organizationId, name: '' },
        branches,
        createdAt: wh.createdAt,
        updatedAt: wh.updatedAt,
      }
    }),
  )
}

export async function countWarehousesByOrganization(
  db: DB,
  organizationId: string,
  filters: ListWarehousesFilters,
): Promise<number> {
  const conditions: SQL[] = [
    eq(schema.warehouses.organizationId, organizationId),
    isNull(schema.warehouses.deletedAt),
  ]
  if (filters.isActive !== undefined) {
    conditions.push(eq(schema.warehouses.isActive, filters.isActive))
  }
  if (filters.search) {
    const pattern = `%${filters.search}%`
    conditions.push(ilike(schema.warehouses.name, pattern)!)
  }
  const result = await db
    .select({ value: count() })
    .from(schema.warehouses)
    .where(and(...conditions))
  return result[0]?.value ?? 0
}

export async function countWarehousesByBranch(
  db: DB,
  branchId: string,
  filters: ListWarehousesFilters,
): Promise<number> {
  const conditions: SQL[] = [
    eq(schema.warehouseBranches.branchId, branchId),
    isNull(schema.warehouses.deletedAt),
  ]
  if (filters.isActive !== undefined) {
    conditions.push(eq(schema.warehouses.isActive, filters.isActive))
  }
  if (filters.search) {
    const pattern = `%${filters.search}%`
    conditions.push(ilike(schema.warehouses.name, pattern)!)
  }
  const result = await db
    .select({ value: count() })
    .from(schema.warehouses)
    .innerJoin(
      schema.warehouseBranches,
      eq(schema.warehouseBranches.warehouseId, schema.warehouses.id),
    )
    .where(and(...conditions))
  return result[0]?.value ?? 0
}

export async function findActiveWarehouseByNameInOrganization(
  db: DB,
  organizationId: string,
  name: string,
  excludeId?: string,
): Promise<{ id: string } | null> {
  const conditions = [
    eq(schema.warehouses.organizationId, organizationId),
    eq(schema.warehouses.name, name),
    isNull(schema.warehouses.deletedAt),
  ]
  if (excludeId) conditions.push(ne(schema.warehouses.id, excludeId))
  const result = await db
    .select({ id: schema.warehouses.id })
    .from(schema.warehouses)
    .where(and(...conditions))
    .limit(1)
  return result[0] ?? null
}

export async function findBranchByIdRaw(db: DB, id: string) {
  const result = await db
    .select()
    .from(schema.branches)
    .where(and(eq(schema.branches.id, id), isNull(schema.branches.deletedAt)))
    .limit(1)
  return result[0] ?? null
}

export async function createWarehouse(
  db: DB,
  data: typeof schema.warehouses.$inferInsert,
) {
  const result = await db.insert(schema.warehouses).values(data).returning()
  return result[0]
}

export async function updateWarehouse(
  db: DB,
  id: string,
  data: Partial<typeof schema.warehouses.$inferInsert>,
) {
  const result = await db
    .update(schema.warehouses)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(schema.warehouses.id, id), isNull(schema.warehouses.deletedAt)))
    .returning()
  return result[0] ?? null
}

export async function softDeleteWarehouse(db: DB, id: string) {
  const result = await db
    .update(schema.warehouses)
    .set({ deletedAt: new Date(), isActive: false, updatedAt: new Date() })
    .where(and(eq(schema.warehouses.id, id), isNull(schema.warehouses.deletedAt)))
    .returning({ id: schema.warehouses.id })
  return result[0] ?? null
}

export async function findWarehouseBranchAssignment(
  db: DB,
  warehouseId: string,
  branchId: string,
): Promise<{ warehouseId: string; branchId: string } | null> {
  const result = await db
    .select({
      warehouseId: schema.warehouseBranches.warehouseId,
      branchId: schema.warehouseBranches.branchId,
    })
    .from(schema.warehouseBranches)
    .where(
      and(
        eq(schema.warehouseBranches.warehouseId, warehouseId),
        eq(schema.warehouseBranches.branchId, branchId),
      ),
    )
    .limit(1)
  return result[0] ?? null
}

export async function assignWarehouseToBranch(
  db: DB,
  warehouseId: string,
  branchId: string,
) {
  const result = await db
    .insert(schema.warehouseBranches)
    .values({ warehouseId, branchId })
    .returning({ warehouseId: schema.warehouseBranches.warehouseId })
  return result[0] ?? null
}

export async function unassignWarehouseFromBranch(
  db: DB,
  warehouseId: string,
  branchId: string,
) {
  await db
    .delete(schema.warehouseBranches)
    .where(
      and(
        eq(schema.warehouseBranches.warehouseId, warehouseId),
        eq(schema.warehouseBranches.branchId, branchId),
      ),
    )
}

export async function countWarehouseItemStocksGreaterThanZero(
  db: DB,
  warehouseId: string,
): Promise<number> {
  const rows = await db
    .select({ quantity: schema.warehouseItemStocks.quantity })
    .from(schema.warehouseItemStocks)
    .where(eq(schema.warehouseItemStocks.warehouseId, warehouseId))
  return rows.filter((r) => Number(r.quantity) > 0).length
}

export async function findItemWarehouseStock(
  db: DB,
  itemId: string,
  warehouseId: string,
) {
  const result = await db
    .select()
    .from(schema.warehouseItemStocks)
    .where(
      and(
        eq(schema.warehouseItemStocks.itemId, itemId),
        eq(schema.warehouseItemStocks.warehouseId, warehouseId),
      ),
    )
    .limit(1)
  return result[0] ?? null
}

export type ListStockFilters = {
  search?: string
  status?: 'low' | 'ok' | 'out'
}

export async function findItemWarehouseStocksByWarehouse(
  db: DB,
  warehouseId: string,
  filters: ListStockFilters,
  limit: number,
  offset: number,
) {
  const conditions: SQL[] = [
    eq(schema.warehouseItemStocks.warehouseId, warehouseId),
    isNull(schema.items.deletedAt),
  ]
  if (filters.search) {
    const pattern = `%${filters.search}%`
    conditions.push(
      or(ilike(schema.items.name, pattern), ilike(schema.items.code, pattern))!,
    )
  }

  const rows = await db
    .select({
      id: schema.warehouseItemStocks.id,
      itemId: schema.items.id,
      itemName: schema.items.name,
      itemCode: schema.items.code,
      unitType: schema.units.unitType,
      quantity: schema.warehouseItemStocks.quantity,
      minStock: schema.warehouseItemStocks.minStock,
    })
    .from(schema.warehouseItemStocks)
    .innerJoin(schema.items, eq(schema.items.id, schema.warehouseItemStocks.itemId))
    .leftJoin(schema.units, eq(schema.units.id, schema.items.baseUnitId))
    .where(and(...conditions))
    .orderBy(schema.items.name)
    .limit(limit)
    .offset(offset)

  // Filter by status in app because computing status requires numeric comparison
  // that varies per row. Also handle offset properly: we filter then re-paginate
  // by doing the filter on the full result is inefficient. For Phase 1 we keep
  // it simple: we apply status filter in JS, which means we may return fewer
  // than `limit` rows. The pagination meta is computed separately.
  const allRows = rows
    .map((r) => ({
      ...r,
      status: computeStockStatus(r.quantity, r.minStock),
    }))
    .filter((r) => (filters.status ? r.status === filters.status : true))

  return allRows.slice(offset, offset + limit)
}

export async function countItemWarehouseStocksByWarehouse(
  db: DB,
  warehouseId: string,
  filters: ListStockFilters,
): Promise<number> {
  const conditions: SQL[] = [
    eq(schema.warehouseItemStocks.warehouseId, warehouseId),
    isNull(schema.items.deletedAt),
  ]
  if (filters.search) {
    const pattern = `%${filters.search}%`
    conditions.push(
      or(ilike(schema.items.name, pattern), ilike(schema.items.code, pattern))!,
    )
  }

  const rows = await db
    .select({
      quantity: schema.warehouseItemStocks.quantity,
      minStock: schema.warehouseItemStocks.minStock,
    })
    .from(schema.warehouseItemStocks)
    .innerJoin(schema.items, eq(schema.items.id, schema.warehouseItemStocks.itemId))
    .where(and(...conditions))

  if (!filters.status) return rows.length
  return rows.filter((r) => computeStockStatus(r.quantity, r.minStock) === filters.status).length
}

export async function findItemWarehouseStocksByItem(db: DB, itemId: string) {
  const rows = await db
    .select({
      id: schema.warehouseItemStocks.id,
      warehouseId: schema.warehouses.id,
      warehouseName: schema.warehouses.name,
      unitType: schema.units.unitType,
      quantity: schema.warehouseItemStocks.quantity,
      minStock: schema.warehouseItemStocks.minStock,
    })
    .from(schema.warehouseItemStocks)
    .innerJoin(schema.warehouses, eq(schema.warehouses.id, schema.warehouseItemStocks.warehouseId))
    .leftJoin(schema.items, eq(schema.items.id, schema.warehouseItemStocks.itemId))
    .leftJoin(schema.units, eq(schema.units.id, schema.items.baseUnitId))
    .where(
      and(
        eq(schema.warehouseItemStocks.itemId, itemId),
        isNull(schema.warehouses.deletedAt),
      ),
    )
  return rows.map((r) => ({
    ...r,
    status: computeStockStatus(r.quantity, r.minStock),
  }))
}

export function computeStockStatus(
  quantity: string,
  minStock: string,
): 'out' | 'low' | 'ok' {
  const q = Number(quantity)
  const m = Number(minStock)
  if (q === 0) return 'out'
  if (q < m) return 'low'
  return 'ok'
}

export async function upsertItemWarehouseStock(
  db: DB,
  itemId: string,
  warehouseId: string,
  data: { quantity: string; minStock?: string },
) {
  const existing = await findItemWarehouseStock(db, itemId, warehouseId)
  if (existing) {
    const result = await db
      .update(schema.warehouseItemStocks)
      .set({
        quantity: data.quantity,
        ...(data.minStock !== undefined ? { minStock: data.minStock } : {}),
        updatedAt: new Date(),
      })
      .where(eq(schema.warehouseItemStocks.id, existing.id))
      .returning()
    return result[0]
  }
  const result = await db
    .insert(schema.warehouseItemStocks)
    .values({
      itemId,
      warehouseId,
      quantity: data.quantity,
      minStock: data.minStock ?? '0',
    })
    .returning()
  return result[0]
}

export async function updateMinStockForItem(db: DB, itemId: string, minStock: string) {
  await db
    .update(schema.warehouseItemStocks)
    .set({ minStock, updatedAt: new Date() })
    .where(eq(schema.warehouseItemStocks.itemId, itemId))
}

export async function findStockQuantitiesGreaterThanZero(
  db: DB,
  warehouseId: string,
): Promise<{ itemId: string; quantity: string }[]> {
  const rows = await db
    .select({
      itemId: schema.warehouseItemStocks.itemId,
      quantity: schema.warehouseItemStocks.quantity,
    })
    .from(schema.warehouseItemStocks)
    .where(eq(schema.warehouseItemStocks.warehouseId, warehouseId))
  return rows.filter((r) => Number(r.quantity) > 0)
}
