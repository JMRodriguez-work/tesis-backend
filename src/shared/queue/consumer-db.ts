import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import type { Env } from "../env";
import { configureNeonForLocalProxy } from "../db/neon-config";
import * as schema from "../db/schema";

export function createConsumerDb(env: Env) {
  configureNeonForLocalProxy(env.LOCAL_DB_PROXY);
  const pool = new Pool({ connectionString: env.DATABASE_URL });
  const db = drizzle(pool, { schema });
  return { db, pool };
}

export async function closeConsumerDb(pool: Pool) {
  try {
    await pool.end();
  } catch (err) {
    console.error("Failed to close consumer pool", err);
  }
}

export { schema };
