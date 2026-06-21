import { ApiError } from "../../../shared/http/api-response";
import type { DB } from "../../../shared/db";
import * as schema from "../../../shared/db/schema";
import {
  findSourceById,
  findSourceByName,
  updateSource,
} from "../infra/repository/external-data.repository";
import type { ExternalDataSourceRow } from "../domain/external-data.entity";

export type UpdateExternalDataSourceInput = {
  id: string;
  name?: string;
  type?: typeof schema.externalDataSources.$inferInsert.type;
  url?: string | null;
  authConfig?:
    | { headers?: Record<string, string>; queryParams?: Record<string, string> }
    | null;
  isActive?: boolean;
};

export class UpdateExternalDataSource {
  constructor(private readonly db: DB) {}

  async execute(input: UpdateExternalDataSourceInput): Promise<ExternalDataSourceRow> {
    const current = await findSourceById(this.db, input.id);
    if (!current) {
      throw new ApiError("Fuente externa no encontrada", 404);
    }

    if (input.name && input.name !== current.name) {
      const clash = await findSourceByName(this.db, input.name);
      if (clash && clash.id !== input.id) {
        throw new ApiError(
          `Ya existe una fuente con el nombre "${input.name}"`,
          400,
        );
      }
    }

    const patch: Partial<typeof schema.externalDataSources.$inferInsert> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.type !== undefined) patch.type = input.type;
    if (input.url !== undefined) patch.url = input.url;
    if (input.authConfig !== undefined) {
      patch.authConfig = (input.authConfig ?? null) as never;
    }
    if (input.isActive !== undefined) patch.isActive = input.isActive;

    const updated = await updateSource(this.db, input.id, patch);
    if (!updated) {
      throw new ApiError("Fuente externa no encontrada", 404);
    }
    return updated;
  }
}
