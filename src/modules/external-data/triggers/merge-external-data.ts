import { mergeExternalDataByType } from "../infra/http/parsers";
import type {
  ExternalDataSourceType,
  MergedExternalData,
} from "../domain/external-data.entity";

/**
 * Parses the raw response of an external data fetch and shapes it into the
 * canonical `MergedExternalData` stored in `external_data_sources.data`.
 *
 * If parsing fails, the error message includes a redacted preview of the raw
 * payload (first ~500 chars) so the failure is debuggable from logs without
 * leaking the full response.
 */
export function mergeExternalData(
  rawData: unknown,
  sourceType: ExternalDataSourceType,
  fetchedAt: Date,
): MergedExternalData {
  if (rawData === null || typeof rawData !== "object") {
    throw new Error(
      `External data payload must be a JSON object or array (got ${typeof rawData})`,
    );
  }
  try {
    return mergeExternalDataByType(sourceType, rawData, fetchedAt);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const preview = JSON.stringify(rawData).slice(0, 500);
    throw new Error(
      `Parse error (type=${sourceType}): ${message} | rawPreview=${preview}`,
    );
  }
}

export type { MergedExternalData };
