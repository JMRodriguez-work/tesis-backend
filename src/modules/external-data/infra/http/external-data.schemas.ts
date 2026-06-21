import { z } from "@hono/zod-openapi";

export const externalDataSourceTypeSchema = z.enum([
  "search_trends",
  "wholesale_prices",
  "seasonality",
]);

export const externalDataSourceIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const externalDataSourceSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: externalDataSourceTypeSchema,
  url: z.string().nullable(),
  lastFetchedAt: z.string().nullable(),
  data: z.unknown(),
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
