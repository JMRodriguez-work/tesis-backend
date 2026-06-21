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
