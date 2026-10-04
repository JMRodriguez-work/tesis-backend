import { and, count, desc, eq, gte, inArray, isNull, lte, or, type SQL } from 'drizzle-orm'
import type { DB } from '../../../../shared/db'
import * as schema from '../../../../shared/db/schema'
import type {
  LowStockItem,
  StockHistoryRow,
  StockMovementListRow,
  StockMovementType,
  StockMovementWithRelations,
} from '../../domain/stock-movement.entity'

export const stockMovementTable = schema.stockMovements

export type ListStockMovementsFilters = {
  itemId?: string
  type?: StockMovementType
  branchId: string | null
  warehouseId?: string
  referenceType?: string
  referenceId?: string
  from?: Date
  to?: Date
}

function buildConditions(
  filters: ListStockMovementsFilters,
  organizationId: string,
): SQL[] {
  const conditions: SQL[] = [eq(schema.branches.organizationId, organizationId)]
  if (filters.branchId) {
    conditions.push(eq(stockMovementTable.branchId, filters.branchId))
  }
  if (filters.itemId) {
    conditions.push(eq(stockMovementTable.itemId, filters.itemId))
  }
  if (filters.type) {
    conditions.push(eq(stockMovementTable.type, filters.type))
  }
  if (filters.warehouseId) {
    conditions.push(
      or(
        eq(stockMovementTable.fromWarehouseId, filters.warehouseId),
        eq(stockMovementTable.toWarehouseId, filters.warehouseId),
      )!,
    )
  }
  if (filters.referenceType) {
    conditions.push(eq(stockMovementTable.referenceType, filters.referenceType))
  }
  if (filters.referenceId) {
    conditions.push(eq(stockMovementTable.referenceId, filters.referenceId))
  }
  if (filters.from) {
    conditions.push(gte(stockMovementTable.createdAt, filters.from))
  }
  if (filters.to) {
    conditions.push(lte(stockMovementTable.createdAt, filters.to))
  }
  return conditions
}

function rowToListRow(r: {
  id: string
  itemId: string
  itemName: string | null
  itemCode: string | null
  branchId: string
  branchName: string | null
  fromWarehouseId: string | null
  fromWarehouseName: string | null
  toWarehouseId: string | null
  toWarehouseName: string | null
  type: string
  quantity: string
  referenceType: string | null
  referenceId: string | null
  notes: string | null
  createdAt: Date
}): StockMovementListRow {
  return {
    id: r.id,
    itemId: r.itemId,
    itemName: r.itemName ?? '',
    itemCode: r.itemCode,
    branchId: r.branchId,
    branchName: r.branchName ?? '',
    fromWarehouseId: r.fromWarehouseId,
    fromWarehouseName: r.fromWarehouseName,
    toWarehouseId: r.toWarehouseId,
    toWarehouseName: r.toWarehouseName,
    type: r.type as StockMovementType,
    quantity: r.quantity,
    referenceType: r.referenceType,
    referenceId: r.referenceId,
    notes: r.notes,
    createdAt: r.createdAt,
  }
}

