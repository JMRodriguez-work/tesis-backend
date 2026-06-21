import { ApiError } from "../../../shared/http/api-response";
import type { DB } from "../../../shared/db";
import * as schema from "../../../shared/db/schema";
import {
  createSource,
  findSourceByName,
} from "../infra/repository/external-data.repository";
import type { ExternalDataSourceRow } from "../domain/external-data.entity";

export type CreateExternalDataSourceInput = {
  name: string;
  type: typeof schema.externalDataSources.$inferInsert.type;
  url?: string | null;
  authConfig?: { headers?: Record<string, string>; queryParams?: Record<string, string> } | null;
  isActive?: boolean;
};

export class CreateExternalDataSource {
  constructor(private readonly db: DB) {}

  async execute(input: CreateExternalDataSourceInput): Promise<ExternalDataSourceRow> {
    const existing = await findSourceByName(this.db, input.name);
    if (existing) {
      throw new ApiError(
        `Ya existe una fuente con el nombre "${input.name}"`,
        400,
      );
    }

    return createSource(this.db, {
      name: input.name,
      type: input.type,
      url: input.url ?? null,
      authConfig: (input.authConfig ?? null) as never,
      isActive: input.isActive ?? true,
    });
  }
}
