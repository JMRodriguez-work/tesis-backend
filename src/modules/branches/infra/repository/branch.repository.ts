import { and, count, eq, ilike, isNull } from "drizzle-orm";
import type { DB } from "../../../../shared/db";
import * as schema from "../../../../shared/db/schema";

export const branchTable = schema.branches;

export type BranchWithRelations = {
  id: string;
  name: string;
  isActive: boolean;
  organizationId: string;
  organization: { id: string; name: string };
  createdAt: Date;
  updatedAt: Date;
};

export type ListBranchesFilters = {
  search?: string;
  isActive?: boolean;
};

export type ListBranchesResult = {
  data: BranchWithRelations[];
  total: number;
};

export function branchIdEq(id: string) {
  return eq(schema.branches.id, id);
}

export async function createBranch(
  db: DB,
  data: typeof schema.branches.$inferInsert,
) {
  const result = await db.insert(schema.branches).values(data).returning();
  return result[0];
}

export async function findBranchByIdRaw(db: DB, id: string) {
  const result = await db
    .select()
    .from(schema.branches)
    .where(eq(schema.branches.id, id))
    .limit(1);
  return result[0] ?? null;
}

export async function findBranchById(
  db: DB,
  id: string,
): Promise<BranchWithRelations | null> {
  const result = await db
    .select({
      id: schema.branches.id,
      name: schema.branches.name,
      isActive: schema.branches.isActive,
      organizationId: schema.branches.organizationId,
      createdAt: schema.branches.createdAt,
      updatedAt: schema.branches.updatedAt,
      organizationIdRel: schema.organizations.id,
      organizationName: schema.organizations.name,
    })
    .from(schema.branches)
    .leftJoin(
      schema.organizations,
      eq(schema.organizations.id, schema.branches.organizationId),
    )
    .where(and(eq(schema.branches.id, id), isNull(schema.branches.deletedAt)))
    .limit(1);

  const row = result[0];
  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    isActive: row.isActive,
    organizationId: row.organizationId,
    organization: {
      id: row.organizationIdRel ?? row.organizationId,
      name: row.organizationName ?? "",
    },
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function findBranchesByOrganization(
  db: DB,
  organizationId: string,
  filters: ListBranchesFilters,
  limit: number,
  offset: number,
): Promise<BranchWithRelations[]> {
  const conditions = [
    eq(schema.branches.organizationId, organizationId),
    isNull(schema.branches.deletedAt),
  ];

  if (filters.isActive !== undefined) {
    conditions.push(eq(schema.branches.isActive, filters.isActive));
  }

  if (filters.search) {
    const pattern = `%${filters.search}%`;
    conditions.push(ilike(schema.branches.name, pattern)!);
  }

  const result = await db
    .select({
      id: schema.branches.id,
      name: schema.branches.name,
      isActive: schema.branches.isActive,
      organizationId: schema.branches.organizationId,
      createdAt: schema.branches.createdAt,
      updatedAt: schema.branches.updatedAt,
      organizationIdRel: schema.organizations.id,
      organizationName: schema.organizations.name,
    })
    .from(schema.branches)
    .leftJoin(
      schema.organizations,
      eq(schema.organizations.id, schema.branches.organizationId),
    )
    .where(and(...conditions))
    .orderBy(schema.branches.createdAt)
    .limit(limit)
    .offset(offset);

  return result.map((row) => ({
    id: row.id,
    name: row.name,
    isActive: row.isActive,
    organizationId: row.organizationId,
    organization: {
      id: row.organizationIdRel ?? row.organizationId,
      name: row.organizationName ?? "",
    },
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
}

export async function countBranchesByOrganization(
  db: DB,
  organizationId: string,
  filters: ListBranchesFilters,
): Promise<number> {
  const conditions = [
    eq(schema.branches.organizationId, organizationId),
    isNull(schema.branches.deletedAt),
  ];

  if (filters.isActive !== undefined) {
    conditions.push(eq(schema.branches.isActive, filters.isActive));
  }

  if (filters.search) {
    const pattern = `%${filters.search}%`;
    conditions.push(ilike(schema.branches.name, pattern)!);
  }

  const result = await db
    .select({ value: count() })
    .from(schema.branches)
    .where(and(...conditions));

  return result[0]?.value ?? 0;
}

export async function countActiveBranchesByOrganization(
  db: DB,
  organizationId: string,
): Promise<number> {
  const result = await db
    .select({ value: count() })
    .from(schema.branches)
    .where(
      and(
        eq(schema.branches.organizationId, organizationId),
        isNull(schema.branches.deletedAt),
        eq(schema.branches.isActive, true),
      ),
    );
  return result[0]?.value ?? 0;
}

export async function updateBranch(
  db: DB,
  id: string,
  data: Partial<typeof schema.branches.$inferInsert>,
) {
  const result = await db
    .update(schema.branches)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(schema.branches.id, id), isNull(schema.branches.deletedAt)))
    .returning();
  return result[0] ?? null;
}

export async function softDeleteBranch(db: DB, id: string) {
  const result = await db
    .update(schema.branches)
    .set({ deletedAt: new Date(), isActive: false, updatedAt: new Date() })
    .where(and(eq(schema.branches.id, id), isNull(schema.branches.deletedAt)))
    .returning({ id: schema.branches.id });
  return result[0] ?? null;
}
