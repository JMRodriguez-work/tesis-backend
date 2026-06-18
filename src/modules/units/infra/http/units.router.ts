import { createRoute } from "@hono/zod-openapi";
import { authMiddleware } from "../../../../shared/auth";
import { ApiError, ApiResponse } from "../../../../shared/http/api-response";
import type { AppType } from "../../../../shared/types/app";
import { GetUnitById } from "../../use-cases/get-unit-by-id.use-case";
import { GetUnits } from "../../use-cases/get-units.use-case";
import {
  unitIdParamSchema,
  unitListResponseSchema,
  unitResponseSchema,
} from "./units.schemas";

export function registerUnitRoutes(app: AppType) {
  app.openapi(
    createRoute({
      method: "get",
      path: "/api/v1/units",
      tags: ["Units"],
      summary: "Listar unidades de medida",
      description:
        "Unidades globales, lectura para todos los roles autenticados. Sin paginación.",
      middleware: [authMiddleware] as const,
      security: [{ cookieAuth: [] }],
      responses: {
        200: {
          description: "Unidades obtenidas",
          content: { "application/json": { schema: unitListResponseSchema } },
        },
        401: { description: "No autenticado" },
      },
    }),
    async (c) => {
      const db = c.get("db");
      const units = await new GetUnits(db).execute();
      return c.json(
        new ApiResponse({
          data: units,
          message: "Unidades obtenidas",
          status: 200,
        }),
        200,
      );
    },
  );

  app.openapi(
    createRoute({
      method: "get",
      path: "/api/v1/units/{id}",
      tags: ["Units"],
      summary: "Obtener unidad por ID",
      middleware: [authMiddleware] as const,
      security: [{ cookieAuth: [] }],
      request: { params: unitIdParamSchema },
      responses: {
        200: {
          description: "Unidad encontrada",
          content: { "application/json": { schema: unitResponseSchema } },
        },
        401: { description: "No autenticado" },
        404: { description: "Unidad no encontrada" },
      },
    }),
    async (c) => {
      const db = c.get("db");
      const { id } = c.req.valid("param");
      const unit = await new GetUnitById(db).execute(id);
      if (!unit) throw new ApiError("Unidad no encontrada", 404);
      return c.json(
        new ApiResponse({
          data: unit,
          message: "Unidad encontrada",
          status: 200,
        }),
        200,
      );
    },
  );
}
