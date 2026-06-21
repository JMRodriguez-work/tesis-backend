import { and, count, desc, eq, gte, inArray, isNull, lte, type SQL } from 'drizzle-orm'
import type { DB } from '../../../../shared/db'
import * as schema from '../../../../shared/db/schema'
import type {
  CustomerPurchaseSummary,
  SaleExportRow,
  SaleItemWithItem,
  SaleListRow,
  SaleStatus,
  SaleWithRelations,
} from '../../domain/sale.entity'

export const saleTable = schema.sales
export const saleItemTable = schema.saleItems
export const stockMovementTable = schema.stockMovements
export const warehouseItemStockTable = schema.warehouseItemStocks
export const warehouseBranchesTable = schema.warehouseBranches

export function saleIdEq(id: string) {
  return eq(saleTable.id, id)
}

export function computeSaleStatus(isActive: boolean, deletedAt: Date | null): SaleStatus {
  return isActive && deletedAt === null ? 'active' : 'cancelled'
}

function round2(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2)
}

// ─── Read: full sale with relations ─────────────────────────────────────────

export async function findSaleByIdRaw(db: DB, id: string) {
  const result = await db
    .select()
    .from(saleTable)
    .where(eq(saleTable.id, id))
    .limit(1)
  return result[0] ?? null
}

export async function findSaleItemsRawBySaleId(db: DB, saleId: string) {
  return db.select().from(saleItemTable).where(eq(saleItemTable.saleId, saleId))
}

export async function findSaleById(db: DB, id: string): Promise<SaleWithRelations | null> {
  const rows = await db
    .select({
      saleId: saleTable.id,
      branchId: saleTable.branchId,
      customerId: saleTable.customerId,
      createdBy: saleTable.createdBy,
      total: saleTable.total,
      discountPercent: saleTable.discountPercent,
      notes: saleTable.notes,
      isActive: saleTable.isActive,
      cancellationReason: saleTable.cancellationReason,
      createdAt: saleTable.createdAt,
      deletedAt: saleTable.deletedAt,
      branchName: schema.branches.name,
      customerFullname: schema.customers.fullname,
      customerEmail: schema.customers.email,
      customerPhone: schema.customers.phone,
      creatorName: schema.user.name,
      creatorEmail: schema.user.email,
    })
    .from(saleTable)
    .leftJoin(schema.branches, eq(schema.branches.id, saleTable.branchId))
    .leftJoin(schema.customers, eq(schema.customers.id, saleTable.customerId))
    .innerJoin(schema.user, eq(schema.user.id, saleTable.createdBy))
    .where(eq(saleTable.id, id))
    .limit(1)

  const row = rows[0]
  if (!row) return null

  const itemsRaw = await db
    .select({
      id: saleItemTable.id,
      itemId: saleItemTable.itemId,
      unitId: saleItemTable.unitId,
      quantity: saleItemTable.quantity,
      price: saleItemTable.price,
      itemName: schema.items.name,
      itemCode: schema.items.code,
    })
    .from(saleItemTable)
    .innerJoin(schema.items, eq(schema.items.id, saleItemTable.itemId))
    .where(eq(saleItemTable.saleId, id))

  // Recover warehouseId per sale_item from the matching 'out' stock movement.
  // We pair by (itemId, quantity) because the sale is the only place that
  // creates out movements with referenceId=saleId and referenceType='sale'.
  const saleOutMovements = await db
    .select({
      itemId: stockMovementTable.itemId,
      warehouseId: stockMovementTable.fromWarehouseId,
      quantity: stockMovementTable.quantity,
    })
    .from(stockMovementTable)
    .where(
      and(
        eq(stockMovementTable.referenceId, id),
        eq(stockMovementTable.referenceType, 'sale'),
        eq(stockMovementTable.type, 'out'),
      ),
    )

  const movementByItemKey = new Map<string, string>()
  for (const m of saleOutMovements) {
    movementByItemKey.set(`${m.itemId}|${m.quantity}`, m.warehouseId ?? '')
  }

  const warehouseIds = Array.from(new Set(Array.from(movementByItemKey.values())))
  const warehousesMap = new Map<string, string>()
  if (warehouseIds.length > 0) {
    const whs = await db
      .select({ id: schema.warehouses.id, name: schema.warehouses.name })
      .from(schema.warehouses)
      .where(inArray(schema.warehouses.id, warehouseIds))
    for (const w of whs) warehousesMap.set(w.id, w.name)
  }

  const items: SaleItemWithItem[] = itemsRaw.map((it) => {
    const warehouseId = movementByItemKey.get(`${it.itemId}|${it.quantity}`) ?? ''
    const lineTotal = round2(Number(it.price) * Number(it.quantity))
    return {
      id: it.id,
      itemId: it.itemId,
      itemName: it.itemName,
      itemCode: it.itemCode,
      unitId: it.unitId,
      warehouseId,
      warehouseName: warehousesMap.get(warehouseId) ?? '',
      quantity: it.quantity,
      price: it.price,
      lineTotal,
    }
  })

  const subtotal = round2(items.reduce((acc, it) => acc + Number(it.lineTotal), 0))

  return {
    id: row.saleId,
    branchId: row.branchId,
    branch: { id: row.branchId, name: row.branchName ?? '' },
    customer: row.customerId
      ? {
          id: row.customerId,
          fullname: row.customerFullname ?? '',
          email: row.customerEmail ?? null,
          phone: row.customerPhone ?? null,
        }
      : null,
    createdBy: {
      id: row.createdBy,
      name: row.creatorName ?? '',
      email: row.creatorEmail ?? '',
    },
    total: row.total,
    discountPercent: row.discountPercent,
    subtotal,
    notes: row.notes,
    isActive: row.isActive,
    status: computeSaleStatus(row.isActive, row.deletedAt),
    cancellationReason: row.cancellationReason,
    items,
    createdAt: row.createdAt,
    deletedAt: row.deletedAt,
  }
}