export async function findStockMovementsPaginated(
  db: DB,
  organizationId: string,
  filters: ListStockMovementsFilters,
  limit: number,
  offset: number,
): Promise<StockMovementListRow[]> {
  const rows = await db
    .select({
      id: stockMovementTable.id,
      itemId: stockMovementTable.itemId,
      itemName: schema.items.name,
      itemCode: schema.items.code,
      branchId: stockMovementTable.branchId,
      branchName: schema.branches.name,
      fromWarehouseId: stockMovementTable.fromWarehouseId,
      fromWarehouseName: schema.warehouses.name,
      toWarehouseId: stockMovementTable.toWarehouseId,
      type: stockMovementTable.type,
      quantity: stockMovementTable.quantity,
      referenceType: stockMovementTable.referenceType,
      referenceId: stockMovementTable.referenceId,
      notes: stockMovementTable.notes,
      createdAt: stockMovementTable.createdAt,
    })
    .from(stockMovementTable)
    .innerJoin(schema.branches, eq(schema.branches.id, stockMovementTable.branchId))
    .innerJoin(schema.items, eq(schema.items.id, stockMovementTable.itemId))
    .leftJoin(
      schema.warehouses,
      eq(schema.warehouses.id, stockMovementTable.fromWarehouseId),
    )
    .where(and(...buildConditions(filters, organizationId)))
    .orderBy(desc(stockMovementTable.createdAt))
    .limit(limit)
    .offset(offset)

  if (rows.length === 0) return []

  const toIds = Array.from(
    new Set(
      rows
        .map((r) => r.toWarehouseId)
        .filter((v): v is string => v !== null),
    ),
  )
  const toWarehouses = toIds.length
    ? await db
        .select({ id: schema.warehouses.id, name: schema.warehouses.name })
        .from(schema.warehouses)
        .where(inArray(schema.warehouses.id, toIds))
    : []
  const toMap = new Map(toWarehouses.map((w) => [w.id, w.name]))

  return rows.map((r) =>
    rowToListRow({
      ...r,
      toWarehouseName: r.toWarehouseId ? (toMap.get(r.toWarehouseId) ?? null) : null,
    }),
  )
}

export async function countStockMovements(
  db: DB,
  organizationId: string,
  filters: ListStockMovementsFilters,
): Promise<number> {
  const result = await db
    .select({ value: count() })
    .from(stockMovementTable)
    .innerJoin(schema.branches, eq(schema.branches.id, stockMovementTable.branchId))
    .where(and(...buildConditions(filters, organizationId)))
  return result[0]?.value ?? 0
}

export async function countStockMovementsByWarehouse(
  db: DB,
  organizationId: string,
  warehouseId: string,
  filters: Omit<ListStockMovementsFilters, 'warehouseId' | 'branchId' | 'organizationId'>,
  branchId: string | null,
): Promise<number> {
  const conditions: SQL[] = [
    eq(schema.branches.organizationId, organizationId),
    or(
      eq(stockMovementTable.fromWarehouseId, warehouseId),
      eq(stockMovementTable.toWarehouseId, warehouseId),
    )!,
  ]
  if (branchId) {
    conditions.push(eq(stockMovementTable.branchId, branchId))
  }
  if (filters.itemId) {
    conditions.push(eq(stockMovementTable.itemId, filters.itemId))
  }
  if (filters.type) {
    conditions.push(eq(stockMovementTable.type, filters.type))
  }
  if (filters.referenceType) {
    conditions.push(eq(stockMovementTable.referenceType, filters.referenceType))
  }
  if (filters.referenceId) {
    conditions.push(eq(stockMovementTable.referenceId, filters.referenceId))
  }
  if (filters.from) {
    conditions.push(gte(stockMovementTable.createdAt, filters.from))
  }
  if (filters.to) {
    conditions.push(lte(stockMovementTable.createdAt, filters.to))
  }
  const result = await db
    .select({ value: count() })
    .from(stockMovementTable)
    .innerJoin(schema.branches, eq(schema.branches.id, stockMovementTable.branchId))
    .where(and(...conditions))
  return result[0]?.value ?? 0
}

export async function findStockMovementByIdRaw(db: DB, id: string) {
  const result = await db
    .select()
    .from(stockMovementTable)
    .where(eq(stockMovementTable.id, id))
    .limit(1)
  return result[0] ?? null
}

