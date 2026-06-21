import { z } from "@hono/zod-openapi";

export const externalDataSourceTypeSchema = z.enum([
  "search_trends",
  "wholesale_prices",
  "seasonality",
]);

export const externalDataSourceIdParamSchema = z.object({
  id: z.string().uuid(),
});

const emptyToUndefined = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

export const authConfigSchema = z
  .object({
    headers: z.record(z.string(), z.string()).optional(),
    queryParams: z.record(z.string(), z.string()).optional(),
  })
  .strict()
  .optional();

export const createSourceSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    type: externalDataSourceTypeSchema,
    url: z.preprocess(emptyToUndefined, z.string().url().max(2000).optional()),
    authConfig: authConfigSchema,
    isActive: z.boolean().optional().default(true),
  })
  .strict();

export const updateSourceSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    type: externalDataSourceTypeSchema.optional(),
    url: z.preprocess(
      emptyToUndefined,
      z.string().url().max(2000).nullable().optional(),
    ),
    authConfig: authConfigSchema.nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export const listSourcesQuerySchema = z.object({
  isActive: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  type: externalDataSourceTypeSchema.optional(),
});

export const externalDataSourceSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: externalDataSourceTypeSchema,
  url: z.string().nullable(),
  lastFetchedAt: z.string().nullable(),
  data: z.unknown(),
  isActive: z.boolean(),
  lastError: z.string().nullable(),
  lastErrorAt: z.string().nullable(),
  authConfig: authConfigSchema
    .nullable()
    .or(z.record(z.string(), z.unknown()).nullable()),
});

export const externalDataSourcesListResponseSchema = z.object({
  data: z.object({
    data: z.array(externalDataSourceSchema),
    meta: z.object({ total: z.number() }),
  }),
  message: z.string(),
  status: z.number(),
});

export const externalDataSourceResponseSchema = z.object({
  data: externalDataSourceSchema,
  message: z.string(),
  status: z.number(),
});

export const enqueueFetchExternalDataResponseSchema = z.object({
  data: z.object({
    jobId: z.string().uuid(),
    status: z.literal("queued"),
    queueName: z.literal("tfg-analytics"),
  }),
  message: z.string(),
  status: z.number(),
});
