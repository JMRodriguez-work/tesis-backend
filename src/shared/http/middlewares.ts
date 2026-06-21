import { cors } from "hono/cors";
import { ApiError } from "./api-response";
import type { AppType } from "../types/app";

const ALLOWED_ORIGINS = ["http://localhost:5173", "http://localhost:3000"];

export function setupMiddleware(app: AppType) {
  app.use(
    "*",
    cors({
      origin: ALLOWED_ORIGINS,
      credentials: true,
      allowHeaders: ["Content-Type", "Authorization"],
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    }),
  );

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
