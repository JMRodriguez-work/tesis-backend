import { createRoute } from "@hono/zod-openapi";
import { ApiResponse } from "../../../../shared/http/api-response";
import { authMiddleware } from "../../../../shared/auth";
import { roleGuard } from "../../../../shared/auth/role-guard";
import type { AppType } from "../../../../shared/types/app";
import { ListNotifications } from "../../use-cases/list-notifications.use-case";
import { MarkAllNotificationsRead } from "../../use-cases/mark-all-notifications-read.use-case";
import { MarkNotificationRead } from "../../use-cases/mark-notification-read.use-case";
import {
  listNotificationsQuerySchema,
  listNotificationsResponseSchema,
  markAllNotificationsReadResponseSchema,
  markNotificationReadResponseSchema,
  notificationIdParamSchema,
} from "./notifications.schemas";

const ADMIN_ROLE_ID = 1;

export function registerNotificationRoutes(app: AppType) {
  app.openapi(
    createRoute({
      method: "get",
      path: "/api/v1/notifications",
      tags: ["Notifications"],
      summary: "Listar notificaciones",
      description:
        "HU-035. Devuelve un resumen unificado: recommendations pending sin leer + items con stock bajo mínimo. Scope-by-branch: Admin puede filtrar con ?branchId=, Manager/Employee forzado a su branch.",
      middleware: [authMiddleware] as const,
      security: [{ cookieAuth: [] }],
      request: { query: listNotificationsQuerySchema },
      responses: {
        200: {
          description: "Notificaciones",
          content: {
            "application/json": { schema: listNotificationsResponseSchema },
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
      const data = await new ListNotifications(db).execute({
        organizationId: user.organizationId,
        userRoleId: user.roleId,
        userBranchId: user.branchId,
        requestedBranchId: query.branchId ?? null,
      });
      return c.json(
        new ApiResponse({
          data,
          message: "Notificaciones obtenidas",
          status: 200,
        }),
        200,
      );
    },
  );

  app.openapi(
    createRoute({
      method: "patch",
      path: "/api/v1/notifications/recommendations/{id}/read",
      tags: ["Notifications"],
      summary: "Marcar recomendación como leída",
      description:
        "Idempotente. Cross-org/branch → 404. Restringido a Admin/Manager: no permitir que un Employee silencie notificaciones operativas cerrándolas.",
      middleware: [authMiddleware, roleGuard(["Admin", "Manager"])] as const,
      security: [{ cookieAuth: [] }],
      request: { params: notificationIdParamSchema },
      responses: {
        200: {
          description: "Recomendación marcada como leída",
          content: {
            "application/json": { schema: markNotificationReadResponseSchema },
          },
        },
        401: { description: "No autenticado" },
        404: { description: "Notificación no encontrada" },
      },
    }),
    async (c) => {
      const user = c.get("user");
      const db = c.get("db");
      const { id } = c.req.valid("param");
      const data = await new MarkNotificationRead(db).execute({
        recommendationId: id,
        organizationId: user.organizationId ?? "",
        userBranchId: user.branchId,
        isAdmin: user.roleId === ADMIN_ROLE_ID,
      });
      return c.json(
        new ApiResponse({
          data,
          message: "Notificación marcada como leída",
          status: 200,
        }),
        200,
      );
    },
  );

  app.openapi(
    createRoute({
      method: "patch",
      path: "/api/v1/notifications/recommendations/read-all",
      tags: ["Notifications"],
      summary:
        "Marcar todas las recomendaciones pending de la branch como leídas",
      description:
        "Idempotente. Admin: indicar ?branchId= en query. Manager/Employee: marca las de su branch. Restringido a Admin/Manager.",
      middleware: [authMiddleware, roleGuard(["Admin", "Manager"])] as const,
      security: [{ cookieAuth: [] }],
      request: { query: listNotificationsQuerySchema },
      responses: {
        200: {
          description: "Recomendaciones marcadas como leídas",
          content: {
            "application/json": {
              schema: markAllNotificationsReadResponseSchema,
            },
          },
        },
        400: { description: "branchId requerido o inválido" },
        401: { description: "No autenticado" },
      },
    }),
    async (c) => {
      const user = c.get("user");
      const db = c.get("db");
      const query = c.req.valid("query");
      const data = await new MarkAllNotificationsRead(db).execute({
        organizationId: user.organizationId ?? "",
        userBranchId: user.branchId,
        requestedBranchId: query.branchId ?? null,
        isAdmin: user.roleId === ADMIN_ROLE_ID,
      });
      return c.json(
        new ApiResponse({
          data,
          message: "Recomendaciones marcadas como leídas",
          status: 200,
        }),
        200,
      );
    },
  );
}
