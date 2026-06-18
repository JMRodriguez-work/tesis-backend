import { and, eq, isNull } from 'drizzle-orm'
import type { DB } from '../../../../shared/db'
import * as schema from '../../../../shared/db/schema'

export const organizationTable = schema.organizations

export function organizationIdEq(id: string) {
  return eq(schema.organizations.id, id)
}

export async function findOrganizationById(db: DB, id: string) {
  const result = await db
    .select()
    .from(schema.organizations)
    .where(and(eq(schema.organizations.id, id), isNull(schema.organizations.deletedAt)))
    .limit(1)
  return result[0] ?? null
}

export async function createOrganization(
  db: DB,
  data: typeof schema.organizations.$inferInsert,
) {
  const result = await db.insert(schema.organizations).values(data).returning()
  return result[0]
}

export async function updateOrganization(
  db: DB,
  id: string,
  data: Partial<typeof schema.organizations.$inferInsert>,
) {
  const result = await db
    .update(schema.organizations)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(schema.organizations.id, id), isNull(schema.organizations.deletedAt)))
    .returning()
  return result[0] ?? null
}
