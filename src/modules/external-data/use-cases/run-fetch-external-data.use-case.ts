import { ApiError } from "../../../shared/http/api-response";
import type { DB } from "../../../shared/db";
import {
  findSourceById,
  upsertSourceData,
} from "../infra/repository/external-data.repository";
import { mergeExternalData } from "../triggers/merge-external-data";
import type { FetchExternalDataResult } from "../domain/external-data.entity";

const FETCH_TIMEOUT_MS = 8000;

export type RunFetchExternalDataInput = {
  sourceId: string;
};

export class RunFetchExternalData {
  constructor(private readonly db: DB) {}

  async execute(
    input: RunFetchExternalDataInput,
  ): Promise<FetchExternalDataResult> {
    const source = await findSourceById(this.db, input.sourceId);
    if (!source) {
      throw new ApiError(
        `La fuente externa ${input.sourceId} no existe`,
        404,
      );
    }

    if (!source.url) {
      throw new ApiError(
        `La fuente "${source.name}" no tiene URL configurada`,
        400,
      );
    }

    const response = await fetch(source.url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(
        `Fetch failed for source "${source.name}" (${source.url}): ${response.status} ${response.statusText}`,
      );
    }

    let rawData: unknown;
    try {
      rawData = await response.json();
    } catch (err) {
      throw new Error(
        `Fetch returned invalid JSON for source "${source.name}": ${(err as Error).message}`,
      );
    }

    const fetchedAt = new Date();
    const merged = mergeExternalData(rawData, source.type, fetchedAt);

    const updated = await upsertSourceData(
      this.db,
      source.id,
      merged,
      fetchedAt,
    );
    if (!updated) {
      throw new ApiError(
        `No se pudo actualizar la fuente ${source.id}`,
        500,
      );
    }

    return {
      sourceId: source.id,
      updated: true,
      fetchedAt,
    };
  }
}
