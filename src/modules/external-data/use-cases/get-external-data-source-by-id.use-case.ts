import type { DB } from "../../../shared/db";
import { findSourceById } from "../infra/repository/external-data.repository";
import type { ExternalDataSourceRow } from "../domain/external-data.entity";

export class GetExternalDataSourceById {
  constructor(private readonly db: DB) {}

  async execute(id: string): Promise<ExternalDataSourceRow | null> {
    return findSourceById(this.db, id);
  }
}
