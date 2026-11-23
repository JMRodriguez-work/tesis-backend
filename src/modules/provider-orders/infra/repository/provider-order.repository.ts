import { and, count, desc, eq, gte, inArray, isNull, lte, ne, type SQL } from 'drizzle-orm'
import type { DB } from '../../../../shared/db'
import * as schema from '../../../../shared/db/schema'
import type {
  ProviderOrderItemWithItem,
  ProviderOrderListRow,
  ProviderOrderStatus,
  ProviderOrderWithRelations,
} from '../../domain/provider-order.entity'

export const providerOrderTable = schema.providerOrders
export const providerOrderItemTable = schema.providerOrderItems

export type LastOrderItemCostRow = {
  cost: string
  orderCreatedAt: Date
}

/**
 * Último costo cargado para un item en una orden a proveedor no cancelada
 * (la más reciente por fecha de creación). Es el ancla de la sugerencia de
 * costo ajustada por la variación del índice mayorista del INDEC: si no hay
 * órdenes, el caller cae al precio de compra de la ficha del producto.
 */
export async function findLastOrderItemCostByItemId(
  db: DB,
  itemId: string,
): Promise<LastOrderItemCostRow | null> {
  const rows = await db
    .select({
      cost: providerOrderItemTable.cost,
      orderCreatedAt: providerOrderTable.createdAt,
    })
    .from(providerOrderItemTable)
    .innerJoin(providerOrderTable, eq(providerOrderTable.id, providerOrderItemTable.orderId))
    .where(
      and(
        eq(providerOrderItemTable.itemId, itemId),
        ne(providerOrderTable.status, 'cancelled'),
      ),
    )
    .orderBy(desc(providerOrderTable.createdAt))
    .limit(1)
  const row = rows[0]
  if (!row) return null
  return { cost: row.cost, orderCreatedAt: row.orderCreatedAt }
}

export type ListProviderOrdersFilters = {
  branchId: string | null
  providerId?: string
  status?: ProviderOrderStatus
  from?: Date
  to?: Date
}

export async function findProviderOrderByIdRaw(db: DB, id: string) {
  const result = await db
    .select()
    .from(providerOrderTable)
    .where(eq(providerOrderTable.id, id))
    .limit(1)
  return result[0] ?? null
}

export async function findProviderOrderById(
  db: DB,
  id: string,
): Promise<ProviderOrderWithRelations | null> {
  const rows = await db
    .select({
      orderId: providerOrderTable.id,
      branchId: providerOrderTable.branchId,
      branchName: schema.branches.name,
      providerId: providerOrderTable.providerId,
      providerName: schema.providers.name,
      createdBy: providerOrderTable.createdBy,
      creatorName: schema.user.name,
      creatorEmail: schema.user.email,
      status: providerOrderTable.status,
      total: providerOrderTable.total,
      estimatedDelivery: providerOrderTable.estimatedDelivery,
      createdAt: providerOrderTable.createdAt,
    })
    .from(providerOrderTable)
    .innerJoin(schema.branches, eq(schema.branches.id, providerOrderTable.branchId))
    .innerJoin(schema.providers, eq(schema.providers.id, providerOrderTable.providerId))
    .innerJoin(schema.user, eq(schema.user.id, providerOrderTable.createdBy))
    .where(eq(providerOrderTable.id, id))
    .limit(1)

  const row = rows[0]
  if (!row) return null

  const itemsRaw = await db
    .select({
      id: providerOrderItemTable.id,
      itemId: providerOrderItemTable.itemId,
      unitId: providerOrderItemTable.unitId,
      quantity: providerOrderItemTable.quantity,
      cost: providerOrderItemTable.cost,
      itemName: schema.items.name,
      itemCode: schema.items.code,
      unitType: schema.units.unitType,
      unitAbbreviation: schema.units.abbreviation,
    })
    .from(providerOrderItemTable)
    .innerJoin(schema.items, eq(schema.items.id, providerOrderItemTable.itemId))
    .leftJoin(schema.units, eq(schema.units.id, providerOrderItemTable.unitId))
    .where(eq(providerOrderItemTable.orderId, id))

  const items: ProviderOrderItemWithItem[] = itemsRaw.map((it) => ({
    id: it.id,
    itemId: it.itemId,
    itemName: it.itemName,
    itemCode: it.itemCode,
    unitId: it.unitId,
    unitType:
      it.unitType === 'count' || it.unitType === 'weight' || it.unitType === 'volume'
        ? it.unitType
        : null,
    unitAbbreviation: it.unitAbbreviation ?? null,
    quantity: it.quantity,
    cost: it.cost,
    lineTotal: round2(Number(it.cost) * Number(it.quantity)),
  }))

  return {
    id: row.orderId,
    branchId: row.branchId,
    branch: { id: row.branchId, name: row.branchName ?? '' },
    provider: { id: row.providerId, name: row.providerName ?? '' },
    createdBy: {
      id: row.createdBy,
      name: row.creatorName ?? '',
      email: row.creatorEmail ?? '',
    },
    status: row.status as ProviderOrderStatus,
    total: row.total,
    estimatedDelivery: row.estimatedDelivery,
    items,
    createdAt: row.createdAt,
  }
}

