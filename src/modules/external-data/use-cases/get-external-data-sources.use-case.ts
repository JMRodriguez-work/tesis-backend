import type { DB } from "../../../shared/db";
import {
  countSources,
  findAllSources,
} from "../infra/repository/external-data.repository";
import type {
  ExternalDataSourceRow,
  ExternalDataSourceType,
} from "../domain/external-data.entity";

export type ListExternalDataSourcesInput = {
  isActive?: boolean;
  type?: ExternalDataSourceType;
};

export type ListExternalDataSourcesResult = {
  data: ExternalDataSourceRow[];
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
    const [data, total] = await Promise.all([
      findAllSources(this.db, filters),
      countSources(this.db, filters),
    ]);
    return { data, meta: { total } };
  }
}
