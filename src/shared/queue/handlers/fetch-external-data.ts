import type { Env } from "../../env";
import type { FetchExternalDataMessage } from "../types";

export async function handleFetchExternalData(
  _msg: FetchExternalDataMessage,
  _env: Env,
): Promise<void> {
  console.warn("[fetch-external-data] handler not yet implemented (Phase 3.4)");
}
