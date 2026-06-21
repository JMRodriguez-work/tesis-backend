import { mergeExternalDataByType } from "../infra/http/parsers";
import type {
  ExternalDataSourceType,
  MergedExternalData,
} from "../domain/external-data.entity";

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
  return mergeExternalDataByType(sourceType, rawData, fetchedAt);
}

export type { MergedExternalData };
