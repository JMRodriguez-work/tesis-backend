import { and, desc, eq, isNull, sql, type SQL } from "drizzle-orm";
import type { DB } from "../../../../shared/db";
import * as schema from "../../../../shared/db/schema";
import type {
  CustomerWithPurchaseStats,
  InactiveCustomerRow,
  SegmentRow,
} from "../../domain/customer-analytics.entity";

export async function getCustomersWithLastPurchase(
  db: DB,
  organizationId: string,
  branchId: string | null,
): Promise<CustomerWithPurchaseStats[]> {
  const conditions: SQL[] = [
    eq(schema.branches.organizationId, organizationId),
    eq(schema.customers.isActive, true),
  ];
  if (branchId) {
    conditions.push(eq(schema.customers.branchId, branchId));
  }

  const rows = await db
    .select({
      customerId: schema.customers.id,
      fullname: schema.customers.fullname,
      email: schema.customers.email,
      phone: schema.customers.phone,
      branchId: schema.customers.branchId,
      branchName: schema.branches.name,
      lastPurchaseAt: sql<Date | null>`MAX(${schema.sales.createdAt})`,
      totalSpent: sql<string>`COALESCE(SUM(${schema.sales.total}::numeric), 0)::text`,
      purchaseCount: sql<number>`COUNT(${schema.sales.id})::int`,
    })
    .from(schema.customers)
    .innerJoin(
      schema.branches,
      eq(schema.branches.id, schema.customers.branchId),
    )
    .leftJoin(
      schema.sales,
      and(
        eq(schema.sales.customerId, schema.customers.id),
        eq(schema.sales.isActive, true),
        isNull(schema.sales.deletedAt),
      ),
    )
    .where(and(...conditions))
    .groupBy(
      schema.customers.id,
      schema.customers.fullname,
      schema.customers.email,
      schema.customers.phone,
      schema.customers.branchId,
      schema.branches.name,
    );

  return rows
    .map((r) => ({
      customerId: r.customerId,
      fullname: r.fullname,
      email: r.email,
      phone: r.phone,
      branchId: r.branchId,
      branchName: r.branchName ?? "",
      lastPurchaseAt: toDate(r.lastPurchaseAt),
      totalSpent: r.totalSpent,
      purchaseCount: Number(r.purchaseCount),
    }))
    .filter((r) => r.lastPurchaseAt !== null);
}

export async function getActiveRetentionCustomers(
  db: DB,
  organizationId: string,
  branchId: string | null,
): Promise<{ customerId: string }[]> {
  const conditions: SQL[] = [
    eq(schema.branches.organizationId, organizationId),
    eq(schema.recommendations.type, "retention"),
    eq(schema.recommendations.status, "pending"),
  ];
  if (branchId) {
    conditions.push(eq(schema.recommendations.branchId, branchId));
  }
  const rows = await db
    .select({ customerId: schema.recommendations.customerId })
    .from(schema.recommendations)
    .innerJoin(
      schema.branches,
      eq(schema.branches.id, schema.recommendations.branchId),
    )
    .where(and(...conditions));
  return rows
    .map((r) => r.customerId)
    .filter((id): id is string => id !== null)
    .map((id) => ({ customerId: id }));
}

export async function createRetentionRecommendation(
  db: DB,
  data: typeof schema.recommendations.$inferInsert,
) {
  const result = await db
    .insert(schema.recommendations)
    .values(data)
    .returning();
  return result[0] ?? null;
}

export async function markRetentionAsResolvedForCustomer(
  db: DB,
  organizationId: string,
  customerId: string,
): Promise<number> {
  const result = await db
    .update(schema.recommendations)
    .set({ status: "applied" })
    .where(
      and(
        eq(schema.recommendations.type, "retention"),
        eq(schema.recommendations.status, "pending"),
        eq(schema.recommendations.customerId, customerId),
        sql`${schema.recommendations.branchId} IN (
          SELECT id FROM branches WHERE organization_id = ${organizationId}
        )`,
      ),
    )
    .returning({ id: schema.recommendations.id });

  return result.length;
}

