import type { DB } from '../../../../shared/db'
import * as schema from '../../../../shared/db/schema'

export const branchTable = schema.branches

export async function createBranch(
  db: DB,
  data: typeof schema.branches.$inferInsert,
) {
  const result = await db.insert(schema.branches).values(data).returning()
  return result[0]
}
