import { createRoute } from "@hono/zod-openapi";
import { z } from "@hono/zod-openapi";
import { authMiddleware, getAuth } from "../../../../shared/auth";
import { getBetterAuthErrorMessage } from "../../../../shared/auth/errors";
import { ApiError } from "../../../../shared/http/api-response";
import { authUserSchema } from "./auth.schemas";
import type { AppType } from "../../../../shared/types/app";

const authResponseSchema = z.object({
  data: authUserSchema,
  message: z.string(),
  status: z.number(),
});

const signOutResponseSchema = z.object({
  data: z.null(),
  message: z.string(),
  status: z.number(),
});

export function registerAuthRoutes(app: AppType) {
  app.openapi(
    createRoute({
      method: "get",
      path: "/api/v1/auth/me",
      tags: ["Auth"],
      summary: "Obtener usuario autenticado",
      middleware: [authMiddleware] as const,
      security: [{ cookieAuth: [] }],
      responses: {
        200: {
          description: "Usuario autenticado",
          content: { "application/json": { schema: authResponseSchema } },
        },
        401: { description: "No autenticado" },
      },
    }),
    (c) => {
      const user = c.get("user");
      return c.json(
        { data: user, message: "Usuario autenticado", status: 200 },
        200,
      );
    },
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/api/v1/auth/sign-out",
      tags: ["Auth"],
      summary: "Cerrar sesión",
      description:
        "Wrapper de Better Auth que no requiere Content-Type en el body. Limpia la cookie de sesión y la fila en `session`.",
      middleware: [authMiddleware] as const,
      security: [{ cookieAuth: [] }],
      responses: {
        200: {
          description: "Sesión cerrada",
          content: { "application/json": { schema: signOutResponseSchema } },
        },
        401: { description: "No autenticado" },
        500: { description: "Error al cerrar sesión" },
      },
    }),
    async (c) => {
      const auth = getAuth(c.env, c.get("db"));
      try {
        const res = await auth.api.signOut({ headers: c.req.raw.headers });
        if (
          res &&
          typeof res === "object" &&
          "success" in res &&
          !res.success
        ) {
          throw new ApiError("Error al cerrar sesión", 500);
        }
        return c.json(
          { data: null, message: "Sesión cerrada", status: 200 },
          200,
        );
      } catch (error) {
        const translated = getBetterAuthErrorMessage(error);
        if (translated) {
          throw new ApiError(translated, 400);
        }
        throw new ApiError("Error al cerrar sesión", 500);
      }
    },
  );
}
