import type { Pool } from "@neondatabase/serverless";
import type { Env } from "../../env";
import type { DetectInactiveCustomersMessage } from "../types";
import { RunDetectInactive } from "../../../modules/customer-analytics/use-cases/run-detect-inactive.use-case";
import { closeConsumerDb, createConsumerDb } from "../consumer-db";

export async function handleDetectInactiveCustomers(
  msg: DetectInactiveCustomersMessage,
  env: Env,
): Promise<void> {
  let pool: Pool | null = null;
  try {
    const created = createConsumerDb(env.DATABASE_URL);
    pool = created.pool;
    const useCase = new RunDetectInactive(created.db);
    const result = await useCase.execute({
      organizationId: msg.organizationId,
      branchId: msg.branchId,
      days: msg.days,
    });
    console.log(
      `[detect-inactive-customers] jobId=${msg.jobId} orgId=${msg.organizationId} branchId=${msg.branchId ?? "*"} days=${msg.days} → scanned=${result.scanned} created=${result.created} skipped=${result.skipped}`,
    );
  } finally {
    if (pool) {
      await closeConsumerDb(pool);
    }
  }
}
