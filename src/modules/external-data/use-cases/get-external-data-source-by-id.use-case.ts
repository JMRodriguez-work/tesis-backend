import type { DB } from "../../../shared/db";
import { findSourceById } from "../infra/repository/external-data.repository";
import {
  sanitizeAuthConfig,
  type ExternalDataSourceRow,
  type SanitizedAuthConfig,
} from "../domain/external-data.entity";

export type SanitizedExternalDataSourceRow = Omit<
  ExternalDataSourceRow,
  "authConfig"
> & {
  authConfig: SanitizedAuthConfig | null;
};

export class GetExternalDataSourceById {
  constructor(private readonly db: DB) {}

  async execute(id: string): Promise<SanitizedExternalDataSourceRow | null> {
    const source = await findSourceById(this.db, id);
    if (!source) return null;
    return { ...source, authConfig: sanitizeAuthConfig(source.authConfig) };
  }
}
