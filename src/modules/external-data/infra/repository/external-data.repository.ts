import { and, count, desc, eq, isNotNull, isNull, type SQL } from "drizzle-orm";
import type { DB } from "../../../../shared/db";
import * as schema from "../../../../shared/db/schema";
import type {
  AuthConfig,
  ExternalDataSourceRow,
  ExternalDataSourceType,
} from "../../domain/external-data.entity";

export const externalDataSourceTable = schema.externalDataSources;

export function externalDataSourceIdEq(id: string) {
  return eq(schema.externalDataSources.id, id);
}

type ListFilters = {
  isActive?: boolean;
  type?: ExternalDataSourceType;
};

type ListOptions = {
  limit?: number;
  offset?: number;
};

export async function findAllSources(
  db: DB,
  filters: ListFilters = {},
  options: ListOptions = {},
): Promise<ExternalDataSourceRow[]> {
  const conditions: SQL[] = [];
  if (filters.isActive !== undefined) {
    conditions.push(eq(schema.externalDataSources.isActive, filters.isActive));
  }
  if (filters.type) {
    conditions.push(eq(schema.externalDataSources.type, filters.type));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const query = db
    .select({
      id: schema.externalDataSources.id,
      name: schema.externalDataSources.name,
      type: schema.externalDataSources.type,
      url: schema.externalDataSources.url,
      lastFetchedAt: schema.externalDataSources.lastFetchedAt,
      data: schema.externalDataSources.data,
      isActive: schema.externalDataSources.isActive,
      lastError: schema.externalDataSources.lastError,
      lastErrorAt: schema.externalDataSources.lastErrorAt,
      authConfig: schema.externalDataSources.authConfig,
    })
    .from(schema.externalDataSources)
    .where(where)
    .orderBy(schema.externalDataSources.name);

  if (options.limit !== undefined) {
    query.limit(options.limit);
  }
  if (options.offset !== undefined) {
    query.offset(options.offset);
  }

  const rows = await query;

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type as ExternalDataSourceRow["type"],
    url: r.url,
    lastFetchedAt: r.lastFetchedAt,
    data: r.data,
    isActive: r.isActive,
    lastError: r.lastError,
    lastErrorAt: r.lastErrorAt,
    authConfig: (r.authConfig as AuthConfig | null) ?? null,
  }));
}

export async function findActiveSources(db: DB): Promise<ExternalDataSourceRow[]> {
  return findAllSources(db, { isActive: true });
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
      isActive: schema.externalDataSources.isActive,
      lastError: schema.externalDataSources.lastError,
      lastErrorAt: schema.externalDataSources.lastErrorAt,
      authConfig: schema.externalDataSources.authConfig,
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
    isActive: row.isActive,
    lastError: row.lastError,
    lastErrorAt: row.lastErrorAt,
    authConfig: (row.authConfig as AuthConfig | null) ?? null,
  };
}

export async function findSourceByName(
  db: DB,
  name: string,
): Promise<ExternalDataSourceRow | null> {
  const rows = await db
    .select({
      id: schema.externalDataSources.id,
      name: schema.externalDataSources.name,
      type: schema.externalDataSources.type,
      url: schema.externalDataSources.url,
      lastFetchedAt: schema.externalDataSources.lastFetchedAt,
      data: schema.externalDataSources.data,
      isActive: schema.externalDataSources.isActive,
      lastError: schema.externalDataSources.lastError,
      lastErrorAt: schema.externalDataSources.lastErrorAt,
      authConfig: schema.externalDataSources.authConfig,
    })
    .from(schema.externalDataSources)
    .where(eq(schema.externalDataSources.name, name))
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
    isActive: row.isActive,
    lastError: row.lastError,
    lastErrorAt: row.lastErrorAt,
    authConfig: (row.authConfig as AuthConfig | null) ?? null,
  };
}