export async function getInactiveCustomersWithRecommendations(
  db: DB,
  organizationId: string,
  branchId: string | null,
  limit: number,
): Promise<InactiveCustomerRow[]> {
  const conditions: SQL[] = [
    eq(schema.branches.organizationId, organizationId),
    eq(schema.recommendations.type, "retention"),
    eq(schema.recommendations.status, "pending"),
  ];
  if (branchId) {
    conditions.push(eq(schema.recommendations.branchId, branchId));
  }

  const rows = await db
    .select({
      customerId: schema.customers.id,
      customerFullname: schema.customers.fullname,
      customerEmail: schema.customers.email,
      customerPhone: schema.customers.phone,
      branchId: schema.customers.branchId,
      branchName: schema.branches.name,
      lastPurchaseAt: sql<Date | null>`(
        SELECT MAX(s.created_at)
        FROM sales s
        WHERE s.customer_id = ${schema.customers.id}
          AND s.is_active = true
          AND s.deleted_at IS NULL
      )`,
      totalSpent: sql<string>`(
        SELECT COALESCE(SUM(s.total::numeric), 0)::text
        FROM sales s
        WHERE s.customer_id = ${schema.customers.id}
          AND s.is_active = true
          AND s.deleted_at IS NULL
      )`,
      purchaseCount: sql<number>`(
        SELECT COUNT(s.id)::int
        FROM sales s
        WHERE s.customer_id = ${schema.customers.id}
          AND s.is_active = true
          AND s.deleted_at IS NULL
      )`,
      recommendationId: schema.recommendations.id,
      recommendationGeneratedAt: schema.recommendations.generatedAt,
    })
    .from(schema.recommendations)
    .innerJoin(
      schema.branches,
      eq(schema.branches.id, schema.recommendations.branchId),
    )
    .innerJoin(
      schema.customers,
      and(
        eq(schema.customers.id, schema.recommendations.customerId),
        eq(schema.customers.isActive, true),
      ),
    )
    .where(and(...conditions))
    .orderBy(desc(schema.recommendations.generatedAt))
    .limit(limit);

  return rows.map((r) => ({
    customerId: r.customerId,
    customerFullname: r.customerFullname,
    customerEmail: r.customerEmail,
    customerPhone: r.customerPhone,
    branchId: r.branchId,
    branchName: r.branchName ?? "",
    lastPurchaseAt: toDate(r.lastPurchaseAt),
    daysSinceLastPurchase: null,
    totalSpent: r.totalSpent,
    purchaseCount: Number(r.purchaseCount),
    recommendationId: r.recommendationId,
    recommendationGeneratedAt: r.recommendationGeneratedAt,
  }));
}

export async function countInactiveCustomersWithRecommendations(
  db: DB,
  organizationId: string,
  branchId: string | null,
): Promise<number> {
  const conditions: SQL[] = [
    eq(schema.branches.organizationId, organizationId),
    eq(schema.recommendations.type, "retention"),
    eq(schema.recommendations.status, "pending"),
  ];
  if (branchId) {
    conditions.push(eq(schema.recommendations.branchId, branchId));
  }
  const rows = await db
    .select({ value: sql<number>`COUNT(${schema.recommendations.id})::int` })
    .from(schema.recommendations)
    .innerJoin(
      schema.branches,
      eq(schema.branches.id, schema.recommendations.branchId),
    )
    .innerJoin(
      schema.customers,
      and(
        eq(schema.customers.id, schema.recommendations.customerId),
        eq(schema.customers.isActive, true),
      ),
    )
    .where(and(...conditions));
  return Number(rows[0]?.value ?? 0);
}

export type SegmentCustomerRaw = {
  customerId: string;
  fullname: string;
  email: string | null;
  phone: string | null;
  branchId: string;
  branchName: string;
  purchaseCount: number;
  totalSpent: string;
  lastPurchaseAt: Date | null;
};

export async function getCustomersWithStats(
  db: DB,
  organizationId: string,
  branchId: string | null,
  limit: number,
  offset: number,
): Promise<SegmentCustomerRaw[]> {
  const conditions: SQL[] = [
    eq(schema.branches.organizationId, organizationId),
    eq(schema.customers.isActive, true),
  ];
  if (branchId) {
    conditions.push(eq(schema.customers.branchId, branchId));
  }

  const rows = await db
    .select({
      customerId: schema.customers.id,
      fullname: schema.customers.fullname,
      email: schema.customers.email,
      phone: schema.customers.phone,
      branchId: schema.customers.branchId,
      branchName: schema.branches.name,
      purchaseCount: sql<number>`(
        SELECT COUNT(s.id)::int
        FROM sales s
        WHERE s.customer_id = ${schema.customers.id}
          AND s.is_active = true
          AND s.deleted_at IS NULL
      )`,
      totalSpent: sql<string>`(
        SELECT COALESCE(SUM(s.total::numeric), 0)::text
        FROM sales s
        WHERE s.customer_id = ${schema.customers.id}
          AND s.is_active = true
          AND s.deleted_at IS NULL
      )`,
      lastPurchaseAt: sql<Date | null>`(
        SELECT MAX(s.created_at)
        FROM sales s
        WHERE s.customer_id = ${schema.customers.id}
          AND s.is_active = true
          AND s.deleted_at IS NULL
      )`,
    })
    .from(schema.customers)
    .innerJoin(
      schema.branches,
      eq(schema.branches.id, schema.customers.branchId),
    )
    .where(and(...conditions))
    .orderBy(schema.customers.fullname)
    .limit(limit)
    .offset(offset);

  return rows.map((r) => ({
    customerId: r.customerId,
    fullname: r.fullname,
    email: r.email,
    phone: r.phone,
    branchId: r.branchId,
    branchName: r.branchName ?? "",
    purchaseCount: Number(r.purchaseCount),
    totalSpent: r.totalSpent,
    lastPurchaseAt: toDate(r.lastPurchaseAt),
  }));
}

export async function countCustomersWithStats(
  db: DB,
  organizationId: string,
  branchId: string | null,
): Promise<number> {
  const conditions: SQL[] = [
    eq(schema.branches.organizationId, organizationId),
    eq(schema.customers.isActive, true),
  ];
  if (branchId) {
    conditions.push(eq(schema.customers.branchId, branchId));
  }
  const rows = await db
    .select({ value: sql<number>`COUNT(${schema.customers.id})::int` })
    .from(schema.customers)
    .innerJoin(
      schema.branches,
      eq(schema.branches.id, schema.customers.branchId),
    )
    .where(and(...conditions));
  return Number(rows[0]?.value ?? 0);
}


export function toDate(value: Date | string | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
