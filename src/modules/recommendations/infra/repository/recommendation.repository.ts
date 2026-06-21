import { and, count, desc, eq, gte, isNull, lt, type SQL } from "drizzle-orm";
import type { DB } from "../../../../shared/db";
import * as schema from "../../../../shared/db/schema";
import type {
  RecommendationListRow,
  RecommendationPriority,
  RecommendationStatus,
  RecommendationType,
  RecommendationWithRelations,
} from "../../domain/recommendation.entity";

export const recommendationTable = schema.recommendations;

export type ListRecommendationsFilters = {
  branchId: string | null;
  type?: RecommendationType;
  status?: RecommendationStatus;
  itemId?: string;
};

function buildConditions(
  filters: ListRecommendationsFilters,
  organizationId: string,
): SQL[] {
  const conditions: SQL[] = [
    eq(schema.branches.organizationId, organizationId),
  ];
  if (filters.branchId) {
    conditions.push(eq(recommendationTable.branchId, filters.branchId));
  }
  if (filters.type) {
    conditions.push(eq(recommendationTable.type, filters.type));
  }
  if (filters.status) {
    conditions.push(eq(recommendationTable.status, filters.status));
  }
  if (filters.itemId) {
    conditions.push(eq(recommendationTable.itemId, filters.itemId));
  }
  return conditions;
}

function rowToListRow(r: {
  id: string;
  branchId: string;
  branchName: string | null;
  itemId: string | null;
  itemName: string | null;
  itemCode: string | null;
  customerId: string | null;
  customerFullname: string | null;
  type: string;
  description: string;
  priority: string;
  status: string;
  generatedAt: Date;
  expiresAt: Date | null;
  readAt: Date | null;
}): RecommendationListRow {
  return {
    id: r.id,
    branchId: r.branchId,
    branchName: r.branchName ?? "",
    itemId: r.itemId,
    itemName: r.itemName,
    itemCode: r.itemCode,
    customerId: r.customerId,
    customerFullname: r.customerFullname,
    type: r.type as RecommendationType,
    description: r.description,
    priority: r.priority as RecommendationPriority,
    status: r.status as RecommendationStatus,
    generatedAt: r.generatedAt,
    expiresAt: r.expiresAt,
    readAt: r.readAt,
  };
}

export async function findRecommendationsPaginated(
  db: DB,
  organizationId: string,
  filters: ListRecommendationsFilters,
  limit: number,
  offset: number,
): Promise<RecommendationListRow[]> {
  const rows = await db
    .select({
      id: recommendationTable.id,
      branchId: recommendationTable.branchId,
      branchName: schema.branches.name,
      itemId: recommendationTable.itemId,
      itemName: schema.items.name,
      itemCode: schema.items.code,
      customerId: recommendationTable.customerId,
      customerFullname: schema.customers.fullname,
      type: recommendationTable.type,
      description: recommendationTable.description,
      priority: recommendationTable.priority,
      status: recommendationTable.status,
      generatedAt: recommendationTable.generatedAt,
      expiresAt: recommendationTable.expiresAt,
      readAt: recommendationTable.readAt,
    })
    .from(recommendationTable)
    .innerJoin(
      schema.branches,
      eq(schema.branches.id, recommendationTable.branchId),
    )
    .leftJoin(schema.items, eq(schema.items.id, recommendationTable.itemId))
    .leftJoin(
      schema.customers,
      eq(schema.customers.id, recommendationTable.customerId),
    )
    .where(and(...buildConditions(filters, organizationId)))
    .orderBy(desc(recommendationTable.generatedAt))
    .limit(limit)
    .offset(offset);

  return rows.map(rowToListRow);
}

export async function countRecommendations(
  db: DB,
  organizationId: string,
  filters: ListRecommendationsFilters,
): Promise<number> {
  const result = await db
    .select({ value: count() })
    .from(recommendationTable)
    .innerJoin(
      schema.branches,
      eq(schema.branches.id, recommendationTable.branchId),
    )
    .where(and(...buildConditions(filters, organizationId)));
  return result[0]?.value ?? 0;
}

