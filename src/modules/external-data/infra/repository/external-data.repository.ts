import { and, eq, count } from "drizzle-orm";
import type { DB } from "../../../../shared/db";
import * as schema from "../../../../shared/db/schema";
import type { ExternalDataSourceRow } from "../../domain/external-data.entity";

export const externalDataSourceTable = schema.externalDataSources;

export function externalDataSourceIdEq(id: string) {
  return eq(schema.externalDataSources.id, id);
}

export async function findAllSources(db: DB): Promise<ExternalDataSourceRow[]> {
  const rows = await db
    .select({
      id: schema.externalDataSources.id,
      name: schema.externalDataSources.name,
      type: schema.externalDataSources.type,
      url: schema.externalDataSources.url,
      lastFetchedAt: schema.externalDataSources.lastFetchedAt,
      data: schema.externalDataSources.data,
    })
    .from(schema.externalDataSources)
    .orderBy(schema.externalDataSources.name);

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type as ExternalDataSourceRow["type"],
    url: r.url,
    lastFetchedAt: r.lastFetchedAt,
    data: r.data,
  }));
}

export async function findSourceById(
  db: DB,
  id: string,
): Promise<ExternalDataSourceRow | null> {
  const rows = await db
    .select({
      id: schema.externalDataSources.id,
      name: schema.externalDataSources.name,
      type: schema.externalDataSources.type,
      url: schema.externalDataSources.url,
      lastFetchedAt: schema.externalDataSources.lastFetchedAt,
      data: schema.externalDataSources.data,
    })
    .from(schema.externalDataSources)
    .where(eq(schema.externalDataSources.id, id))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    type: row.type as ExternalDataSourceRow["type"],
    url: row.url,
    lastFetchedAt: row.lastFetchedAt,
    data: row.data,
  };
}

export async function countSources(db: DB): Promise<number> {
  const result = await db
    .select({ value: count() })
    .from(schema.externalDataSources);
  return result[0]?.value ?? 0;
}

export async function upsertSourceData(
  db: DB,
  sourceId: string,
  data: unknown,
  fetchedAt: Date,
): Promise<{ id: string; lastFetchedAt: Date | null } | null> {
  const result = await db
    .update(schema.externalDataSources)
    .set({
      data: data as never,
      lastFetchedAt: fetchedAt,
    })
    .where(eq(schema.externalDataSources.id, sourceId))
    .returning({
      id: schema.externalDataSources.id,
      lastFetchedAt: schema.externalDataSources.lastFetchedAt,
    });
  return result[0] ?? null;
}

// Re-export for use within transactions
export { and };
