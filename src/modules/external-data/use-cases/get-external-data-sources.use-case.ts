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
  page?: number;
  limit?: number;
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
  meta: { page: number; limit: number; total: number; totalPages: number };
};

export class ListExternalDataSources {
  constructor(private readonly db: DB) {}

  async execute(
    input: ListExternalDataSourcesInput = {},
  ): Promise<ListExternalDataSourcesResult> {
    const page = input.page ?? 1;
    const limit = Math.min(input.limit ?? 20, 100);
    const offset = (page - 1) * limit;

    const filters = {
      isActive: input.isActive,
      type: input.type,
    };

    const [rows, total] = await Promise.all([
      findAllSources(this.db, filters, { limit, offset }),
      countSources(this.db, filters),
    ]);

    const data = rows.map((row) => ({
      ...row,
      authConfig: sanitizeAuthConfig(row.authConfig),
    }));

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }
}
