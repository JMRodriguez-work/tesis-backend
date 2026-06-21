import { and, count, eq, ilike, isNull, ne, or, type SQL } from 'drizzle-orm'
import type { DB } from '../../../../shared/db'
import * as schema from '../../../../shared/db/schema'

export const customerTable = schema.customers

export type CustomerWithRelations = {
  id: string
  fullname: string
  email: string | null
  phone: string | null
  address: string | null
  isActive: boolean
  organizationId: string
  branchId: string
  branch: { id: string; name: string }
  createdAt: Date
  updatedAt: Date
}

export async function findCustomerByIdRaw(db: DB, id: string) {
  const result = await db
    .select()
    .from(schema.customers)
    .where(eq(schema.customers.id, id))
    .limit(1)
  return result[0] ?? null
}

export async function findCustomerById(
  db: DB,
  id: string,
): Promise<CustomerWithRelations | null> {
  const result = await db
    .select({
      id: schema.customers.id,
      fullname: schema.customers.fullname,
      email: schema.customers.email,
      phone: schema.customers.phone,
      address: schema.customers.address,
      isActive: schema.customers.isActive,
      organizationId: schema.customers.organizationId,
      branchId: schema.customers.branchId,
      createdAt: schema.customers.createdAt,
      updatedAt: schema.customers.updatedAt,
      branchIdRel: schema.branches.id,
      branchName: schema.branches.name,
    })
    .from(schema.customers)
    .leftJoin(schema.branches, eq(schema.branches.id, schema.customers.branchId))
    .where(eq(schema.customers.id, id))
    .limit(1)

  const row = result[0]
  if (!row) return null

  return {
    id: row.id,
    fullname: row.fullname,
    email: row.email,
    phone: row.phone,
    address: row.address,
    isActive: row.isActive,
    organizationId: row.organizationId,
    branchId: row.branchId,
    branch: {
      id: row.branchIdRel ?? row.branchId,
      name: row.branchName ?? '',
    },
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export type ListCustomersFilters = {
  search?: string
  isActive?: boolean
}

async function enrich(
  row: {
    id: string
    fullname: string
    email: string | null
    phone: string | null
    address: string | null
    isActive: boolean
    organizationId: string
    branchId: string
    createdAt: Date
    updatedAt: Date
    branchIdRel?: string | null
    branchName?: string | null
  },
): Promise<CustomerWithRelations> {
  return {
    id: row.id,
    fullname: row.fullname,
    email: row.email,
    phone: row.phone,
    address: row.address,
    isActive: row.isActive,
    organizationId: row.organizationId,
    branchId: row.branchId,
    branch: {
      id: row.branchIdRel ?? row.branchId,
      name: row.branchName ?? '',
    },
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export async function findCustomersByOrganization(
  db: DB,
  organizationId: string,
  branchId: string | null,
  filters: ListCustomersFilters,
  limit: number,
  offset: number,
): Promise<CustomerWithRelations[]> {
  const conditions: SQL[] = [eq(schema.customers.organizationId, organizationId)]
  if (branchId) {
    conditions.push(eq(schema.customers.branchId, branchId))
  }
  if (filters.isActive !== undefined) {
    conditions.push(eq(schema.customers.isActive, filters.isActive))
  }
  if (filters.search) {
    const pattern = `%${filters.search}%`
    conditions.push(
      or(
        ilike(schema.customers.fullname, pattern),
        ilike(schema.customers.email, pattern),
        ilike(schema.customers.phone, pattern),
      )!,
    )
  }

  const rows = await db
    .select({
      id: schema.customers.id,
      fullname: schema.customers.fullname,
      email: schema.customers.email,
      phone: schema.customers.phone,
      address: schema.customers.address,
      isActive: schema.customers.isActive,
      organizationId: schema.customers.organizationId,
      branchId: schema.customers.branchId,
      createdAt: schema.customers.createdAt,
      updatedAt: schema.customers.updatedAt,
      branchIdRel: schema.branches.id,
      branchName: schema.branches.name,
    })
    .from(schema.customers)
    .leftJoin(schema.branches, eq(schema.branches.id, schema.customers.branchId))
    .where(and(...conditions))
    .orderBy(schema.customers.fullname)
    .limit(limit)
    .offset(offset)

  return Promise.all(rows.map(enrich))
}

export async function findCustomersByBranch(
  db: DB,
  branchId: string,
  filters: ListCustomersFilters,
  limit: number,
  offset: number,
): Promise<CustomerWithRelations[]> {
  const conditions: SQL[] = [eq(schema.customers.branchId, branchId)]
  if (filters.isActive !== undefined) {
    conditions.push(eq(schema.customers.isActive, filters.isActive))
  }
  if (filters.search) {
    const pattern = `%${filters.search}%`
    conditions.push(
      or(
        ilike(schema.customers.fullname, pattern),
        ilike(schema.customers.email, pattern),
        ilike(schema.customers.phone, pattern),
      )!,
    )
  }

  const rows = await db
    .select({
      id: schema.customers.id,
      fullname: schema.customers.fullname,
      email: schema.customers.email,
      phone: schema.customers.phone,
      address: schema.customers.address,
      isActive: schema.customers.isActive,
      organizationId: schema.customers.organizationId,
      branchId: schema.customers.branchId,
      createdAt: schema.customers.createdAt,
      updatedAt: schema.customers.updatedAt,
      branchIdRel: schema.branches.id,
      branchName: schema.branches.name,
    })
    .from(schema.customers)
    .leftJoin(schema.branches, eq(schema.branches.id, schema.customers.branchId))
    .where(and(...conditions))
    .orderBy(schema.customers.fullname)
    .limit(limit)
    .offset(offset)

  return Promise.all(rows.map(enrich))
}

export async function countCustomersByOrganization(
  db: DB,
  organizationId: string,
  branchId: string | null,
  filters: ListCustomersFilters,
): Promise<number> {
  const conditions: SQL[] = [eq(schema.customers.organizationId, organizationId)]
  if (branchId) {
    conditions.push(eq(schema.customers.branchId, branchId))
  }
  if (filters.isActive !== undefined) {
    conditions.push(eq(schema.customers.isActive, filters.isActive))
  }
  if (filters.search) {
    const pattern = `%${filters.search}%`
    conditions.push(
      or(
        ilike(schema.customers.fullname, pattern),
        ilike(schema.customers.email, pattern),
        ilike(schema.customers.phone, pattern),
      )!,
    )
  }

  const result = await db
    .select({ value: count() })
    .from(schema.customers)
    .where(and(...conditions))
  return result[0]?.value ?? 0
}

export async function countCustomersByBranch(
  db: DB,
  branchId: string,
  filters: ListCustomersFilters,
): Promise<number> {
  const conditions: SQL[] = [eq(schema.customers.branchId, branchId)]
  if (filters.isActive !== undefined) {
    conditions.push(eq(schema.customers.isActive, filters.isActive))
  }
  if (filters.search) {
    const pattern = `%${filters.search}%`
    conditions.push(
      or(
        ilike(schema.customers.fullname, pattern),
        ilike(schema.customers.email, pattern),
        ilike(schema.customers.phone, pattern),
      )!,
    )
  }

  const result = await db
    .select({ value: count() })
    .from(schema.customers)
    .where(and(...conditions))
  return result[0]?.value ?? 0
}

export async function findActiveCustomerByEmailInOrganization(
  db: DB,
  organizationId: string,
  email: string,
  excludeId?: string,
): Promise<{ id: string } | null> {
  const conditions = [
    eq(schema.customers.organizationId, organizationId),
    eq(schema.customers.email, email),
    eq(schema.customers.isActive, true),
  ]
  if (excludeId) conditions.push(ne(schema.customers.id, excludeId))
  const result = await db
    .select({ id: schema.customers.id })
    .from(schema.customers)
    .where(and(...conditions))
    .limit(1)
  return result[0] ?? null
}

export async function findActiveCustomerByPhoneInOrganization(
  db: DB,
  organizationId: string,
  phone: string,
  excludeId?: string,
): Promise<{ id: string } | null> {
  const conditions = [
    eq(schema.customers.organizationId, organizationId),
    eq(schema.customers.phone, phone),
    eq(schema.customers.isActive, true),
  ]
  if (excludeId) conditions.push(ne(schema.customers.id, excludeId))
  const result = await db
    .select({ id: schema.customers.id })
    .from(schema.customers)
    .where(and(...conditions))
    .limit(1)
  return result[0] ?? null
}

export async function findBranchByIdRaw(db: DB, id: string) {
  const result = await db
    .select()
    .from(schema.branches)
    .where(and(eq(schema.branches.id, id), isNull(schema.branches.deletedAt)))
    .limit(1)
  return result[0] ?? null
}

export async function createCustomer(
  db: DB,
  data: typeof schema.customers.$inferInsert,
) {
  const result = await db.insert(schema.customers).values(data).returning()
  return result[0]
}

export async function updateCustomer(
  db: DB,
  id: string,
  data: Partial<typeof schema.customers.$inferInsert>,
) {
  const result = await db
    .update(schema.customers)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(schema.customers.id, id))
    .returning()
  return result[0] ?? null
}

export async function softDeleteCustomer(db: DB, id: string) {
  const result = await db
    .update(schema.customers)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(schema.customers.id, id))
    .returning({ id: schema.customers.id })
  return result[0] ?? null
}
