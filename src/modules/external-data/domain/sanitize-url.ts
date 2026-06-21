/**
 * Sanitizes a URL for inclusion in error messages, log statements, and
 * `lastError` rows in the database.
 *
 * The risk: an external source's `authConfig` (read from DB) can include
 * `queryParams` with API keys, bearer tokens, etc. If we ever log the full
 * URL (with query string) on a fetch failure, we'd leak those secrets to:
 *   - Cloudflare Workers stdout (Logflare)
 *   - The `lastError` column in `external_data_sources` (visible to Admin)
 *
 * This helper strips the query string entirely. For headers (separate from
 * URL), the caller is responsible for not logging them — this helper only
 * handles URLs.
 *
 * The shape returned keeps the host + path, which is enough to identify
 * the endpoint for debugging without leaking credentials.
 */
export function sanitizeUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}${u.pathname}`;
  } catch {
    // Not a valid URL (e.g. malformed by source). Strip everything after '?'.
    const qIdx = url.indexOf("?");
    return qIdx === -1 ? url : url.slice(0, qIdx);
  }
}
