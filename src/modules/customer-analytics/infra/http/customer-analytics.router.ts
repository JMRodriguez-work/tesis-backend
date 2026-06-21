import { createRoute } from "@hono/zod-openapi";
import { authMiddleware } from "../../../../shared/auth";
import { roleGuard } from "../../../../shared/auth/role-guard";
import { ApiResponse } from "../../../../shared/http/api-response";
import type { Env } from "../../../../shared/env";
import type { AppType } from "../../../../shared/types/app";
import { EnqueueDetectInactive } from "../../use-cases/enqueue-detect-inactive.use-case";
import {
  detectInactiveSchema,
  enqueueDetectInactiveResponseSchema,
} from "./customer-analytics.schemas";

export function registerCustomerAnalyticsRoutes(app: AppType) {
  app.openapi(
    createRoute({
      method: "post",
      path: "/api/v1/customer-analytics/detect-inactive",
      tags: ["CustomerAnalytics"],
      summary: "Encolar job de detección de clientes inactivos",
      description:
        "Solo Admin/Manager. Encola un job async (Cloudflare Queues) que detecta clientes sin compras hace N días y crea recommendations `retention`. Devuelve 202 con jobId.",
      middleware: [authMiddleware, roleGuard(["Admin", "Manager"])] as const,
      security: [{ cookieAuth: [] }],
      request: {
        body: {
          content: { "application/json": { schema: detectInactiveSchema } },
        },
      },
      responses: {
        202: {
          description: "Job encolado",
          content: {
            "application/json": { schema: enqueueDetectInactiveResponseSchema },
          },
        },
        400: { description: "Datos inválidos o branch de otra org" },
        401: { description: "No autenticado" },
        403: { description: "No autorizado" },
      },
    }),
    async (c) => {
      const user = c.get("user");
      const body = c.req.valid("json");
      const env = c.env as Env;
      const useCase = new EnqueueDetectInactive(env);
      const result = await useCase.execute({
        userRoleId: user.roleId,
        userBranchId: user.branchId,
        userOrganizationId: user.organizationId,
        requestedBranchId: body.branchId ?? null,
        days: body.days,
        triggeredBy: user.id,
      });
      return c.json(
        new ApiResponse({
          data: result,
          message: "Trabajo encolado para procesamiento asíncrono",
          status: 202,
        }),
        202,
      );
    },
  );
}
