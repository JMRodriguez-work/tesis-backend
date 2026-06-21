import { createRoute } from "@hono/zod-openapi";
import { ApiError, ApiResponse } from "../../../../shared/http/api-response";
import { authMiddleware } from "../../../../shared/auth";
import { roleGuard } from "../../../../shared/auth/role-guard";
import type { Env } from "../../../../shared/env";
import type { AppType } from "../../../../shared/types/app";
import { EnqueueFetchExternalData } from "../../use-cases/enqueue-fetch-external-data.use-case";
import { GetExternalDataSourceById } from "../../use-cases/get-external-data-source-by-id.use-case";
import { GetExternalDataSources } from "../../use-cases/get-external-data-sources.use-case";
import {
  enqueueFetchExternalDataResponseSchema,
  externalDataSourceIdParamSchema,
  externalDataSourceResponseSchema,
  externalDataSourcesListResponseSchema,
} from "./external-data.schemas";

export function registerExternalDataRoutes(app: AppType) {
  app.openapi(
    createRoute({
      method: "get",
      path: "/api/v1/external-data",
      tags: ["ExternalData"],
      summary: "Listar fuentes de datos externos",
      description:
        "HU-030/HU-031. Devuelve todas las fuentes externas configuradas (globales, sin filtro por org). Incluye lastFetchedAt y data cuando existe.",
      middleware: [authMiddleware] as const,
      security: [{ cookieAuth: [] }],
      responses: {
        200: {
          description: "Fuentes de datos externos",
          content: {
            "application/json": {
              schema: externalDataSourcesListResponseSchema,
            },
          },
        },
        401: { description: "No autenticado" },
      },
    }),
    async (c) => {
      const db = c.get("db");
      const data = await new GetExternalDataSources(db).execute();
      return c.json(
        new ApiResponse({ data, message: "Fuentes obtenidas", status: 200 }),
        200,
      );
    },
  );

  app.openapi(
    createRoute({
      method: "get",
      path: "/api/v1/external-data/{id}",
      tags: ["ExternalData"],
      summary: "Detalle de una fuente externa",
      description:
        "Devuelve la fuente con su data y lastFetchedAt. 404 si no existe.",
      middleware: [authMiddleware] as const,
      security: [{ cookieAuth: [] }],
      request: { params: externalDataSourceIdParamSchema },
      responses: {
        200: {
          description: "Fuente encontrada",
          content: {
            "application/json": { schema: externalDataSourceResponseSchema },
          },
        },
        401: { description: "No autenticado" },
        404: { description: "Fuente no encontrada" },
      },
    }),
    async (c) => {
      const db = c.get("db");
      const { id } = c.req.valid("param");
      const source = await new GetExternalDataSourceById(db).execute(id);
      if (!source) throw new ApiError("Fuente externa no encontrada", 404);
      return c.json(
        new ApiResponse({
          data: source,
          message: "Fuente encontrada",
          status: 200,
        }),
        200,
      );
    },
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/api/v1/external-data/{id}/fetch",
      tags: ["ExternalData"],
      summary: "Encolar fetch manual de una fuente",
      description:
        "Solo Admin/Manager. Encola un job async (Cloudflare Queues) que descarga la URL configurada y guarda el JSON en data. Devuelve 202 con jobId.",
      middleware: [authMiddleware, roleGuard(["Admin", "Manager"])] as const,
      security: [{ cookieAuth: [] }],
      request: { params: externalDataSourceIdParamSchema },
      responses: {
        202: {
          description: "Job encolado",
          content: {
            "application/json": {
              schema: enqueueFetchExternalDataResponseSchema,
            },
          },
        },
        401: { description: "No autenticado" },
        403: { description: "No autorizado" },
        404: { description: "Fuente no encontrada" },
      },
    }),
    async (c) => {
      const user = c.get("user");
      const db = c.get("db");
      const env = c.env as Env;
      const { id } = c.req.valid("param");
      const useCase = new EnqueueFetchExternalData(env, db);
      const result = await useCase.execute({
        userRoleId: user.roleId,
        userOrganizationId: user.organizationId,
        sourceId: id,
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