export async function findRecommendationByIdRaw(db: DB, id: string) {
  const result = await db
    .select()
    .from(recommendationTable)
    .where(eq(recommendationTable.id, id))
    .limit(1);
  return result[0] ?? null;
}

export async function findRecommendationById(
  db: DB,
  id: string,
): Promise<RecommendationWithRelations | null> {
  const rows = await db
    .select({
      id: recommendationTable.id,
      branchId: recommendationTable.branchId,
      branchName: schema.branches.name,
      itemId: recommendationTable.itemId,
      itemName: schema.items.name,
      itemCode: schema.items.code,
      customerId: recommendationTable.customerId,
      customerFullname: schema.customers.fullname,
      type: recommendationTable.type,
      description: recommendationTable.description,
      priority: recommendationTable.priority,
      status: recommendationTable.status,
      generatedAt: recommendationTable.generatedAt,
      expiresAt: recommendationTable.expiresAt,
      readAt: recommendationTable.readAt,
    })
    .from(recommendationTable)
    .innerJoin(
      schema.branches,
      eq(schema.branches.id, recommendationTable.branchId),
    )
    .leftJoin(schema.items, eq(schema.items.id, recommendationTable.itemId))
    .leftJoin(
      schema.customers,
      eq(schema.customers.id, recommendationTable.customerId),
    )
    .where(eq(recommendationTable.id, id))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    branchId: row.branchId,
    branch: { id: row.branchId, name: row.branchName ?? "" },
    itemId: row.itemId,
    item: row.itemId
      ? { id: row.itemId, name: row.itemName ?? "", code: row.itemCode }
      : null,
    customerId: row.customerId,
    customer: row.customerId
      ? { id: row.customerId, fullname: row.customerFullname ?? "" }
      : null,
    type: row.type as RecommendationType,
    description: row.description,
    priority: row.priority as RecommendationPriority,
    status: row.status as RecommendationStatus,
    generatedAt: row.generatedAt,
    expiresAt: row.expiresAt,
    readAt: row.readAt,
  };
}

// ─── Triggers: helpers that operate inside a caller-provided transaction ──

/**
 * Find an active (status='pending') `restock` recommendation for the given
 * (branch, item). Returns null if none.
 */
export async function findActiveRestockByItemBranch(
  tx: DB,
  branchId: string,
  itemId: string,
) {
  const result = await tx
    .select({ id: recommendationTable.id })
    .from(recommendationTable)
    .where(
      and(
        eq(recommendationTable.branchId, branchId),
        eq(recommendationTable.itemId, itemId),
        eq(recommendationTable.type, "restock"),
        eq(recommendationTable.status, "pending"),
      ),
    )
    .limit(1);
  return result[0] ?? null;
}

export async function createRestockRecommendation(
  tx: DB,
  data: typeof schema.recommendations.$inferInsert,
) {
  const result = await tx.insert(recommendationTable).values(data).returning();
  return result[0];
}

/**
 * Mark all `restock` recommendations for the (branch, item) with status
 * 'pending' as 'applied'. Returns the number of rows updated.
 */
export async function markRestockRecommendationsAsApplied(
  tx: DB,
  branchId: string,
  itemId: string,
): Promise<number> {
  const result = await tx
    .update(recommendationTable)
    .set({ status: "applied" })
    .where(
      and(
        eq(recommendationTable.branchId, branchId),
        eq(recommendationTable.itemId, itemId),
        eq(recommendationTable.type, "restock"),
        eq(recommendationTable.status, "pending"),
      ),
    )
    .returning({ id: recommendationTable.id });
  return result.length;
}

export async function updateRecommendationStatus(
  db: DB,
  id: string,
  status: RecommendationStatus,
) {
  const result = await db
    .update(recommendationTable)
    .set({ status })
    .where(eq(recommendationTable.id, id))
    .returning();
  return result[0] ?? null;
}

export type UnreadFilters = {
  organizationId: string;
  branchId: string | null;
  limit: number;
};

