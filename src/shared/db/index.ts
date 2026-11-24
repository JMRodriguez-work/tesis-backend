import { drizzle } from 'drizzle-orm/neon-serverless'
import { Pool, neonConfig } from '@neondatabase/serverless'
import { createMiddleware } from 'hono/factory'
import * as schema from './schema'
import { configureNeonForLocalProxy } from './neon-config'
import type { Env } from '../env'
import type { Variables } from '../types/app'

export type DB = ReturnType<typeof drizzle<typeof schema>>

/**
 * Crea el pool + Drizzle para un request.
 *
 * Si `env.LOCAL_DB_PROXY` está definido, el driver de Neon conecta al
 * Postgres local a través de wsproxy (modo offline). Si no, conecta a Neon
 * normalmente. Ver LOCAL_DB.md.
 */
export function createDb(env: Env): { db: DB; pool: Pool } {
  configureNeonForLocalProxy(env.LOCAL_DB_PROXY)
  const pool = new Pool({ connectionString: env.DATABASE_URL })
  const db = drizzle(pool, { schema })
  return { db, pool }
}

export { neonConfig }

export const dbMiddleware = createMiddleware<{
  Bindings: Env
  Variables: Variables
}>(async (c, next) => {
  const { db, pool } = createDb(c.env)
  c.set('db', db)
  c.set('pool', pool)
  try {
    await next()
  } finally {
    c.executionCtx.waitUntil(pool.end())
  }
})
