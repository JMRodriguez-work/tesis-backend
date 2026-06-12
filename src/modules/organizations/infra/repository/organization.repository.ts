import type { DB } from '../../../../shared/db'
import * as schema from '../../../../shared/db/schema'

export const organizationTable = schema.organizations

export async function createOrganization(
  db: DB,
  data: typeof schema.organizations.$inferInsert,
) {
  const result = await db.insert(schema.organizations).values(data).returning()
  return result[0]
}
