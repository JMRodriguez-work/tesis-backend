export type ExternalDataSourceType =
  | "search_trends"
  | "wholesale_prices"
  | "seasonality";

export type ExternalDataSourceRow = {
  id: string;
  name: string;
  type: ExternalDataSourceType;
  url: string | null;
  lastFetchedAt: Date | null;
  data: unknown;
  isActive: boolean;
  lastError: string | null;
  lastErrorAt: Date | null;
  authConfig: AuthConfig | null;
};

export type AuthConfig = {
  headers?: Record<string, string>;
  queryParams?: Record<string, string>;
};

export type SanitizedAuthConfig = {
  hasHeaders: boolean;
  hasQueryParams: boolean;
};

export function sanitizeAuthConfig(
  config: AuthConfig | null,
): SanitizedAuthConfig | null {
  if (!config) return null;
  return {
    hasHeaders: !!config.headers && Object.keys(config.headers).length > 0,
    hasQueryParams:
      !!config.queryParams && Object.keys(config.queryParams).length > 0,
  };
}

export type MergedExternalData = {
  type: ExternalDataSourceType;
  fetchedAt: string;
  payload: unknown;
};

export type FetchExternalDataResult = {
  sourceId: string;
  updated: boolean;
  fetchedAt: Date;
};
