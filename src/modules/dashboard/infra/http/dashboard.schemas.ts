import { z } from "@hono/zod-openapi";

export const salesSummaryQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const productRotationQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  categoryId: z.string().uuid().optional(),
  includeZeroSales: z.coerce.boolean().optional().default(false),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const summaryBucketSchema = z.object({
  totalSales: z.string(),
  transactionCount: z.number(),
  averageTicket: z.string(),
});

export const salesSummaryResponseSchema = z.object({
  data: z.object({
    today: summaryBucketSchema.extend({ date: z.string() }),
    thisWeek: summaryBucketSchema.extend({
      fromDate: z.string(),
      toDate: z.string(),
    }),
    previousWeek: summaryBucketSchema.extend({
      fromDate: z.string(),
      toDate: z.string(),
    }),
    comparison: z.object({
      totalSalesDelta: z.number(),
      transactionCountDelta: z.number(),
      averageTicketDelta: z.number(),
    }),
  }),
  message: z.string(),
  status: z.number(),
});

const productRotationRowSchema = z.object({
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

export const productRotationResponseSchema = z.object({
  data: z.object({
    data: z.array(productRotationRowSchema),
    meta: z.object({
      page: z.number(),
      limit: z.number(),
      total: z.number(),
      totalPages: z.number(),
    }),
  }),
  message: z.string(),
  status: z.number(),
});