export async function countSources(
  db: DB,
  filters: ListFilters = {},
): Promise<number> {
  const conditions: SQL[] = [];
  if (filters.isActive !== undefined) {
    conditions.push(eq(schema.externalDataSources.isActive, filters.isActive));
  }
  if (filters.type) {
    conditions.push(eq(schema.externalDataSources.type, filters.type));
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const result = await db
    .select({ value: count() })
    .from(schema.externalDataSources)
    .where(where);
  return result[0]?.value ?? 0;
}

export async function createSource(
  db: DB,
  data: typeof schema.externalDataSources.$inferInsert,
): Promise<ExternalDataSourceRow | null> {
  const result = await db
    .insert(schema.externalDataSources)
    .values(data)
    .returning();
  const row = result[0];
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    type: row.type as ExternalDataSourceRow["type"],
    url: row.url,
    lastFetchedAt: row.lastFetchedAt,
    data: row.data,
    isActive: row.isActive,
    lastError: row.lastError,
    lastErrorAt: row.lastErrorAt,
    authConfig: (row.authConfig as AuthConfig | null) ?? null,
  };
}

export async function updateSource(
  db: DB,
  id: string,
  data: Partial<typeof schema.externalDataSources.$inferInsert>,
): Promise<ExternalDataSourceRow | null> {
  const result = await db
    .update(schema.externalDataSources)
    .set(data)
    .where(eq(schema.externalDataSources.id, id))
    .returning();
  const row = result[0];
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    type: row.type as ExternalDataSourceRow["type"],
    url: row.url,
    lastFetchedAt: row.lastFetchedAt,
    data: row.data,
    isActive: row.isActive,
    lastError: row.lastError,
    lastErrorAt: row.lastErrorAt,
    authConfig: (row.authConfig as AuthConfig | null) ?? null,
  };
}

export async function softDeleteSource(
  db: DB,
  id: string,
): Promise<boolean> {
  const result = await db
    .update(schema.externalDataSources)
    .set({ isActive: false })
    .where(
      and(
        eq(schema.externalDataSources.id, id),
        eq(schema.externalDataSources.isActive, true),
      ),
    )
    .returning({ id: schema.externalDataSources.id });
  return result.length > 0;
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
      lastError: null,
      lastErrorAt: null,
    })
    .where(eq(schema.externalDataSources.id, sourceId))
    .returning({
      id: schema.externalDataSources.id,
      lastFetchedAt: schema.externalDataSources.lastFetchedAt,
    });
  return result[0] ?? null;
}

export async function setLastError(
  db: DB,
  sourceId: string,
  message: string,
  errorAt: Date,
): Promise<void> {
  await db
    .update(schema.externalDataSources)
    .set({
      lastError: message,
      lastErrorAt: errorAt,
    })
    .where(eq(schema.externalDataSources.id, sourceId));
}

export { isNull };

/**
 * Returns the most recently fetched active source of a given type that has
 * both `data` and `lastFetchedAt` populated. Used by the recommendation
 * engine to enrich `restock` descriptions with context from the latest
 * `wholesale_prices` (INDEC IPC) snapshot.
 *
 * Returns null if no active source of the type has been fetched yet.
 */
export async function findLatestActiveByType(
  db: DB,
  type: ExternalDataSourceType,
): Promise<ExternalDataSourceRow | null> {
  const rows = await db
    .select({
      id: schema.externalDataSources.id,
      name: schema.externalDataSources.name,
      type: schema.externalDataSources.type,
      url: schema.externalDataSources.url,
      lastFetchedAt: schema.externalDataSources.lastFetchedAt,
      data: schema.externalDataSources.data,
      isActive: schema.externalDataSources.isActive,
      lastError: schema.externalDataSources.lastError,
      lastErrorAt: schema.externalDataSources.lastErrorAt,
      authConfig: schema.externalDataSources.authConfig,
    })
    .from(schema.externalDataSources)
    .where(
      and(
        eq(schema.externalDataSources.type, type),
        eq(schema.externalDataSources.isActive, true),
        isNotNull(schema.externalDataSources.lastFetchedAt),
        isNotNull(schema.externalDataSources.data),
      ),
    )
    .orderBy(desc(schema.externalDataSources.lastFetchedAt))
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
    isActive: row.isActive,
    lastError: row.lastError,
    lastErrorAt: row.lastErrorAt,
    authConfig: (row.authConfig as AuthConfig | null) ?? null,
  };
}
