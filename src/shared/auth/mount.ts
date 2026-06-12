import { Hono } from "hono";
import { getAuth } from "../auth";
import { getBetterAuthErrorMessage } from "../auth/errors";
import type { Env } from "../env";
import type { Variables } from "../types/app";

const RATE_LIMIT_MESSAGE_ES =
  "Demasiadas solicitudes. Esperá un momento e intentá de nuevo.";

export function mountBetterAuth(
  app: Hono<{ Bindings: Env; Variables: Variables }>,
) {
  app.on(["POST", "GET"], "/api/auth/**", async (c) => {
    const auth = getAuth(c.env, c.get("db"));
    const response = await auth.handler(c.req.raw);

    if (response.status === 429) {
      const newHeaders = new Headers(response.headers);
      newHeaders.set("content-type", "application/json");
      return c.json(
        { message: RATE_LIMIT_MESSAGE_ES },
        { status: 429, headers: newHeaders },
      );
    }

    if (response.headers.get("content-type")?.includes("application/json")) {
      const cloned = response.clone();
      try {
        const body = (await cloned.json()) as unknown;
        const translated = getBetterAuthErrorMessage(body);
        if (translated) {
          const newBody = {
            ...(body as Record<string, unknown>),
            message: translated,
          };
          return c.json(newBody, response.status as 400);
        }
      } catch {}
    }

    return response;
  });
}
