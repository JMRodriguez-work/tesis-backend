import { createRoute } from "@hono/zod-openapi";
import { authMiddleware } from "../../../../shared/auth";
import { ApiError } from "../../../../shared/http/api-response";
import { CompleteOnboarding } from "../../use-cases/complete-onboarding.use-case";
import {
  completeOnboardingSchema,
  onboardingResponseSchema,
} from "./onboarding.schemas";
import type { AppType } from "../../../../shared/types/app";

export function registerOnboardingRoutes(app: AppType) {
  app.openapi(
    createRoute({
      method: "post",
      path: "/api/v1/onboarding",
      tags: ["Onboarding"],
      summary: "Completar onboarding del usuario autenticado",
      description:
        "Crea la organización y sucursal inicial, asigna al usuario autenticado como Admin de la misma. Solo usable si el usuario aún no tiene organización asignada.",
      middleware: [authMiddleware] as const,
      security: [{ cookieAuth: [] }],
      request: {
        body: {
          content: { "application/json": { schema: completeOnboardingSchema } },
        },
      },
      responses: {
        200: {
          description: "Onboarding completado",
          content: { "application/json": { schema: onboardingResponseSchema } },
        },
        400: { description: "Datos inválidos" },
        401: { description: "No autenticado" },
        409: { description: "El usuario ya completó el onboarding" },
      },
    }),
    async (c) => {
      const user = c.get("user");
      if (user.organizationId) {
        throw new ApiError(
          "El usuario ya tiene una organización asignada",
          409,
        );
      }

      const body = c.req.valid("json");
      const db = c.get("db");

      const useCase = new CompleteOnboarding(db);
      const result = await useCase.execute({
        userId: user.id,
        organizationName: body.organizationName,
        branchName: body.branchName,
      });

      return c.json(
        { data: result, message: "Onboarding completado", status: 200 },
        200,
      );
    },
  );
}
