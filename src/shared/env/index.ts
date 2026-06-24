import type { AnalyticsJobMessage } from "../queue/types";

export type Env = {
  DATABASE_URL: string;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;

  /**
   * Comma-separated list of origins allowed by CORS (Hono middleware).
   */
  ALLOWED_ORIGINS: string;

  /**
   * Comma-separated list of origins trusted by Better Auth (sign-in/sign-up origin check).
   */
  FRONTEND_TRUSTED_ORIGINS: string;

  ANALYTICS_QUEUE: Queue<AnalyticsJobMessage>;
  ANALYTICS_DLQ: Queue<AnalyticsJobMessage>;
};
