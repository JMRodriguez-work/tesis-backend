import { and, count, eq, ilike, inArray, isNull, ne, or, sql, sum, type SQL } from 'drizzle-orm'
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

export type ItemBaseUnitInfo = {
  unitType: string;
  unitName: string;
  unitAbbreviation: string;
};

export async function findItemBaseUnit(
  db: DB,
  itemId: string,
): Promise<ItemBaseUnitInfo | null> {
  const result = await db
    .select({
      unitType: schema.units.unitType,
      unitName: schema.units.name,
      unitAbbreviation: schema.units.abbreviation,
    })
    .from(schema.items)
    .innerJoin(schema.units, eq(schema.units.id, schema.items.baseUnitId))
    .where(eq(schema.items.id, itemId))
    .limit(1)
  const row = result[0]
  if (!row) return null
  return {
    unitType: row.unitType,
    unitName: row.unitName,
    unitAbbreviation: row.unitAbbreviation,
  }
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
        eq(schema.items.isActive, true),
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

export type ItemsWithStockFilters = {
  branchId: string;
  page: number;
  limit: number;
  search?: string;
  status?: 'out' | 'low' | 'ok';
  showInactive: boolean;
};

export type ItemStockRow = {
  id: string;
  name: string;
  code: string | null;
  isActive: boolean;
  category: { id: string; name: string } | null;
  totalQuantity: string;
  totalMinStock: string;
  status: 'out' | 'low' | 'ok';
  warehouses: Array<{
    warehouseId: string;
    warehouseName: string;
    quantity: string;
    minStock: string;
    status: 'out' | 'low' | 'ok';
  }>;
};

/**
 * List items in a branch with their aggregated stock across all warehouses
 * assigned to that branch, plus per-warehouse breakdown.
 *
 * Pagination, search and status filter are applied SQL-side. The status
 * filter is computed by deriving a `stock_status` from the aggregate
 * (out = no stock at all; low = below min_stock total; ok = at/above).
 */
export async function findItemsWithStockByBranch(
  db: DB,
  filters: ItemsWithStockFilters,
): Promise<{ data: ItemStockRow[]; total: number }> {
  const conditions: SQL[] = [
    eq(schema.items.branchId, filters.branchId),
    isNull(schema.items.deletedAt),
  ];
  if (!filters.showInactive) {
    conditions.push(eq(schema.items.isActive, true));
  }
  if (filters.search) {
    const term = `%${filters.search}%`;
    const searchCondition = or(
      ilike(schema.items.name, term),
      ilike(schema.items.code, term),
      ilike(schema.items.barcode, term),
    );
    if (searchCondition) {
      conditions.push(searchCondition);
    }
  }

  // Subquery: per-item aggregated stock (sum of quantity and minStock
  // across all warehouses). The CASE expression computes a status code
  // we can use for SQL-side filtering: 0 = out, 1 = low, 2 = ok.
  const stockAggSubquery = db
    .select({
      itemId: schema.warehouseItemStocks.itemId,
      totalQuantity: sql<string>`COALESCE(SUM(${schema.warehouseItemStocks.quantity}::numeric), 0)::text`.as(
        'total_quantity',
      ),
      totalMinStock: sql<string>`COALESCE(SUM(${schema.warehouseItemStocks.minStock}::numeric), 0)::text`.as(
        'total_min_stock',
      ),
      statusCode: sql<number>`CASE
        WHEN COALESCE(SUM(${schema.warehouseItemStocks.quantity}::numeric), 0) = 0 THEN 0
        WHEN COALESCE(SUM(${schema.warehouseItemStocks.minStock}::numeric), 0) > 0
          AND COALESCE(SUM(${schema.warehouseItemStocks.quantity}::numeric), 0)
            < COALESCE(SUM(${schema.warehouseItemStocks.minStock}::numeric), 0) THEN 1
        ELSE 2
      END`.as('status_code'),
    })
    .from(schema.warehouseItemStocks)
    .groupBy(schema.warehouseItemStocks.itemId)
    .as('stock_agg');

  const statusToCode: Record<'out' | 'low' | 'ok', number> = {
    out: 0,
    low: 1,
    ok: 2,
  };

  const totalResult = await db
    .select({
      value: count(),
    })
    .from(schema.items)
    .leftJoin(stockAggSubquery, eq(stockAggSubquery.itemId, schema.items.id))
    .where(
      filters.status
        ? and(
            ...conditions,
            eq(stockAggSubquery.statusCode, statusToCode[filters.status]),
          )
        : and(...conditions),
    );
  const total = Number(totalResult[0]?.value ?? 0);

  const offset = (filters.page - 1) * filters.limit;
  const rows = await db
    .select({
      id: schema.items.id,
      name: schema.items.name,
      code: schema.items.code,
      isActive: schema.items.isActive,
      unitType: schema.units.unitType,
      categoryId: schema.items.categoryId,
      categoryName: schema.itemCategories.name,
      totalQuantity: stockAggSubquery.totalQuantity,
      totalMinStock: stockAggSubquery.totalMinStock,
      statusCode: stockAggSubquery.statusCode,
    })
    .from(schema.items)
    .leftJoin(stockAggSubquery, eq(stockAggSubquery.itemId, schema.items.id))
    .leftJoin(
      schema.itemCategories,
      eq(schema.itemCategories.id, schema.items.categoryId),
    )
    .leftJoin(schema.units, eq(schema.units.id, schema.items.baseUnitId))
    .where(
      filters.status
        ? and(
            ...conditions,
            eq(stockAggSubquery.statusCode, statusToCode[filters.status]),
          )
        : and(...conditions),
    )
    .orderBy(schema.items.name)
    .limit(filters.limit)
    .offset(offset);

  if (rows.length === 0) {
    return { data: [], total };
  }

  const itemIds = rows.map((r) => r.id);
  const stockRows = await db
    .select({
      itemId: schema.warehouseItemStocks.itemId,
      warehouseId: schema.warehouses.id,
      warehouseName: schema.warehouses.name,
      quantity: schema.warehouseItemStocks.quantity,
      minStock: schema.warehouseItemStocks.minStock,
    })
    .from(schema.warehouseItemStocks)
    .innerJoin(
      schema.warehouses,
      eq(schema.warehouses.id, schema.warehouseItemStocks.warehouseId),
    )
    .where(
      and(
        inArray(schema.warehouseItemStocks.itemId, itemIds),
        isNull(schema.warehouses.deletedAt),
      ),
    )
    .orderBy(schema.warehouses.name);

  const stockByItem = new Map<
    string,
    Array<{
      warehouseId: string;
      warehouseName: string;
      quantity: string;
      minStock: string;
      status: 'out' | 'low' | 'ok';
    }>
  >();
  for (const s of stockRows) {
    const q = Number(s.quantity);
    const m = Number(s.minStock);
    const status: 'out' | 'low' | 'ok' =
      q === 0 ? 'out' : m > 0 && q < m ? 'low' : 'ok';
    const list = stockByItem.get(s.itemId) ?? [];
    list.push({
      warehouseId: s.warehouseId,
      warehouseName: s.warehouseName,
      quantity: s.quantity,
      minStock: s.minStock,
      status,
    });
    stockByItem.set(s.itemId, list);
  }

  const codeToStatus: Record<number, 'out' | 'low' | 'ok'> = {
    0: 'out',
    1: 'low',
    2: 'ok',
  };

  const data: ItemStockRow[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    code: r.code,
    isActive: r.isActive,
    unitType: r.unitType ?? null,
    category:
      r.categoryId && r.categoryName
        ? { id: r.categoryId, name: r.categoryName }
        : null,
    totalQuantity: r.totalQuantity ?? '0',
    totalMinStock: r.totalMinStock ?? '0',
    status: codeToStatus[r.statusCode ?? 2] ?? 'ok',
    warehouses: stockByItem.get(r.id) ?? [],
  }));

  return { data, total };
}
