import { drizzle } from 'drizzle-orm/neon-http'
import { neon } from '@neondatabase/serverless'
import * as schema from './schema'
import type { Env } from '../env'

export type DB = ReturnType<typeof getDb>

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null

export function getDb(env: Env) {
  if (!_db) {
    _db = drizzle(neon(env.DATABASE_URL), { schema })
  }
  return _db
}