export async function findStockMovementById(
  db: DB,
  id: string,
): Promise<StockMovementWithRelations | null> {
  const rows = await db
    .select({
      id: stockMovementTable.id,
      itemId: stockMovementTable.itemId,
      itemName: schema.items.name,
      itemCode: schema.items.code,
      branchId: stockMovementTable.branchId,
      branchName: schema.branches.name,
      fromWarehouseId: stockMovementTable.fromWarehouseId,
      toWarehouseId: stockMovementTable.toWarehouseId,
      type: stockMovementTable.type,
      quantity: stockMovementTable.quantity,
      referenceType: stockMovementTable.referenceType,
      referenceId: stockMovementTable.referenceId,
      notes: stockMovementTable.notes,
      createdBy: stockMovementTable.createdBy,
      creatorName: schema.user.name,
      creatorEmail: schema.user.email,
      createdAt: stockMovementTable.createdAt,
    })
    .from(stockMovementTable)
    .innerJoin(schema.branches, eq(schema.branches.id, stockMovementTable.branchId))
    .innerJoin(schema.items, eq(schema.items.id, stockMovementTable.itemId))
    .innerJoin(schema.user, eq(schema.user.id, stockMovementTable.createdBy))
    .where(eq(stockMovementTable.id, id))
    .limit(1)

  const row = rows[0]
  if (!row) return null

  let fromWarehouse: { id: string; name: string } | null = null
  let toWarehouse: { id: string; name: string } | null = null
  const ids = [row.fromWarehouseId, row.toWarehouseId].filter(
    (v): v is string => v !== null,
  )
  if (ids.length > 0) {
    const whs = await db
      .select({ id: schema.warehouses.id, name: schema.warehouses.name })
      .from(schema.warehouses)
      .where(inArray(schema.warehouses.id, ids))
    const whMap = new Map(whs.map((w) => [w.id, w.name]))
    if (row.fromWarehouseId) {
      fromWarehouse = {
        id: row.fromWarehouseId,
        name: whMap.get(row.fromWarehouseId) ?? '',
      }
    }
    if (row.toWarehouseId) {
      toWarehouse = {
        id: row.toWarehouseId,
        name: whMap.get(row.toWarehouseId) ?? '',
      }
    }
  }

  return {
    id: row.id,
    itemId: row.itemId,
    item: { id: row.itemId, name: row.itemName ?? '', code: row.itemCode },
    branchId: row.branchId,
    branch: { id: row.branchId, name: row.branchName ?? '' },
    fromWarehouse,
    toWarehouse,
    type: row.type as StockMovementType,
    quantity: row.quantity,
    referenceType: row.referenceType,
    referenceId: row.referenceId,
    notes: row.notes,
    createdBy: {
      id: row.createdBy,
      name: row.creatorName ?? '',
      email: row.creatorEmail ?? '',
    },
    createdAt: row.createdAt,
  }
}

export type ItemHistoryFilters = {
  itemId: string
  from?: Date
  to?: Date
  warehouseId?: string
}

export async function findItemStockHistory(
  db: DB,
  organizationId: string,
  filters: ItemHistoryFilters,
  limit: number,
  offset: number,
): Promise<StockHistoryRow[]> {
  // We use the paginated find + manually add the runningBalance computed in
  // the use case. The use case is the one that walks the rows and applies
  // the cumulative sum. The repository returns the raw paginated rows.
  const listFilters: ListStockMovementsFilters = {
    itemId: filters.itemId,
    branchId: null,
    warehouseId: filters.warehouseId,
    from: filters.from,
    to: filters.to,
  }
  const rows = await findStockMovementsPaginated(
    db,
    organizationId,
    listFilters,
    limit,
    offset,
  )
  return rows.map((r) => ({ ...r, runningBalance: '0' }))
}

export async function countItemStockHistory(
  db: DB,
  organizationId: string,
  filters: ItemHistoryFilters,
): Promise<number> {
  return countStockMovements(db, organizationId, {
    itemId: filters.itemId,
    branchId: null,
    warehouseId: filters.warehouseId,
    from: filters.from,
    to: filters.to,
  })
}