// ─── Read: paginated list ───────────────────────────────────────────────────

export type ListSalesFilters = {
  branchId: string | null
  customerId?: string
  from?: Date
  to?: Date
  includeCancelled: boolean
}

function buildSalesConditions(filters: ListSalesFilters, organizationId: string): SQL[] {
  const conditions: SQL[] = [
    eq(schema.branches.organizationId, organizationId),
    isNull(saleTable.deletedAt),
  ]
  if (filters.branchId) {
    conditions.push(eq(saleTable.branchId, filters.branchId))
  }
  if (filters.customerId) {
    conditions.push(eq(saleTable.customerId, filters.customerId))
  }
  if (filters.from) {
    conditions.push(gte(saleTable.createdAt, filters.from))
  }
  if (filters.to) {
    conditions.push(lte(saleTable.createdAt, filters.to))
  }
  if (!filters.includeCancelled) {
    conditions.push(eq(saleTable.isActive, true))
  }
  return conditions
}

export async function findSalesPaginated(
  db: DB,
  organizationId: string,
  filters: ListSalesFilters,
  limit: number,
  offset: number,
): Promise<SaleListRow[]> {
  const rows = await db
    .select({
      id: saleTable.id,
      branchId: saleTable.branchId,
      branchName: schema.branches.name,
      customerId: saleTable.customerId,
      customerName: schema.customers.fullname,
      total: saleTable.total,
      discountPercent: saleTable.discountPercent,
      isActive: saleTable.isActive,
      createdAt: saleTable.createdAt,
      deletedAt: saleTable.deletedAt,
    })
    .from(saleTable)
    .innerJoin(schema.branches, eq(schema.branches.id, saleTable.branchId))
    .leftJoin(schema.customers, eq(schema.customers.id, saleTable.customerId))
    .where(and(...buildSalesConditions(filters, organizationId)))
    .orderBy(desc(saleTable.createdAt))
    .limit(limit)
    .offset(offset)

  if (rows.length === 0) return []

  const saleIds = rows.map((r) => r.id)
  const itemCounts = await db
    .select({ saleId: saleItemTable.saleId, c: count() })
    .from(saleItemTable)
    .where(inArray(saleItemTable.saleId, saleIds))
    .groupBy(saleItemTable.saleId)
  const countMap = new Map(itemCounts.map((r) => [r.saleId, r.c]))

  return rows.map((r) => ({
    id: r.id,
    branchId: r.branchId,
    branchName: r.branchName ?? '',
    customerId: r.customerId,
    customerName: r.customerName ?? null,
    total: r.total,
    discountPercent: r.discountPercent,
    itemCount: countMap.get(r.id) ?? 0,
    status: computeSaleStatus(r.isActive, r.deletedAt),
    createdAt: r.createdAt,
  }))
}

