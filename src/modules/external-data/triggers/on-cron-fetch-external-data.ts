import { randomUUID } from "node:crypto";
import type { ExecutionContext } from "@cloudflare/workers-types";
import type { Env } from "../../../shared/env";
import {
  closeConsumerDb,
  createConsumerDb,
} from "../../../shared/queue/consumer-db";
import { findActiveSources } from "../infra/repository/external-data.repository";

export async function handleScheduledFetchExternalData(
  env: Env,
  _ctx: ExecutionContext,
): Promise<void> {
  const { db, pool } = createConsumerDb(env.DATABASE_URL);
  try {
    const sources = await findActiveSources(db);
    if (sources.length === 0) {
      console.log("[cron:fetch-external-data] no active sources, skipping");
      return;
    }

    let enqueued = 0;
    let skipped = 0;
    for (const source of sources) {
      if (!source.url && source.type !== "seasonality") {
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

    let seasonalJobId: string | null = null;
    if (enqueued > 0) {
      seasonalJobId = randomUUID();
      await env.ANALYTICS_QUEUE.send({
        type: "generate-seasonal-recommendations",
        jobId: seasonalJobId,
        organizationId: null,
        branchId: null,
        triggeredBy: "cron",
      });
    }

    console.log(
      `[cron:fetch-external-data] enqueued=${enqueued} skipped=${skipped} total=${sources.length} seasonalJobId=${seasonalJobId ?? "skipped (no successful fetch)"}`,
    );
  } finally {
    await closeConsumerDb(pool);
  }
}