export async function findLowStockItems(
  db: DB,
  organizationId: string,
  branchId: string | null,
): Promise<LowStockItem[]> {
  const conditions: SQL[] = [
    eq(schema.warehouses.organizationId, organizationId),
    isNull(schema.warehouses.deletedAt),
    isNull(schema.items.deletedAt),
  ]
  if (branchId) {
    conditions.push(eq(schema.warehouseBranches.branchId, branchId))
  }

  const rows = await db
    .select({
      itemId: schema.warehouseItemStocks.itemId,
      itemName: schema.items.name,
      itemCode: schema.items.code,
      unitType: schema.units.unitType,
      warehouseId: schema.warehouses.id,
      warehouseName: schema.warehouses.name,
      branchId: schema.branches.id,
      branchName: schema.branches.name,
      quantity: schema.warehouseItemStocks.quantity,
      minStock: schema.warehouseItemStocks.minStock,
    })
    .from(schema.warehouseItemStocks)
    .innerJoin(schema.items, eq(schema.items.id, schema.warehouseItemStocks.itemId))
    .innerJoin(
      schema.warehouses,
      eq(schema.warehouses.id, schema.warehouseItemStocks.warehouseId),
    )
    .innerJoin(
      schema.warehouseBranches,
      eq(schema.warehouseBranches.warehouseId, schema.warehouses.id),
    )
    .innerJoin(schema.branches, eq(schema.branches.id, schema.warehouseBranches.branchId))
    .leftJoin(schema.units, eq(schema.units.id, schema.items.baseUnitId))
    .where(and(...conditions))

  return rows
    .filter((r) => Number(r.quantity) < Number(r.minStock))
    .map((r) => ({
      itemId: r.itemId,
      itemName: r.itemName,
      itemCode: r.itemCode,
      unitType: (r.unitType ?? null) as LowStockItem['unitType'],
      warehouseId: r.warehouseId,
      warehouseName: r.warehouseName ?? '',
      branchId: r.branchId,
      branchName: r.branchName ?? '',
      quantity: r.quantity,
      minStock: r.minStock,
      deficit: (Number(r.minStock) - Number(r.quantity)).toFixed(3),
      status: (Number(r.quantity) <= 0 ? 'out' : 'low') as LowStockItem['status'],
    }))
}

export async function findStockMovementByReference(
  db: DB,
  referenceId: string,
  referenceType: string,
  type: StockMovementType,
  warehouseColumn: 'from' | 'to',
): Promise<{ warehouseId: string; itemId: string; quantity: string } | null> {
  const column =
    warehouseColumn === 'from'
      ? stockMovementTable.fromWarehouseId
      : stockMovementTable.toWarehouseId
  const result = await db
    .select({
      warehouseId: column,
      itemId: stockMovementTable.itemId,
      quantity: stockMovementTable.quantity,
    })
    .from(stockMovementTable)
    .where(
      and(
        eq(stockMovementTable.referenceId, referenceId),
        eq(stockMovementTable.referenceType, referenceType),
        eq(stockMovementTable.type, type),
      ),
    )
    .limit(1)
  const row = result[0]
  if (!row || !row.warehouseId) return null
  return { warehouseId: row.warehouseId, itemId: row.itemId, quantity: row.quantity }
}

export async function createStockMovement(
  db: DB,
  data: typeof schema.stockMovements.$inferInsert,
) {
  const result = await db.insert(stockMovementTable).values(data).returning()
  return result[0]
}

// Cross-module reads (small, kept here to avoid duplicating in sales/providers)
export async function findItemByIdRaw(db: DB, id: string) {
  const result = await db
    .select()
    .from(schema.items)
    .where(eq(schema.items.id, id))
    .limit(1)
  return result[0] ?? null
}

export async function findBranchByIdRaw(db: DB, id: string) {
  const result = await db
    .select()
    .from(schema.branches)
    .where(eq(schema.branches.id, id))
    .limit(1)
  return result[0] ?? null
}

export async function findWarehouseByIdRaw(db: DB, id: string) {
  const result = await db
    .select()
    .from(schema.warehouses)
    .where(eq(schema.warehouses.id, id))
    .limit(1)
  return result[0] ?? null
}

export async function findWarehouseBranchAssignment(
  db: DB,
  warehouseId: string,
  branchId: string,
) {
  const result = await db
    .select({ warehouseId: schema.warehouseBranches.warehouseId })
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
