import { createRoute } from "@hono/zod-openapi";
import { authMiddleware } from "../../../../shared/auth";
import { roleGuard } from "../../../../shared/auth/role-guard";
import { ApiResponse } from "../../../../shared/http/api-response";
import type { AppType } from "../../../../shared/types/app";
import { GetInactiveCustomers } from "../../../customer-analytics/use-cases/get-inactive-customers.use-case";
import { GetProductRotation } from "../../use-cases/get-product-rotation.use-case";
import { GetSalesSummary } from "../../use-cases/get-sales-summary.use-case";
import {
  inactiveCustomersQuerySchema,
  inactiveCustomersResponseSchema,
  productRotationQuerySchema,
  productRotationResponseSchema,
  salesSummaryQuerySchema,
  salesSummaryResponseSchema,
} from "./dashboard.schemas";

export function registerDashboardRoutes(app: AppType) {
  app.openapi(
    createRoute({
      method: "get",
      path: "/api/v1/dashboard/sales-summary",
      tags: ["Dashboard"],
      summary: "Métricas de ventas (today / thisWeek / previousWeek + delta)",
      description:
        "HU-027. Devuelve totales, cantidad de transacciones y ticket promedio para hoy, esta semana rolling 7d, y la semana anterior. Incluye deltas porcentuales.",
      middleware: [authMiddleware, roleGuard(["Admin", "Manager"])] as const,
      security: [{ cookieAuth: [] }],
      request: { query: salesSummaryQuerySchema },
      responses: {
        200: {
          description: "Resumen de ventas",
          content: {
            "application/json": { schema: salesSummaryResponseSchema },
          },
        },
        400: { description: "branchId inválido" },
        401: { description: "No autenticado" },
      },
    }),
    async (c) => {
      const user = c.get("user");
      const db = c.get("db");
      const query = c.req.valid("query");
      const data = await new GetSalesSummary(db).execute({
        userRoleId: user.roleId,
        userBranchId: user.branchId,
        userOrganizationId: user.organizationId,
        requestedBranchId: query.branchId ?? null,
        from: query.from,
        to: query.to,
      });
      return c.json(
        new ApiResponse({ data, message: "Resumen de ventas", status: 200 }),
        200,
      );
    },
  );

  app.openapi(
    createRoute({
      method: "get",
      path: "/api/v1/dashboard/product-rotation",
      tags: ["Dashboard"],
      summary: "Rotación de productos (cantidad vendida en el período)",
      description:
        "HU-028. Items ordenados por cantidad vendida. Default: últimos 30 días. Filtros: from, to, categoryId, includeZeroSales, branchId (admin).",
      middleware: [authMiddleware, roleGuard(["Admin", "Manager"])] as const,
      security: [{ cookieAuth: [] }],
      request: { query: productRotationQuerySchema },
      responses: {
        200: {
          description: "Rotación de productos",
          content: {
            "application/json": { schema: productRotationResponseSchema },
          },
        },
        400: { description: "Datos inválidos" },
        401: { description: "No autenticado" },
      },
    }),
    async (c) => {
      const user = c.get("user");
      const db = c.get("db");
      const query = c.req.valid("query");
      const result = await new GetProductRotation(db).execute({
        userRoleId: user.roleId,
        userBranchId: user.branchId,
        userOrganizationId: user.organizationId,
        requestedBranchId: query.branchId ?? null,
        from: query.from,
        to: query.to,
        categoryId: query.categoryId,
        includeZeroSales: query.includeZeroSales,
        page: query.page,
        limit: query.limit,
      });
      return c.json(
        new ApiResponse({
          data: result,
          message: "Rotación de productos",
          status: 200,
        }),
        200,
      );
    },
  );

  app.openapi(
    createRoute({
      method: "get",
      path: "/api/v1/dashboard/inactive-customers",
      tags: ["Dashboard"],
      summary: "Clientes inactivos con alerta activa (HU-025)",
      description:
        "Lista de customers que tienen una recommendation `retention` pending, con datos de su última compra y días sin comprar.",
      middleware: [authMiddleware, roleGuard(["Admin", "Manager"])] as const,
      security: [{ cookieAuth: [] }],
      request: { query: inactiveCustomersQuerySchema },
      responses: {
        200: {
          description: "Clientes inactivos",
          content: {
            "application/json": { schema: inactiveCustomersResponseSchema },
          },
        },
        400: { description: "branchId inválido" },
        401: { description: "No autenticado" },
      },
    }),
    async (c) => {
      const user = c.get("user");
      const db = c.get("db");
      const query = c.req.valid("query");
      const result = await new GetInactiveCustomers(db).execute({
        userRoleId: user.roleId,
        userBranchId: user.branchId,
        userOrganizationId: user.organizationId,
        requestedBranchId: query.branchId ?? null,
        limit: query.limit,
      });
      return c.json(
        new ApiResponse({
          data: result,
          message: "Clientes inactivos",
          status: 200,
        }),
        200,
      );
    },
  );
}
