import type { Pool } from "@neondatabase/serverless";
import type { Env } from "../../env";
import type { GenerateSeasonalRecommendationsMessage } from "../types";
import { closeConsumerDb, createConsumerDb } from "../consumer-db";
import { GenerateSeasonalRecommendations } from "../../../modules/recommendations/use-cases/run-generate-seasonal.use-case";

export async function handleGenerateSeasonalRecommendations(
  msg: GenerateSeasonalRecommendationsMessage,
  env: Env,
): Promise<void> {
  let pool: Pool | null = null;
  try {
    const created = createConsumerDb(env.DATABASE_URL);
    pool = created.pool;
    const useCase = new GenerateSeasonalRecommendations(created.db);
    const result = await useCase.execute({
      organizationId: msg.organizationId,
      branchId: msg.branchId,
    });
    console.log(
      `[generate-seasonal-recommendations] jobId=${msg.jobId} orgId=${msg.organizationId ?? "*"} branchId=${msg.branchId ?? "*"} triggeredBy=${msg.triggeredBy} → scanned=${result.scanned} created=${result.created} skipped=${result.skipped}${result.reason ? ` reason=${result.reason}` : ""}`,
    );
  } finally {
    if (pool) {
      await closeConsumerDb(pool);
    }
  }
}
