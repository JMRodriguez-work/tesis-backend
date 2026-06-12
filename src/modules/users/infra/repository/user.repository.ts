import { eq } from 'drizzle-orm'
import type { DB } from '../../../../shared/db'
import * as schema from '../../../../shared/db/schema'

export const userTable = schema.user

export function userIdEq(id: string) {
  return eq(schema.user.id, id)
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
    .returning()
  return result[0] ?? null
}
