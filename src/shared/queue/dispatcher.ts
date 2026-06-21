import type { MessageBatch, ExecutionContext } from "@cloudflare/workers-types";
import type { Env } from "../env";
import type { AnalyticsJobMessage } from "./types";
import { handleDetectInactiveCustomers } from "./handlers/detect-inactive-customers";
import { handleFetchExternalData } from "./handlers/fetch-external-data";
import { handleSendEmail } from "./handlers/send-email";

export async function handleQueueBatch(
  batch: MessageBatch<AnalyticsJobMessage>,
  env: Env,
  _ctx: ExecutionContext,
): Promise<void> {
  for (const msg of batch.messages) {
    try {
      const body = msg.body;
      switch (body.type) {
        case "detect-inactive-customers":
          await handleDetectInactiveCustomers(body, env);
          msg.ack();
          break;
        case "fetch-external-data":
          await handleFetchExternalData(body, env);
          msg.ack();
          break;
        case "send-email":
          await handleSendEmail(body, env);
          msg.ack();
          break;
        default: {
          const _exhaustive: never = body;
          void _exhaustive;
          console.error(`[queue] unknown job type, dropping:`, body);
          msg.ack();
        }
      }
    } catch (err) {
      console.error(
        `[queue] job failed (id=${msg.id}, attempt=${msg.attempts}):`,
        err,
      );
      throw err;
    }
  }
}
