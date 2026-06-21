import type {
  ExternalDataSourceType,
  MergedExternalData,
} from "../../../domain/external-data.entity";
import { mergeIndecIpc } from "./wholesale-prices.indec";
import { mergeSeasonality } from "./seasonality";
import { mergeSearchTrends } from "./search-trends";

/**
 * Dispatches to the right parser based on source type. Throws if the type
 * is unknown (defensive — the Zod enum should prevent this) or if the
 * parser itself fails (shape mismatch, etc.).
 */
export function mergeExternalDataByType(
  type: ExternalDataSourceType,
  raw: unknown,
  fetchedAt: Date,
): MergedExternalData {
  switch (type) {
    case "wholesale_prices":
      return mergeIndecIpc(raw, fetchedAt);
    case "seasonality":
      return mergeSeasonality(raw, fetchedAt);
    case "search_trends":
      return mergeSearchTrends(raw, fetchedAt);
    default: {
      const _exhaustive: never = type;
      void _exhaustive;
      throw new Error(`Unknown external data source type: ${String(type)}`);
    }
  }
}
