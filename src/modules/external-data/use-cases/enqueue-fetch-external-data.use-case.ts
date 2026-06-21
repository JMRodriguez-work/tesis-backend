import { randomUUID } from "node:crypto";
import { ApiError } from "../../../shared/http/api-response";
import type { Env } from "../../../shared/env";
import type { DB } from "../../../shared/db";
import { findSourceById } from "../infra/repository/external-data.repository";
import {
  resolveExternalDataScope,
  type ResolveExternalDataScopeInput,
} from "./resolve-external-data-scope";

export type EnqueueFetchExternalDataInput = ResolveExternalDataScopeInput & {
  sourceId: string;
  triggeredBy: string;
};

export type EnqueueFetchExternalDataResult = {
  jobId: string;
  status: "queued";
  queueName: "tfg-analytics";
};

export class EnqueueFetchExternalData {
  constructor(
    private readonly env: Env,
    private readonly db: DB,
  ) {}

  async execute(
    input: EnqueueFetchExternalDataInput,
  ): Promise<EnqueueFetchExternalDataResult> {
    const scope = resolveExternalDataScope(input);

    const source = await findSourceById(this.db, input.sourceId);
    if (!source) {
      throw new ApiError("Fuente externa no encontrada", 404);
    }

    const jobId = randomUUID();

    await this.env.ANALYTICS_QUEUE.send({
      type: "fetch-external-data",
      jobId,
      organizationId: scope.organizationId,
      sourceId: source.id,
      triggeredBy: input.triggeredBy,
    });

    return {
      jobId,
      status: "queued",
      queueName: "tfg-analytics",
    };
  }
}
