import { and, count, eq, gte, isNull, lte, sql, type SQL } from "drizzle-orm";
import type { DB } from "../../../../shared/db";
import * as schema from "../../../../shared/db/schema";
import type {
  ProductRotationRow,
  SalesSummaryBucket,
  UnsoldItem,
} from "../../domain/dashboard.entity";

export type SalesPeriodFilters = {
  organizationId: string;
  branchId: string | null;
  from: Date;
  to: Date;
};

export async function getSalesSummaryForPeriod(
  db: DB,
  filters: SalesPeriodFilters,
): Promise<SalesSummaryBucket> {
  const conditions: SQL[] = [
    eq(schema.branches.organizationId, filters.organizationId),
    isNull(schema.sales.deletedAt),
    eq(schema.sales.isActive, true),
    gte(schema.sales.createdAt, filters.from),
    lte(schema.sales.createdAt, filters.to),
  ];
  if (filters.branchId) {
    conditions.push(eq(schema.sales.branchId, filters.branchId));
  }

  const rows = await db
    .select({
      total: sql<string>`COALESCE(SUM(${schema.sales.total}::numeric), 0)::text`,
      count: count(),
    })
    .from(schema.sales)
    .innerJoin(schema.branches, eq(schema.branches.id, schema.sales.branchId))
    .where(and(...conditions));

  const total = rows[0]?.total ?? "0";
  const transactionCount = Number(rows[0]?.count ?? 0);
  return {
    totalSales: total,
    transactionCount,
    averageTicket:
      transactionCount > 0
        ? (Math.round((Number(total) / transactionCount) * 100) / 100).toFixed(
            2,
          )
        : "0.00",
  };
}

export type ProductRotationFilters = SalesPeriodFilters & {
  categoryId?: string;
};

export async function getProductRotation(
  db: DB,
  filters: ProductRotationFilters,
  limit: number,
  offset: number,
): Promise<ProductRotationRow[]> {
  const conditions: SQL[] = [
    eq(schema.branches.organizationId, filters.organizationId),
    isNull(schema.sales.deletedAt),
    eq(schema.sales.isActive, true),
    gte(schema.sales.createdAt, filters.from),
    lte(schema.sales.createdAt, filters.to),
  ];
  if (filters.branchId) {
    conditions.push(eq(schema.sales.branchId, filters.branchId));
  }

  const rows = await db
    .select({
      itemId: schema.saleItems.itemId,
      itemName: schema.items.name,
      itemCode: schema.items.code,
      categoryId: schema.items.categoryId,
      categoryName: schema.itemCategories.name,
      totalQuantity: sql<string>`COALESCE(SUM(${schema.saleItems.quantity}::numeric), 0)::text`,
      totalRevenue: sql<string>`COALESCE(SUM(${schema.saleItems.price}::numeric * ${schema.saleItems.quantity}::numeric), 0)::text`,
      transactionCount: sql<number>`COUNT(DISTINCT ${schema.sales.id})::int`,
      lastSoldAt: sql<Date | null>`MAX(${schema.sales.createdAt})`,
    })
    .from(schema.saleItems)
    .innerJoin(schema.sales, eq(schema.sales.id, schema.saleItems.saleId))
    .innerJoin(schema.branches, eq(schema.branches.id, schema.sales.branchId))
    .innerJoin(schema.items, eq(schema.items.id, schema.saleItems.itemId))
    .leftJoin(
      schema.itemCategories,
      eq(schema.itemCategories.id, schema.items.categoryId),
    )
    .where(and(...conditions))
    .groupBy(
      schema.saleItems.itemId,
      schema.items.name,
      schema.items.code,
      schema.items.categoryId,
      schema.itemCategories.name,
    )
    .orderBy(sql`SUM(${schema.saleItems.quantity}::numeric) DESC`)
    .limit(limit)
    .offset(offset);

  return rows.map((r) => ({
    itemId: r.itemId,
    itemName: r.itemName ?? "",
    itemCode: r.itemCode,
    categoryId: r.categoryId,
    categoryName: r.categoryName,
    totalQuantitySold: r.totalQuantity,
    totalRevenue: r.totalRevenue,
    transactionCount: Number(r.transactionCount),
    lastSoldAt: r.lastSoldAt ? r.lastSoldAt.toISOString() : null,
  }));
}

