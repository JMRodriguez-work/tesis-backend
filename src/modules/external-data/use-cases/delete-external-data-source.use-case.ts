import { ApiError } from "../../../shared/http/api-response";
import type { DB } from "../../../shared/db";
import {
  findSourceById,
  softDeleteSource,
} from "../infra/repository/external-data.repository";

export type DeleteExternalDataSourceResult = {
  alreadyDeleted: boolean;
};

export class DeleteExternalDataSource {
  constructor(private readonly db: DB) {}

  async execute(id: string): Promise<DeleteExternalDataSourceResult> {
    const existing = await findSourceById(this.db, id);
    if (!existing) {
      throw new ApiError("Fuente externa no encontrada", 404);
    }
    if (!existing.isActive) {
      return { alreadyDeleted: true };
    }
    await softDeleteSource(this.db, id);
    return { alreadyDeleted: false };
  }
}
