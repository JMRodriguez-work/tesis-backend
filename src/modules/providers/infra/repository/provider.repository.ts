import { and, count, eq, ilike, isNull, ne, or, type SQL } from 'drizzle-orm'
import type { DB } from '../../../../shared/db'
import * as schema from '../../../../shared/db/schema'
import type { ProviderWithRelations } from '../../domain/provider.entity'

export const providerTable = schema.providers

export type ListProvidersFilters = {
  search?: string
  isActive?: boolean
}

export async function findProviderByIdRaw(db: DB, id: string) {
  const result = await db
    .select()
    .from(providerTable)
    .where(eq(providerTable.id, id))
    .limit(1)
  return result[0] ?? null
}

export async function findProviderById(
  db: DB,
  id: string,
): Promise<ProviderWithRelations | null> {
  const result = await db
    .select()
    .from(providerTable)
    .where(and(eq(providerTable.id, id), isNull(providerTable.deletedAt)))
    .limit(1)
  const row = result[0]
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    companyName: row.companyName,
    contactName: row.contactName,
    contactEmail: row.contactEmail,
    contactPhone: row.contactPhone,
    isActive: row.isActive,
    organizationId: row.organizationId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export async function findProvidersByOrganization(
  db: DB,
  organizationId: string,
  filters: ListProvidersFilters,
  limit: number,
  offset: number,
): Promise<ProviderWithRelations[]> {
  const conditions: SQL[] = [
    eq(providerTable.organizationId, organizationId),
    isNull(providerTable.deletedAt),
  ]
  if (filters.isActive !== undefined) {
    conditions.push(eq(providerTable.isActive, filters.isActive))
  }
  if (filters.search) {
    const pattern = `%${filters.search}%`
    conditions.push(
      or(
        ilike(providerTable.name, pattern),
        ilike(providerTable.companyName, pattern),
        ilike(providerTable.contactName, pattern),
      )!,
    )
  }

  const rows = await db
    .select()
    .from(providerTable)
    .where(and(...conditions))
    .orderBy(providerTable.name)
    .limit(limit)
    .offset(offset)

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    companyName: r.companyName,
    contactName: r.contactName,
    contactEmail: r.contactEmail,
    contactPhone: r.contactPhone,
    isActive: r.isActive,
    organizationId: r.organizationId,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }))
}

export async function countProvidersByOrganization(
  db: DB,
  organizationId: string,
  filters: ListProvidersFilters,
): Promise<number> {
  const conditions: SQL[] = [
    eq(providerTable.organizationId, organizationId),
    isNull(providerTable.deletedAt),
  ]
  if (filters.isActive !== undefined) {
    conditions.push(eq(providerTable.isActive, filters.isActive))
  }
  if (filters.search) {
    const pattern = `%${filters.search}%`
    conditions.push(
      or(
        ilike(providerTable.name, pattern),
        ilike(providerTable.companyName, pattern),
        ilike(providerTable.contactName, pattern),
      )!,
    )
  }

  const result = await db
    .select({ value: count() })
    .from(providerTable)
    .where(and(...conditions))
  return result[0]?.value ?? 0
}

export async function findActiveProviderByNameInOrganization(
  db: DB,
  organizationId: string,
  name: string,
  excludeId?: string,
): Promise<{ id: string } | null> {
  const conditions = [
    eq(providerTable.organizationId, organizationId),
    eq(providerTable.name, name),
    isNull(providerTable.deletedAt),
  ]
  if (excludeId) conditions.push(ne(providerTable.id, excludeId))
  const result = await db
    .select({ id: providerTable.id })
    .from(providerTable)
    .where(and(...conditions))
    .limit(1)
  return result[0] ?? null
}

export async function createProvider(
  db: DB,
  data: typeof schema.providers.$inferInsert,
) {
  const result = await db.insert(providerTable).values(data).returning()
  return result[0]
}

export async function updateProvider(
  db: DB,
  id: string,
  data: Partial<typeof schema.providers.$inferInsert>,
) {
  const result = await db
    .update(providerTable)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(providerTable.id, id), isNull(providerTable.deletedAt)))
    .returning()
  return result[0] ?? null
}

export async function softDeleteProvider(db: DB, id: string) {
  const result = await db
    .update(providerTable)
    .set({ deletedAt: new Date(), isActive: false, updatedAt: new Date() })
    .where(and(eq(providerTable.id, id), isNull(providerTable.deletedAt)))
    .returning({ id: providerTable.id })
  return result[0] ?? null
}

/**
 * Count of non-cancelled provider orders for a provider.
 * Used to block soft-delete when there are still active orders.
 */
export async function countActiveProviderOrdersByProvider(
  db: DB,
  providerId: string,
): Promise<number> {
  const result = await db
    .select({ value: count() })
    .from(schema.providerOrders)
    .where(
      and(
        eq(schema.providerOrders.providerId, providerId),
        ne(schema.providerOrders.status, 'cancelled'),
      ),
    )
  return result[0]?.value ?? 0
}
