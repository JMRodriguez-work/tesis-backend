import type { AnalyticsJobMessage } from "../queue/types";

export type Env = {
  DATABASE_URL: string;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;

  ANALYTICS_QUEUE: Queue<AnalyticsJobMessage>;
  ANALYTICS_DLQ: Queue<AnalyticsJobMessage>;
};
