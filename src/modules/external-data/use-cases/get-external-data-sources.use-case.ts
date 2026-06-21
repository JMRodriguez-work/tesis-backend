import type { DB } from "../../../shared/db";
import {
  countSources,
  findAllSources,
} from "../infra/repository/external-data.repository";
import type { ExternalDataSourceRow } from "../domain/external-data.entity";

export type GetExternalDataSourcesResult = {
  data: ExternalDataSourceRow[];
  meta: { total: number };
};

export class GetExternalDataSources {
  constructor(private readonly db: DB) {}

  async execute(): Promise<GetExternalDataSourcesResult> {
    const [data, total] = await Promise.all([
      findAllSources(this.db),
      countSources(this.db),
    ]);
    return { data, meta: { total } };
  }
}
