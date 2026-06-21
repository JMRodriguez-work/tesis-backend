import type { MergedExternalData } from "../../../domain/external-data.entity";

/**
 * Parser for search trends (Google Trends, etc.). This is a typed stub:
 * Google Trends requires scraping or unofficial APIs and is out of scope
 * for the TFG. If a source is configured with this type and fetched, the
 * parser throws — the failure is captured in `lastError` and the previous
 * `data` remains intact.
 */
export function mergeSearchTrends(
  _raw: unknown,
  _fetchedAt: Date,
): MergedExternalData {
  throw new Error(
    "search_trends parser not implemented. Configure a wholesale_prices or seasonality source instead.",
  );
}
