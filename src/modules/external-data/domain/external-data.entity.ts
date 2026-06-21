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
};

export type FetchExternalDataResult = {
  sourceId: string;
  updated: boolean;
  fetchedAt: Date;
};