export async function countProductRotation(
  db: DB,
  filters: ProductRotationFilters,
): Promise<number> {
  const conditions: SQL[] = [
    eq(schema.branches.organizationId, filters.organizationId),
    isNull(schema.sales.deletedAt),
    eq(schema.sales.isActive, true),
    gte(schema.sales.createdAt, filters.from),
    lte(schema.sales.createdAt, filters.to),
  ];
  if (filters.branchId) {
    conditions.push(eq(schema.sales.branchId, filters.branchId));
  }

  const rows = await db
    .select({
      c: sql<number>`COUNT(DISTINCT ${schema.saleItems.itemId})::int`,
    })
    .from(schema.saleItems)
    .innerJoin(schema.sales, eq(schema.sales.id, schema.saleItems.saleId))
    .innerJoin(schema.branches, eq(schema.branches.id, schema.sales.branchId))
    .where(and(...conditions));
  return Number(rows[0]?.c ?? 0);
}

export async function getCatalogItemsNotSold(
  db: DB,
  filters: ProductRotationFilters,
  soldItemIds: string[],
): Promise<UnsoldItem[]> {
  const conditions: SQL[] = [
    eq(schema.branches.organizationId, filters.organizationId),
    isNull(schema.items.deletedAt),
  ];
  if (filters.branchId) {
    conditions.push(eq(schema.items.branchId, filters.branchId));
  }
  if (filters.categoryId) {
    conditions.push(eq(schema.items.categoryId, filters.categoryId));
  }
  if (soldItemIds.length > 0) {
    conditions.push(sql`${schema.items.id} NOT IN ${soldItemIds}`);
  }

  const rows = await db
    .select({
      itemId: schema.items.id,
      itemName: schema.items.name,
      itemCode: schema.items.code,
      categoryId: schema.items.categoryId,
      categoryName: schema.itemCategories.name,
    })
    .from(schema.items)
    .innerJoin(schema.branches, eq(schema.branches.id, schema.items.branchId))
    .leftJoin(
      schema.itemCategories,
      eq(schema.itemCategories.id, schema.items.categoryId),
    )
    .where(and(...conditions))
    .orderBy(schema.items.name)
    .limit(500);

  return rows.map((r) => ({
    itemId: r.itemId,
    itemName: r.itemName ?? "",
    itemCode: r.itemCode,
    categoryId: r.categoryId,
    categoryName: r.categoryName,
  }));
}

export async function getCatalogItemsCount(
  db: DB,
  filters: ProductRotationFilters,
): Promise<number> {
  const conditions: SQL[] = [
    eq(schema.branches.organizationId, filters.organizationId),
    isNull(schema.items.deletedAt),
  ];
  if (filters.branchId) {
    conditions.push(eq(schema.items.branchId, filters.branchId));
  }
  if (filters.categoryId) {
    conditions.push(eq(schema.items.categoryId, filters.categoryId));
  }
  const rows = await db
    .select({ value: count() })
    .from(schema.items)
    .innerJoin(schema.branches, eq(schema.branches.id, schema.items.branchId))
    .where(and(...conditions));
  return Number(rows[0]?.value ?? 0);
}

export async function findBranchOrg(
  db: DB,
  branchId: string,
  userOrganizationId: string,
): Promise<string> {
  const rows = await db
    .select({ organizationId: schema.branches.organizationId })
    .from(schema.branches)
    .where(eq(schema.branches.id, branchId))
    .limit(1);
  const orgId = rows[0]?.organizationId;
  if (!orgId || orgId !== userOrganizationId) {
    return "";
  }
  return orgId;
}
