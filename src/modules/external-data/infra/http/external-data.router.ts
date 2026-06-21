import { createRoute } from "@hono/zod-openapi";
import { ApiError, ApiResponse } from "../../../../shared/http/api-response";
import { authMiddleware } from "../../../../shared/auth";
import { roleGuard } from "../../../../shared/auth/role-guard";
import type { Env } from "../../../../shared/env";
import type { AppType } from "../../../../shared/types/app";
import { CreateExternalDataSource } from "../../use-cases/create-external-data-source.use-case";
import { DeleteExternalDataSource } from "../../use-cases/delete-external-data-source.use-case";
import { EnqueueFetchExternalData } from "../../use-cases/enqueue-fetch-external-data.use-case";
import { GetExternalDataSourceById } from "../../use-cases/get-external-data-source-by-id.use-case";
import { ListExternalDataSources } from "../../use-cases/get-external-data-sources.use-case";
import { UpdateExternalDataSource } from "../../use-cases/update-external-data-source.use-case";
import {
  createSourceSchema,
  enqueueFetchExternalDataResponseSchema,
  externalDataSourceIdParamSchema,
  externalDataSourceResponseSchema,
  externalDataSourcesListResponseSchema,
  listSourcesQuerySchema,
  updateSourceSchema,
} from "./external-data.schemas";

export function registerExternalDataRoutes(app: AppType) {
  app.openapi(
    createRoute({
      method: "get",
      path: "/api/v1/external-data",
      tags: ["ExternalData"],
      summary: "Listar fuentes de datos externos",
      description:
        "HU-030/HU-031. Devuelve las fuentes externas configuradas. Soporta filtros ?isActive=true|false (default: solo activas) y ?type=wholesale_prices|search_trends|seasonality.",
      middleware: [authMiddleware] as const,
      security: [{ cookieAuth: [] }],
      request: { query: listSourcesQuerySchema },
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
      const query = c.req.valid("query");
      const isActive = query.isActive === undefined ? true : query.isActive;
      const data = await new ListExternalDataSources(db).execute({
        isActive,
        type: query.type,
      });
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
        "Devuelve la fuente con su data, lastFetchedAt, lastError y authConfig. 404 si no existe.",
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
      path: "/api/v1/external-data",
      tags: ["ExternalData"],
      summary: "Crear fuente externa",
      description:
        "Solo Admin. Crea una nueva fuente. `name` único en la tabla (validación a nivel app).",
      middleware: [authMiddleware, roleGuard(["Admin"])] as const,
      security: [{ cookieAuth: [] }],
      request: {
        body: {
          content: { "application/json": { schema: createSourceSchema } },
        },
      },
      responses: {
        201: {
          description: "Fuente creada",
          content: {
            "application/json": { schema: externalDataSourceResponseSchema },
          },
        },
        400: { description: "Datos inválidos o nombre duplicado" },
        401: { description: "No autenticado" },
        403: { description: "No autorizado" },
      },
    }),
    async (c) => {
      const db = c.get("db");
      const body = c.req.valid("json");
      const data = await new CreateExternalDataSource(db).execute({
        name: body.name,
        type: body.type,
        url: body.url ?? null,
        authConfig: body.authConfig ?? null,
        isActive: body.isActive,
      });
      return c.json(
        new ApiResponse({ data, message: "Fuente creada", status: 201 }),
        201,
      );
    },
  );

  app.openapi(
    createRoute({
      method: "put",
      path: "/api/v1/external-data/{id}",
      tags: ["ExternalData"],
      summary: "Actualizar fuente externa",
      description:
        "Solo Admin. Patch parcial: cualquiera de los campos del createSourceSchema. `name` único (con excludeId).",
      middleware: [authMiddleware, roleGuard(["Admin"])] as const,
      security: [{ cookieAuth: [] }],
      request: {
        params: externalDataSourceIdParamSchema,
        body: {
          content: { "application/json": { schema: updateSourceSchema } },
        },
      },
      responses: {
        200: {
          description: "Fuente actualizada",
          content: {
            "application/json": { schema: externalDataSourceResponseSchema },
          },
        },
        400: { description: "Datos inválidos o nombre duplicado" },
        401: { description: "No autenticado" },
        403: { description: "No autorizado" },
        404: { description: "Fuente no encontrada" },
      },
    }),
    async (c) => {
      const db = c.get("db");
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");
      const data = await new UpdateExternalDataSource(db).execute({
        id,
        name: body.name,
        type: body.type,
        url: body.url,
        authConfig: body.authConfig,
        isActive: body.isActive,
      });
      return c.json(
        new ApiResponse({ data, message: "Fuente actualizada", status: 200 }),
        200,
      );
    },
  );

  app.openapi(
    createRoute({
      method: "delete",
      path: "/api/v1/external-data/{id}",
      tags: ["ExternalData"],
      summary: "Eliminar fuente externa (soft delete)",
      description: "Solo Admin. Soft delete: isActive=false. Idempotente.",
      middleware: [authMiddleware, roleGuard(["Admin"])] as const,
      security: [{ cookieAuth: [] }],
      request: { params: externalDataSourceIdParamSchema },
      responses: {
        200: { description: "Fuente eliminada (o ya estaba inactiva)" },
        401: { description: "No autenticado" },
        403: { description: "No autorizado" },
        404: { description: "Fuente no encontrada" },
      },
    }),
    async (c) => {
      const db = c.get("db");
      const { id } = c.req.valid("param");
      const result = await new DeleteExternalDataSource(db).execute(id);
      const message = result.alreadyDeleted
        ? "La fuente ya estaba deshabilitada"
        : "Fuente eliminada";
      return c.json(
        new ApiResponse({ data: result, message, status: 200 }),
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
        "Solo Admin/Manager. Encola un job async (Cloudflare Queues) que descarga la URL configurada (aplicando authConfig) y guarda el JSON parseado en data. Devuelve 202 con jobId.",
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