function round2(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2)
}

function buildConditions(
  filters: ListProviderOrdersFilters,
  organizationId: string,
): SQL[] {
  const conditions: SQL[] = [eq(schema.branches.organizationId, organizationId)]
  if (filters.branchId) {
    conditions.push(eq(providerOrderTable.branchId, filters.branchId))
  }
  if (filters.providerId) {
    conditions.push(eq(providerOrderTable.providerId, filters.providerId))
  }
  if (filters.status) {
    conditions.push(eq(providerOrderTable.status, filters.status))
  }
  if (filters.from) {
    conditions.push(gte(providerOrderTable.createdAt, filters.from))
  }
  if (filters.to) {
    conditions.push(lte(providerOrderTable.createdAt, filters.to))
  }
  return conditions
}

export async function findProviderOrdersPaginated(
  db: DB,
  organizationId: string,
  filters: ListProviderOrdersFilters,
  limit: number,
  offset: number,
): Promise<ProviderOrderListRow[]> {
  const rows = await db
    .select({
      id: providerOrderTable.id,
      branchId: providerOrderTable.branchId,
      branchName: schema.branches.name,
      providerId: providerOrderTable.providerId,
      providerName: schema.providers.name,
      status: providerOrderTable.status,
      total: providerOrderTable.total,
      estimatedDelivery: providerOrderTable.estimatedDelivery,
      createdAt: providerOrderTable.createdAt,
    })
    .from(providerOrderTable)
    .innerJoin(schema.branches, eq(schema.branches.id, providerOrderTable.branchId))
    .innerJoin(schema.providers, eq(schema.providers.id, providerOrderTable.providerId))
    .where(and(...buildConditions(filters, organizationId)))
    .orderBy(desc(providerOrderTable.createdAt))
    .limit(limit)
    .offset(offset)

  if (rows.length === 0) return []

  const orderIds = rows.map((r) => r.id)
  const itemCounts = await db
    .select({ orderId: providerOrderItemTable.orderId, c: count() })
    .from(providerOrderItemTable)
    .where(inArray(providerOrderItemTable.orderId, orderIds))
    .groupBy(providerOrderItemTable.orderId)
  const countMap = new Map(itemCounts.map((r) => [r.orderId, r.c]))

  return rows.map((r) => ({
    id: r.id,
    branchId: r.branchId,
    branchName: r.branchName ?? '',
    providerId: r.providerId,
    providerName: r.providerName ?? '',
    status: r.status as ProviderOrderStatus,
    total: r.total,
    itemCount: countMap.get(r.id) ?? 0,
    estimatedDelivery: r.estimatedDelivery,
    createdAt: r.createdAt,
  }))
}

export async function countProviderOrders(
  db: DB,
  organizationId: string,
  filters: ListProviderOrdersFilters,
): Promise<number> {
  const result = await db
    .select({ value: count() })
    .from(providerOrderTable)
    .innerJoin(schema.branches, eq(schema.branches.id, providerOrderTable.branchId))
    .where(and(...buildConditions(filters, organizationId)))
  return result[0]?.value ?? 0
}

export async function createProviderOrder(
  db: DB,
  data: typeof schema.providerOrders.$inferInsert,
) {
  const result = await db.insert(providerOrderTable).values(data).returning()
  return result[0]
}

export async function createProviderOrderItems(
  db: DB,
  data: Array<typeof schema.providerOrderItems.$inferInsert>,
) {
  if (data.length === 0) return []
  return db.insert(providerOrderItemTable).values(data).returning()
}

export async function updateProviderOrderFields(
  db: DB,
  id: string,
  data: Partial<typeof schema.providerOrders.$inferInsert>,
) {
  const result = await db
    .update(providerOrderTable)
    .set(data)
    .where(eq(providerOrderTable.id, id))
    .returning()
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

export async function findProviderByIdRaw(db: DB, id: string) {
  const result = await db
    .select()
    .from(schema.providers)
    .where(and(eq(schema.providers.id, id), isNull(schema.providers.deletedAt)))
    .limit(1)
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

export async function findWarehouseByIdRaw(db: DB, id: string) {
  const result = await db
    .select()
    .from(schema.warehouses)
    .where(eq(schema.warehouses.id, id))
    .limit(1)
  return result[0] ?? null
}