export async function countSales(
  db: DB,
  organizationId: string,
  filters: ListSalesFilters,
): Promise<number> {
  const result = await db
    .select({ value: count() })
    .from(saleTable)
    .innerJoin(schema.branches, eq(schema.branches.id, saleTable.branchId))
    .where(and(...buildSalesConditions(filters, organizationId)))
  return result[0]?.value ?? 0
}

// ─── Read: export ──────────────────────────────────────────────────────────

export async function findSalesForExport(
  db: DB,
  organizationId: string,
  filters: ListSalesFilters,
  limit: number,
): Promise<SaleExportRow[]> {
  const sales = await db
    .select({
      id: saleTable.id,
      branchName: schema.branches.name,
      customerName: schema.customers.fullname,
      total: saleTable.total,
      discountPercent: saleTable.discountPercent,
      isActive: saleTable.isActive,
      createdAt: saleTable.createdAt,
      deletedAt: saleTable.deletedAt,
      creatorName: schema.user.name,
    })
    .from(saleTable)
    .innerJoin(schema.branches, eq(schema.branches.id, saleTable.branchId))
    .leftJoin(schema.customers, eq(schema.customers.id, saleTable.customerId))
    .innerJoin(schema.user, eq(schema.user.id, saleTable.createdBy))
    .where(and(...buildSalesConditions(filters, organizationId)))
    .orderBy(desc(saleTable.createdAt))
    .limit(limit)

  if (sales.length === 0) return []

  const saleIds = sales.map((s) => s.id)
  const items = await db
    .select({
      saleId: saleItemTable.saleId,
      itemId: saleItemTable.itemId,
      itemName: schema.items.name,
      itemCode: schema.items.code,
      quantity: saleItemTable.quantity,
      price: saleItemTable.price,
    })
    .from(saleItemTable)
    .innerJoin(schema.items, eq(schema.items.id, saleItemTable.itemId))
    .where(inArray(saleItemTable.saleId, saleIds))

  const saleMap = new Map(
    sales.map((s) => [
      s.id,
      {
        branchName: s.branchName ?? '',
        customerName: s.customerName ?? null,
        total: s.total,
        discountPercent: s.discountPercent,
        status: computeSaleStatus(s.isActive, s.deletedAt),
        createdAt: s.createdAt,
        creatorName: s.creatorName ?? '',
      },
    ]),
  )

  const rows: SaleExportRow[] = []
  for (const it of items) {
    const sale = saleMap.get(it.saleId)
    if (!sale) continue
    const lineTotal = round2(Number(it.price) * Number(it.quantity))
    rows.push({
      saleId: it.saleId,
      createdAt: sale.createdAt.toISOString(),
      branchName: sale.branchName,
      customerName: sale.customerName,
      itemName: it.itemName,
      itemCode: it.itemCode,
      quantity: it.quantity,
      price: it.price,
      lineTotal,
      discountPercent: sale.discountPercent,
      saleTotal: sale.total,
      status: sale.status,
      createdByName: sale.creatorName,
    })
  }
  return rows
}

// ─── Read: customer history ─────────────────────────────────────────────────

