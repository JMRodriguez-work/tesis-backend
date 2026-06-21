import { z } from "@hono/zod-openapi";

export const trendIntervalSchema = z.enum(["day", "week", "month"]);

export const salesTrendQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  interval: trendIntervalSchema,
  branchId: z.string().uuid().optional(),
});

export const revenueTimelineQuerySchema = salesTrendQuerySchema;

export const topItemsQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  sortBy: z.enum(["quantity", "revenue"]).optional().default("revenue"),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  branchId: z.string().uuid().optional(),
});

export const categoryDistributionQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  branchId: z.string().uuid().optional(),
});

const trendBucketSchema = z.object({
  bucket: z.string(),
  totalSales: z.string(),
});

const salesTrendBucketSchema = trendBucketSchema.extend({
  transactionCount: z.number(),
});

const topItemSchema = z.object({
  itemId: z.string().uuid(),
  itemName: z.string(),
  itemCode: z.string().nullable(),
  categoryId: z.string().uuid().nullable(),
  categoryName: z.string().nullable(),
  totalQuantitySold: z.string(),
  totalRevenue: z.string(),
  transactionCount: z.number(),
  lastSoldAt: z.string().nullable(),
});

const categoryDistributionRowSchema = z.object({
  categoryId: z.string().uuid().nullable(),
  categoryName: z.string(),
  totalRevenue: z.string(),
  transactionCount: z.number(),
  itemCount: z.number(),
});

export const salesTrendResponseSchema = z.object({
  data: z.object({
    data: z.array(salesTrendBucketSchema),
    interval: trendIntervalSchema,
    from: z.string(),
    to: z.string(),
    meta: z.object({ total: z.number() }),
  }),
  message: z.string(),
  status: z.number(),
});

export const revenueTimelineResponseSchema = z.object({
  data: z.object({
    data: z.array(trendBucketSchema),
    interval: trendIntervalSchema,
    from: z.string(),
    to: z.string(),
    meta: z.object({ total: z.number() }),
  }),
  message: z.string(),
  status: z.number(),
});

export const topItemsResponseSchema = z.object({
  data: z.object({
    data: z.array(topItemSchema),
    meta: z.object({
      from: z.string(),
      to: z.string(),
      sortBy: z.enum(["quantity", "revenue"]),
      limit: z.number(),
    }),
  }),
  message: z.string(),
  status: z.number(),
});

export const categoryDistributionResponseSchema = z.object({
  data: z.object({
    data: z.array(categoryDistributionRowSchema),
    meta: z.object({
      from: z.string(),
      to: z.string(),
    }),
  }),
  message: z.string(),
  status: z.number(),
});
