import { and, eq, gte, isNull, lte, sql, type SQL } from "drizzle-orm";
import type { DB } from "../../../../shared/db";
import * as schema from "../../../../shared/db/schema";
import type {
  CategoryDistributionRow,
  SalesTrendBucket,
  TopItemRow,
  TrendBucket,
  TrendInterval,
  TopItemSortBy,
} from "../../domain/report.entity";

export type ReportPeriodFilters = {
  organizationId: string;
  branchId: string | null;
  from: Date;
  to: Date;
};

export async function getSalesTrend(
  db: DB,
  filters: ReportPeriodFilters,
  interval: TrendInterval,
): Promise<SalesTrendBucket[]> {
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
      bucket: sql<string>`to_char(date_trunc(${sql.raw(`'${interval}'`)}, ${schema.sales.createdAt}), 'YYYY-MM-DD')`,
      totalSales: sql<string>`COALESCE(SUM(${schema.sales.total}::numeric), 0)::text`,
      transactionCount: sql<number>`COUNT(*)::int`,
    })
    .from(schema.sales)
    .innerJoin(schema.branches, eq(schema.branches.id, schema.sales.branchId))
    .where(and(...conditions))
    .groupBy(
      sql`date_trunc(${sql.raw(`'${interval}'`)}, ${schema.sales.createdAt})`,
    )
    .orderBy(
      sql`date_trunc(${sql.raw(`'${interval}'`)}, ${schema.sales.createdAt}) ASC`,
    );

  return rows.map((r) => ({
    bucket: r.bucket,
    totalSales: r.totalSales,
    transactionCount: Number(r.transactionCount),
  }));
}

export async function getRevenueTimeline(
  db: DB,
  filters: ReportPeriodFilters,
  interval: TrendInterval,
): Promise<TrendBucket[]> {
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
      bucket: sql<string>`to_char(date_trunc(${sql.raw(`'${interval}'`)}, ${schema.sales.createdAt}), 'YYYY-MM-DD')`,
      totalSales: sql<string>`COALESCE(SUM(${schema.sales.total}::numeric), 0)::text`,
    })
    .from(schema.sales)
    .innerJoin(schema.branches, eq(schema.branches.id, schema.sales.branchId))
    .where(and(...conditions))
    .groupBy(
      sql`date_trunc(${sql.raw(`'${interval}'`)}, ${schema.sales.createdAt})`,
    )
    .orderBy(
      sql`date_trunc(${sql.raw(`'${interval}'`)}, ${schema.sales.createdAt}) ASC`,
    );

  return rows.map((r) => ({
    bucket: r.bucket,
    totalSales: r.totalSales,
  }));
}

export async function getTopItems(
  db: DB,
  filters: ReportPeriodFilters,
  sortBy: TopItemSortBy,
  limit: number,
): Promise<TopItemRow[]> {
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

  const orderBy =
    sortBy === "revenue"
      ? sql`SUM(${schema.saleItems.price}::numeric * ${schema.saleItems.quantity}::numeric) DESC`
      : sql`SUM(${schema.saleItems.quantity}::numeric) DESC`;

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
      lastSoldAt: sql<string | null>`MAX(${schema.sales.createdAt})`,
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
    .orderBy(orderBy)
    .limit(limit);

  return rows.map((r) => ({
    itemId: r.itemId,
    itemName: r.itemName ?? "",
    itemCode: r.itemCode,
    categoryId: r.categoryId,
    categoryName: r.categoryName,
    totalQuantitySold: r.totalQuantity,
    totalRevenue: r.totalRevenue,
    transactionCount: Number(r.transactionCount),
    lastSoldAt: r.lastSoldAt ? new Date(r.lastSoldAt).toISOString() : null,
  }));
}

export async function getCategoryDistribution(
  db: DB,
  filters: ReportPeriodFilters,
): Promise<CategoryDistributionRow[]> {
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
      categoryId: schema.items.categoryId,
      categoryName: schema.itemCategories.name,
      totalRevenue: sql<string>`COALESCE(SUM(${schema.saleItems.price}::numeric * ${schema.saleItems.quantity}::numeric), 0)::text`,
      transactionCount: sql<number>`COUNT(DISTINCT ${schema.sales.id})::int`,
      itemCount: sql<number>`COUNT(DISTINCT ${schema.items.id})::int`,
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
    .groupBy(schema.items.categoryId, schema.itemCategories.name)
    .orderBy(
      sql`SUM(${schema.saleItems.price}::numeric * ${schema.saleItems.quantity}::numeric) DESC`,
    );

  return rows.map((r) => ({
    categoryId: r.categoryId,
    categoryName: r.categoryName ?? "Sin categoría",
    totalRevenue: r.totalRevenue,
    transactionCount: Number(r.transactionCount),
    itemCount: Number(r.itemCount),
  }));
}

export async function findBranchOrg(
  db: DB,
  branchId: string,
  userOrganizationId: string,
): Promise<boolean> {
  const rows = await db
    .select({ organizationId: schema.branches.organizationId })
    .from(schema.branches)
    .where(eq(schema.branches.id, branchId))
    .limit(1);
  const orgId = rows[0]?.organizationId;
  return !!orgId && orgId === userOrganizationId;
}
