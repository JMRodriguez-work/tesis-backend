import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "../db/schema";

export function createConsumerDb(connectionString: string) {
  const pool = new Pool({ connectionString });
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
