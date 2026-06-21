import type { Pool } from "@neondatabase/serverless";
import type { Env } from "../../env";
import type { GenerateSeasonalRecommendationsMessage } from "../types";
import { closeConsumerDb, createConsumerDb } from "../consumer-db";

/**
 * Handler stub for `generate-seasonal-recommendations`. Phase 3.5-A
 * establishes the queue plumbing (4th job type, dispatcher routing, cron
 * enqueue) but defers the real logic — cross-referencing the latest
 * `seasonality` data with the catalog to produce `seasonal` recommendations
 * — to Phase 3.5-B.
 *
 * Idempotent: re-running with the same jobId is a no-op.
 */
export async function handleGenerateSeasonalRecommendations(
  msg: GenerateSeasonalRecommendationsMessage,
  env: Env,
): Promise<void> {
  let pool: Pool | null = null;
  try {
    const created = createConsumerDb(env.DATABASE_URL);
    pool = created.pool;
    console.log(
      `[generate-seasonal-recommendations] jobId=${msg.jobId} orgId=${msg.organizationId ?? "*"} branchId=${msg.branchId ?? "*"} triggeredBy=${msg.triggeredBy} (stub — real logic in 3.5-B)`,
    );
  } finally {
    if (pool) {
      await closeConsumerDb(pool);
    }
  }
}
