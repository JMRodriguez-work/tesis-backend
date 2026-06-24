import type { Context, MiddlewareHandler, Next } from "hono";
import { ApiError } from "./api-response";
import type { AppType, Variables } from "../types/app";
import type { Env } from "../env";

function parseOrigins(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((o) => o.trim())
    .filter((o) => o.length > 0);
}

function corsMiddleware(): MiddlewareHandler<{
  Bindings: Env;
  Variables: Variables;
}> {
  return async (c: Context, next: Next) => {
    const origin = c.req.header("Origin");
    const allowed = parseOrigins(c.env.ALLOWED_ORIGINS);

    if (origin) {
      if (allowed.includes(origin)) {
        c.res.headers.set("Access-Control-Allow-Origin", origin);
        c.res.headers.set("Vary", "Origin");
        c.res.headers.set("Access-Control-Allow-Credentials", "true");
        c.res.headers.set(
          "Access-Control-Allow-Methods",
          "GET, POST, PUT, PATCH, DELETE, OPTIONS",
        );
        c.res.headers.set(
          "Access-Control-Allow-Headers",
          "Content-Type, Authorization",
        );
        c.res.headers.set("Access-Control-Max-Age", "86400");
      } else {
        return c.json({ message: "Origin no permitido" }, 403);
      }
    }

    if (c.req.method === "OPTIONS") {
      return c.body(null, 204);
    }

    await next();
  };
}

export function setupMiddleware(app: AppType) {
  app.use("*", corsMiddleware());

  app.onError((err, c) => {
    if (err instanceof ApiError) {
      return c.json(
        { message: err.message, ...(err.data ? { data: err.data } : {}) },
        err.status as 400,
      );
    }
    console.error(err);
    return c.json({ message: "Internal server error" }, 500);
  });

  app.notFound((c) => {
    return c.json({ message: `Ruta no encontrada: ${c.req.path}` }, 404);
  });
}
