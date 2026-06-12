import { drizzle } from 'drizzle-orm/neon-serverless'
import { Pool, neonConfig } from '@neondatabase/serverless'
import { createMiddleware } from 'hono/factory'
import * as schema from './schema'
import type { Env } from '../env'
import type { Variables } from '../types/app'

export type DB = ReturnType<typeof drizzle<typeof schema>>

export function createDb(connectionString: string): { db: DB; pool: Pool } {
  const pool = new Pool({ connectionString })
  const db = drizzle(pool, { schema })
  return { db, pool }
}

export { neonConfig }

export const dbMiddleware = createMiddleware<{
  Bindings: Env
  Variables: Variables
}>(async (c, next) => {
  const { db, pool } = createDb(c.env.DATABASE_URL)
  c.set('db', db)
  c.set('pool', pool)
  try {
    await next()
  } finally {
    c.executionCtx.waitUntil(pool.end())
  }
})