export async function findSalesByCustomer(
  db: DB,
  customerId: string,
  includeCancelled: boolean,
  limit: number,
  offset: number,
): Promise<SaleListRow[]> {
  const conditions: SQL[] = [
    eq(saleTable.customerId, customerId),
    isNull(saleTable.deletedAt),
  ]
  if (!includeCancelled) {
    conditions.push(eq(saleTable.isActive, true))
  }

  const rows = await db
    .select({
      id: saleTable.id,
      branchId: saleTable.branchId,
      branchName: schema.branches.name,
      customerId: saleTable.customerId,
      total: saleTable.total,
      discountPercent: saleTable.discountPercent,
      isActive: saleTable.isActive,
      createdAt: saleTable.createdAt,
      deletedAt: saleTable.deletedAt,
    })
    .from(saleTable)
    .innerJoin(schema.branches, eq(schema.branches.id, saleTable.branchId))
    .where(and(...conditions))
    .orderBy(desc(saleTable.createdAt))
    .limit(limit)
    .offset(offset)

  if (rows.length === 0) return []
  const saleIds = rows.map((r) => r.id)
  const itemCounts = await db
    .select({ saleId: saleItemTable.saleId, c: count() })
    .from(saleItemTable)
    .where(inArray(saleItemTable.saleId, saleIds))
    .groupBy(saleItemTable.saleId)
  const countMap = new Map(itemCounts.map((r) => [r.saleId, r.c]))

  return rows.map((r) => ({
    id: r.id,
    branchId: r.branchId,
    branchName: r.branchName ?? '',
    customerId: r.customerId,
    customerName: null,
    total: r.total,
    discountPercent: r.discountPercent,
    itemCount: countMap.get(r.id) ?? 0,
    status: computeSaleStatus(r.isActive, r.deletedAt),
    createdAt: r.createdAt,
  }))
}

export async function countSalesByCustomer(
  db: DB,
  customerId: string,
  includeCancelled: boolean,
): Promise<number> {
  const conditions: SQL[] = [
    eq(saleTable.customerId, customerId),
    isNull(saleTable.deletedAt),
  ]
  if (!includeCancelled) {
    conditions.push(eq(saleTable.isActive, true))
  }
  const result = await db
    .select({ value: count() })
    .from(saleTable)
    .where(and(...conditions))
  return result[0]?.value ?? 0
}

export async function getCustomerPurchaseSummary(
  db: DB,
  customerId: string,
): Promise<CustomerPurchaseSummary> {
  const rows = await db
    .select({
      total: saleTable.total,
      createdAt: saleTable.createdAt,
    })
    .from(saleTable)
    .where(
      and(
        eq(saleTable.customerId, customerId),
        eq(saleTable.isActive, true),
        isNull(saleTable.deletedAt),
      ),
    )

  if (rows.length === 0) {
    return {
      totalSpent: '0.00',
      purchaseCount: 0,
      lastPurchaseAt: null,
      averageTicket: '0.00',
    }
  }

  const totalSpent = rows.reduce((acc, r) => acc + Number(r.total), 0)
  const lastPurchaseAt = rows.reduce<Date | null>(
    (acc, r) => (acc === null || r.createdAt > acc ? r.createdAt : acc),
    null,
  )
  return {
    totalSpent: round2(totalSpent),
    purchaseCount: rows.length,
    lastPurchaseAt,
    averageTicket: round2(totalSpent / rows.length),
  }
}

// ─── Warehouse / stock helpers ──────────────────────────────────────────────

