import type { ExternalDataSourceType } from "../domain/external-data.entity";

export type MergedExternalData = {
  type: ExternalDataSourceType;
  fetchedAt: string;
  payload: unknown;
};

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

  return {
    type: sourceType,
    fetchedAt: fetchedAt.toISOString(),
    payload: rawData,
  };
}
