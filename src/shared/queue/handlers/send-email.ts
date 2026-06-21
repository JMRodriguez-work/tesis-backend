import type { Env } from "../../env";
import type { SendEmailMessage } from "../types";

export async function handleSendEmail(
  _msg: SendEmailMessage,
  _env: Env,
): Promise<void> {
  console.warn("[send-email] handler not yet implemented (Phase 3.5)");
}
