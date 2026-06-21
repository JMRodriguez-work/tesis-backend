import type { DB } from "../../../shared/db";
import {
  countSources,
  findAllSources,
} from "../infra/repository/external-data.repository";
import {
  sanitizeAuthConfig,
  type ExternalDataSourceType,
  type SanitizedAuthConfig,
} from "../domain/external-data.entity";

export type ListExternalDataSourcesInput = {
  isActive?: boolean;
  type?: ExternalDataSourceType;
};

export type SanitizedExternalDataSourceRow = {
  id: string;
  name: string;
  type: ExternalDataSourceType;
  url: string | null;
  lastFetchedAt: Date | null;
  data: unknown;
  isActive: boolean;
  lastError: string | null;
  lastErrorAt: Date | null;
  authConfig: SanitizedAuthConfig | null;
};

export type ListExternalDataSourcesResult = {
  data: SanitizedExternalDataSourceRow[];
  meta: { total: number };
};

export class ListExternalDataSources {
  constructor(private readonly db: DB) {}

  async execute(
    input: ListExternalDataSourcesInput = {},
  ): Promise<ListExternalDataSourcesResult> {
    const filters = {
      isActive: input.isActive,
      type: input.type,
    };
    const [rows, total] = await Promise.all([
      findAllSources(this.db, filters),
      countSources(this.db, filters),
    ]);
    const data = rows.map((row) => ({
      ...row,
      authConfig: sanitizeAuthConfig(row.authConfig),
    }));
    return { data, meta: { total } };
  }
}