export async function findUnreadRecommendations(
  db: DB,
  filters: UnreadFilters,
): Promise<RecommendationListRow[]> {
  const conditions: SQL[] = [
    eq(schema.branches.organizationId, filters.organizationId),
    eq(recommendationTable.status, "pending"),
    isNull(recommendationTable.readAt),
  ];
  if (filters.branchId) {
    conditions.push(eq(recommendationTable.branchId, filters.branchId));
  }

  const rows = await db
    .select({
      id: recommendationTable.id,
      branchId: recommendationTable.branchId,
      branchName: schema.branches.name,
      itemId: recommendationTable.itemId,
      itemName: schema.items.name,
      itemCode: schema.items.code,
      customerId: recommendationTable.customerId,
      customerFullname: schema.customers.fullname,
      type: recommendationTable.type,
      description: recommendationTable.description,
      priority: recommendationTable.priority,
      status: recommendationTable.status,
      generatedAt: recommendationTable.generatedAt,
      expiresAt: recommendationTable.expiresAt,
      readAt: recommendationTable.readAt,
    })
    .from(recommendationTable)
    .innerJoin(
      schema.branches,
      eq(schema.branches.id, recommendationTable.branchId),
    )
    .leftJoin(schema.items, eq(schema.items.id, recommendationTable.itemId))
    .leftJoin(
      schema.customers,
      eq(schema.customers.id, recommendationTable.customerId),
    )
    .where(and(...conditions))
    .orderBy(desc(recommendationTable.generatedAt))
    .limit(filters.limit);

  return rows.map(rowToListRow);
}

export async function countUnreadRecommendations(
  db: DB,
  organizationId: string,
  branchId: string | null,
): Promise<number> {
  const conditions: SQL[] = [
    eq(schema.branches.organizationId, organizationId),
    eq(recommendationTable.status, "pending"),
    isNull(recommendationTable.readAt),
  ];
  if (branchId) {
    conditions.push(eq(recommendationTable.branchId, branchId));
  }
  const result = await db
    .select({ value: count() })
    .from(recommendationTable)
    .innerJoin(
      schema.branches,
      eq(schema.branches.id, recommendationTable.branchId),
    )
    .where(and(...conditions));
  return result[0]?.value ?? 0;
}

export async function markRecommendationAsRead(
  db: DB,
  id: string,
  readAt: Date,
): Promise<{ id: string; readAt: Date | null } | null> {
  const result = await db
    .update(recommendationTable)
    .set({ readAt })
    .where(
      and(eq(recommendationTable.id, id), isNull(recommendationTable.readAt)),
    )
    .returning({
      id: recommendationTable.id,
      readAt: recommendationTable.readAt,
    });
  return result[0] ?? null;
}

export async function markAllRecommendationsAsRead(
  db: DB,
  branchId: string,
  readAt: Date,
): Promise<number> {
  const result = await db
    .update(recommendationTable)
    .set({ readAt })
    .where(
      and(
        eq(recommendationTable.branchId, branchId),
        isNull(recommendationTable.readAt),
        eq(recommendationTable.status, "pending"),
      ),
    )
    .returning({ id: recommendationTable.id });
  return result.length;
}

export async function findActiveSeasonalByItemBranch(
  db: DB,
  branchId: string,
  itemId: string,
): Promise<{ id: string } | null> {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const nextMonthStart = new Date(monthStart);
  nextMonthStart.setUTCMonth(monthStart.getUTCMonth() + 1);

  const result = await db
    .select({ id: recommendationTable.id })
    .from(recommendationTable)
    .where(
      and(
        eq(recommendationTable.branchId, branchId),
        eq(recommendationTable.itemId, itemId),
        eq(recommendationTable.type, "seasonal"),
        eq(recommendationTable.status, "pending"),
        gte(recommendationTable.generatedAt, monthStart),
        lt(recommendationTable.generatedAt, nextMonthStart),
      ),
    )
    .limit(1);
  return result[0] ?? null;
}