export async function findWarehouseBranchAssignment(db: DB, warehouseId: string, branchId: string) {
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

export type WarehouseStockRow = {
  stockId: string
  warehouseId: string
  quantity: string
}

/**
 * Returns the stock row for the given item across all warehouses assigned to
 * the given branch, ordered by quantity DESC. Used to auto-pick the warehouse
 * with the highest stock when the client doesn't specify one.
 */
export async function findStockInBranchWarehousesForItem(
  db: DB,
  itemId: string,
  branchId: string,
): Promise<WarehouseStockRow[]> {
  return db
    .select({
      stockId: schema.warehouseItemStocks.id,
      warehouseId: schema.warehouseItemStocks.warehouseId,
      quantity: schema.warehouseItemStocks.quantity,
    })
    .from(schema.warehouseItemStocks)
    .innerJoin(
      schema.warehouseBranches,
      eq(schema.warehouseBranches.warehouseId, schema.warehouseItemStocks.warehouseId),
    )
    .innerJoin(schema.warehouses, eq(schema.warehouses.id, schema.warehouseItemStocks.warehouseId))
    .where(
      and(
        eq(schema.warehouseItemStocks.itemId, itemId),
        eq(schema.warehouseBranches.branchId, branchId),
        isNull(schema.warehouses.deletedAt),
      ),
    )
    .orderBy(desc(schema.warehouseItemStocks.quantity))
}

/**
 * Atomic decrement with a guard. Returns the updated row only if the
 * resulting quantity would be >= 0. If the condition fails (concurrent
 * write, insufficient stock) returns null and the caller should throw 400.
 *
 * Uses raw SQL because Drizzle's typed builder doesn't support
 * `quantity - x` in SET expressions portably.
 */
export async function atomicDecrementStock(
  db: DB,
  stockId: string,
  quantity: string,
): Promise<{ id: string; newQuantity: string } | null> {
  const { sql } = await import('drizzle-orm')
  const result = await db.execute<{ id: string; new_quantity: string }>(sql`
    UPDATE warehouse_item_stocks
    SET quantity = (quantity - ${quantity}::numeric)::numeric(15,3),
        updated_at = NOW()
    WHERE id = ${stockId}::uuid
      AND quantity >= ${quantity}::numeric
    RETURNING id, quantity::text AS new_quantity
  `)
  const row = (result.rows ?? [])[0] as { id: string; new_quantity: string } | undefined
  if (!row) return null
  return { id: row.id, newQuantity: row.new_quantity }
}

/**
 * UPSERT: increments (or creates) the stock row for (item, warehouse).
 * Used during sale cancellation to restore stock.
 */
export async function upsertIncrementStock(
  db: DB,
  itemId: string,
  warehouseId: string,
  quantity: string,
): Promise<{ id: string; quantity: string }> {
  const { sql } = await import('drizzle-orm')
  const result = await db.execute<{ id: string; quantity: string }>(sql`
    INSERT INTO warehouse_item_stocks (item_id, warehouse_id, quantity, min_stock, created_at, updated_at)
    VALUES (${itemId}::uuid, ${warehouseId}::uuid, ${quantity}::numeric, 0, NOW(), NOW())
    ON CONFLICT (item_id, warehouse_id) DO UPDATE
      SET quantity = (warehouse_item_stocks.quantity + ${quantity}::numeric)::numeric(15,3),
          updated_at = NOW()
    RETURNING id, quantity::text AS quantity
  `)
  const row = (result.rows as { id: string; quantity: string }[])[0]
  if (!row) throw new Error('upsertIncrementStock returned no row')
  return row
}

// ─── Writes ─────────────────────────────────────────────────────────────────

export async function createSale(
  db: DB,
  data: typeof schema.sales.$inferInsert,
) {
  const result = await db.insert(saleTable).values(data).returning()
  return result[0]
}

export async function createSaleItems(
  db: DB,
  data: Array<typeof schema.saleItems.$inferInsert>,
) {
  if (data.length === 0) return []
  return db.insert(saleItemTable).values(data).returning()
}

export async function createStockMovement(
  db: DB,
  data: typeof schema.stockMovements.$inferInsert,
) {
  const result = await db.insert(stockMovementTable).values(data).returning()
  return result[0]
}

export async function softDeleteSale(db: DB, id: string, reason: string) {
  const result = await db
    .update(saleTable)
    .set({
      isActive: false,
      deletedAt: new Date(),
      cancellationReason: reason,
    })
    .where(eq(saleTable.id, id))
    .returning()
  return result[0] ?? null
}

export async function findItemByIdRaw(db: DB, id: string) {
  const result = await db
    .select()
    .from(schema.items)
    .where(eq(schema.items.id, id))
    .limit(1)
  return result[0] ?? null
}

export async function findCustomerByIdRaw(db: DB, id: string) {
  const result = await db
    .select()
    .from(schema.customers)
    .where(eq(schema.customers.id, id))
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
