import type { Pool } from "@neondatabase/serverless";
import type { Env } from "../../env";
import type { FetchExternalDataMessage } from "../types";
import { RunFetchExternalData } from "../../../modules/external-data/use-cases/run-fetch-external-data.use-case";
import { closeConsumerDb, createConsumerDb } from "../consumer-db";

export async function handleFetchExternalData(
  msg: FetchExternalDataMessage,
  env: Env,
): Promise<void> {
  let pool: Pool | null = null;
  try {
    const created = createConsumerDb(env.DATABASE_URL);
    pool = created.pool;
    const useCase = new RunFetchExternalData(created.db);
    const result = await useCase.execute({ sourceId: msg.sourceId });
    console.log(
      `[fetch-external-data] jobId=${msg.jobId} sourceId=${msg.sourceId} triggeredBy=${msg.triggeredBy} → updated=${result.updated}`,
    );
  } finally {
    if (pool) {
      await closeConsumerDb(pool);
    }
  }
}
