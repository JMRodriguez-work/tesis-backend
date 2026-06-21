import { ApiError } from "../../../shared/http/api-response";
import type { DB } from "../../../shared/db";
import {
  findSourceById,
  setLastError,
  upsertSourceData,
} from "../infra/repository/external-data.repository";
import { mergeExternalData } from "../triggers/merge-external-data";
import type {
  AuthConfig,
  FetchExternalDataResult,
} from "../domain/external-data.entity";

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

    if (!source.isActive) {
      throw new ApiError(
        `La fuente "${source.name}" está deshabilitada`,
        400,
      );
    }

    if (!source.url) {
      const now = new Date();
      await setLastError(
        this.db,
        source.id,
        "La fuente no tiene URL configurada",
        now,
      );
      throw new ApiError(
        `La fuente "${source.name}" no tiene URL configurada`,
        400,
      );
    }

    const fetchedAt = new Date();
    let rawData: unknown;
    try {
      rawData = await this.fetchUrl(source.url, source.authConfig);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Fetch failed with unknown error";
      await setLastError(this.db, source.id, message, fetchedAt);
      throw err;
    }

    let merged;
    try {
      merged = mergeExternalData(rawData, source.type, fetchedAt);
    } catch (err) {
      const message =
        err instanceof Error
          ? `Parse error: ${err.message}`
          : "Parse error: unknown";
      await setLastError(this.db, source.id, message, fetchedAt);
      throw err;
    }

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

  private async fetchUrl(url: string, authConfig: AuthConfig | null) {
    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    let finalUrl = url;
    if (authConfig?.headers) {
      Object.assign(headers, authConfig.headers);
    }
    if (authConfig?.queryParams) {
      const u = new URL(url);
      for (const [k, v] of Object.entries(authConfig.queryParams)) {
        u.searchParams.set(k, v);
      }
      finalUrl = u.toString();
    }

    const response = await fetch(finalUrl, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(
        `Fetch failed: ${response.status} ${response.statusText} (url=${finalUrl})`,
      );
    }

    return response.json();
  }
}
