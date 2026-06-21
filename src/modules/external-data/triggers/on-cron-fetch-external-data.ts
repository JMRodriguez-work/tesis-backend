import { randomUUID } from "node:crypto";
import type { ExecutionContext } from "@cloudflare/workers-types";
import type { Env } from "../../../shared/env";
import {
  closeConsumerDb,
  createConsumerDb,
} from "../../../shared/queue/consumer-db";
import { findAllSources } from "../infra/repository/external-data.repository";

export async function handleScheduledFetchExternalData(
  env: Env,
  _ctx: ExecutionContext,
): Promise<void> {
  const { db, pool } = createConsumerDb(env.DATABASE_URL);
  try {
    const sources = await findAllSources(db);
    if (sources.length === 0) {
      console.log("[cron:fetch-external-data] no sources configured, skipping");
      return;
    }

    let enqueued = 0;
    let skipped = 0;
    for (const source of sources) {
      if (!source.url) {
        skipped++;
        continue;
      }
      const jobId = randomUUID();
      await env.ANALYTICS_QUEUE.send({
        type: "fetch-external-data",
        jobId,
        organizationId: "",
        sourceId: source.id,
        triggeredBy: "cron",
      });
      enqueued++;
    }

    console.log(
      `[cron:fetch-external-data] enqueued=${enqueued} skipped=${skipped} total=${sources.length}`,
    );
  } finally {
    await closeConsumerDb(pool);
  }
}
