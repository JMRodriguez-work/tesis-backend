import { and, count, eq, ilike, isNull, or } from "drizzle-orm";
import type { DB } from "../../../../shared/db";
import * as schema from "../../../../shared/db/schema";

export const userTable = schema.user;

export type UserWithRelations = {
  id: string;
  email: string;
  name: string;
  organizationId: string | null;
  branchId: string | null;
  roleId: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  branch: { id: string; name: string } | null;
  role: { id: number; name: string } | null;
};

export type ListUsersFilters = {
  search?: string;
  roleId?: number;
};

export type ListUsersResult = {
  data: UserWithRelations[];
  total: number;
};

export function userIdEq(id: string) {
  return eq(schema.user.id, id);
}

export async function findUserByIdRaw(db: DB, id: string) {
  const result = await db
    .select()
    .from(schema.user)
    .where(eq(schema.user.id, id))
    .limit(1);
  return result[0] ?? null;
}

export async function findUserById(
  db: DB,
  id: string,
): Promise<UserWithRelations | null> {
  const result = await db
    .select({
      id: schema.user.id,
      email: schema.user.email,
      name: schema.user.name,
      organizationId: schema.user.organizationId,
      branchId: schema.user.branchId,
      roleId: schema.user.roleId,
      isActive: schema.user.isActive,
      createdAt: schema.user.createdAt,
      updatedAt: schema.user.updatedAt,
      branchIdRel: schema.branches.id,
      branchName: schema.branches.name,
      roleIdRel: schema.roles.id,
      roleName: schema.roles.name,
    })
    .from(schema.user)
    .leftJoin(schema.branches, eq(schema.branches.id, schema.user.branchId))
    .leftJoin(schema.roles, eq(schema.roles.id, schema.user.roleId))
    .where(and(eq(schema.user.id, id), isNull(schema.user.deletedAt)))
    .limit(1);

  const row = result[0];
  if (!row) return null;

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    organizationId: row.organizationId,
    branchId: row.branchId,
    roleId: row.roleId,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    branch: row.branchIdRel
      ? { id: row.branchIdRel, name: row.branchName ?? "" }
      : null,
    role:
      row.roleIdRel !== null
        ? { id: row.roleIdRel, name: row.roleName ?? "" }
        : null,
  };
}

export async function findUsersByOrganization(
  db: DB,
  organizationId: string,
  filters: ListUsersFilters,
  limit: number,
  offset: number,
): Promise<UserWithRelations[]> {
  const conditions = [
    eq(schema.user.organizationId, organizationId),
    isNull(schema.user.deletedAt),
  ];

  if (filters.search) {
    const pattern = `%${filters.search}%`;
    conditions.push(
      or(ilike(schema.user.name, pattern), ilike(schema.user.email, pattern))!,
    );
  }

  if (filters.roleId !== undefined) {
    conditions.push(eq(schema.user.roleId, filters.roleId));
  }

  const result = await db
    .select({
      id: schema.user.id,
      email: schema.user.email,
      name: schema.user.name,
      organizationId: schema.user.organizationId,
      branchId: schema.user.branchId,
      roleId: schema.user.roleId,
      isActive: schema.user.isActive,
      createdAt: schema.user.createdAt,
      updatedAt: schema.user.updatedAt,
      branchIdRel: schema.branches.id,
      branchName: schema.branches.name,
      roleIdRel: schema.roles.id,
      roleName: schema.roles.name,
    })
    .from(schema.user)
    .leftJoin(schema.branches, eq(schema.branches.id, schema.user.branchId))
    .leftJoin(schema.roles, eq(schema.roles.id, schema.user.roleId))
    .where(and(...conditions))
    .orderBy(schema.user.createdAt)
    .limit(limit)
    .offset(offset);

  return result.map((row) => ({
    id: row.id,
    email: row.email,
    name: row.name,
    organizationId: row.organizationId,
    branchId: row.branchId,
    roleId: row.roleId,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    branch: row.branchIdRel
      ? { id: row.branchIdRel, name: row.branchName ?? "" }
      : null,
    role:
      row.roleIdRel !== null
        ? { id: row.roleIdRel, name: row.roleName ?? "" }
        : null,
  }));
}

export async function countUsersByOrganization(
  db: DB,
  organizationId: string,
  filters: ListUsersFilters,
): Promise<number> {
  const conditions = [
    eq(schema.user.organizationId, organizationId),
    isNull(schema.user.deletedAt),
  ];

  if (filters.search) {
    const pattern = `%${filters.search}%`;
    conditions.push(
      or(ilike(schema.user.name, pattern), ilike(schema.user.email, pattern))!,
    );
  }

  if (filters.roleId !== undefined) {
    conditions.push(eq(schema.user.roleId, filters.roleId));
  }

  const result = await db
    .select({ value: count() })
    .from(schema.user)
    .where(and(...conditions));

  return result[0]?.value ?? 0;
}

export async function findUserByEmail(db: DB, email: string) {
  const result = await db
    .select()
    .from(schema.user)
    .where(eq(schema.user.email, email))
    .limit(1);
  return result[0] ?? null;
}

export async function updateUser(
  db: DB,
  id: string,
  data: Partial<typeof schema.user.$inferInsert>,
) {
  const result = await db
    .update(schema.user)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(schema.user.id, id))
    .returning();
  return result[0] ?? null;
}

export async function softDeleteUser(db: DB, id: string) {
  const result = await db
    .update(schema.user)
    .set({ isActive: false, deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(schema.user.id, id), isNull(schema.user.deletedAt)))
    .returning({ id: schema.user.id });
  return result[0] ?? null;
}

export async function changeUserRole(db: DB, id: string, roleId: number) {
  const result = await db
    .update(schema.user)
    .set({ roleId, updatedAt: new Date() })
    .where(eq(schema.user.id, id))
    .returning();
  return result[0] ?? null;
}
