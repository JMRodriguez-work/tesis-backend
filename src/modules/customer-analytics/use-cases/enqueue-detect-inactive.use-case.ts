import { randomUUID } from "node:crypto";
import { ApiError } from "../../../shared/http/api-response";
import type { Env } from "../../../shared/env";
import {
  resolveCustomerAnalyticsScope,
  type ResolveCustomerAnalyticsScopeInput,
} from "./resolve-customer-analytics-scope";

export type EnqueueDetectInactiveInput = ResolveCustomerAnalyticsScopeInput & {
  days: number;
  triggeredBy: string;
};

export type EnqueueDetectInactiveResult = {
  jobId: string;
  status: "queued";
  queueName: "tfg-analytics";
};

export class EnqueueDetectInactive {
  constructor(private readonly env: Env) {}

  async execute(
    input: EnqueueDetectInactiveInput,
  ): Promise<EnqueueDetectInactiveResult> {
    const scope = resolveCustomerAnalyticsScope(input);
    if (!scope.organizationId) throw new ApiError("No autorizado", 403);

    if (input.requestedBranchId && !scope.isAdmin) {
      throw new ApiError("No autorizado", 403);
    }

    if (!input.triggeredBy) {
      throw new ApiError("No autorizado", 403);
    }

    const jobId = randomUUID();

    await this.env.ANALYTICS_QUEUE.send({
      type: "detect-inactive-customers",
      jobId,
      organizationId: scope.organizationId,
      branchId: scope.branchId,
      days: input.days,
      triggeredBy: input.triggeredBy,
      triggeredAt: new Date().toISOString(),
    });

    return {
      jobId,
      status: "queued",
      queueName: "tfg-analytics",
    };
  }
}
