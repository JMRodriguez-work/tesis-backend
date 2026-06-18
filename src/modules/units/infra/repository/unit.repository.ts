import { eq } from 'drizzle-orm'
import type { DB } from '../../../../shared/db'
import * as schema from '../../../../shared/db/schema'

export const unitTable = schema.units

export async function findAllUnits(db: DB) {
  return db.select().from(schema.units).orderBy(schema.units.name)
}

export async function findUnitById(db: DB, id: number) {
  const result = await db
    .select()
    .from(schema.units)
    .where(eq(schema.units.id, id))
    .limit(1)
  return result[0] ?? null
}
