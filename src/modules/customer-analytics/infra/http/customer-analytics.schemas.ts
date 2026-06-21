import { z } from "@hono/zod-openapi";

export const segmentNameSchema = z.enum([
  "vip",
  "frequent",
  "occasional",
  "new",
  "inactive",
  "dormant",
]);

export const detectInactiveSchema = z
  .object({
    days: z.coerce.number().int().min(1).max(365).optional().default(60),
    branchId: z.string().uuid().optional(),
  })
  .strict();

export const inactiveCustomersQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
});

export const segmentsQuerySchema = z.object({
  segment: segmentNameSchema.optional(),
  branchId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const enqueueDetectInactiveResponseSchema = z.object({
  data: z.object({
    jobId: z.string().uuid(),
    status: z.literal("queued"),
    queueName: z.literal("tfg-analytics"),
  }),
  message: z.string(),
  status: z.number(),
});

const inactiveCustomerRowSchema = z.object({
  customerId: z.string().uuid(),
  customerFullname: z.string(),
  customerEmail: z.string().nullable(),
  customerPhone: z.string().nullable(),
  branchId: z.string().uuid(),
  branchName: z.string(),
  lastPurchaseAt: z.string().nullable(),
  daysSinceLastPurchase: z.number().nullable(),
  totalSpent: z.string(),
  purchaseCount: z.number(),
  recommendationId: z.string().uuid(),
  recommendationGeneratedAt: z.string(),
});

export const inactiveCustomersResponseSchema = z.object({
  data: z.object({
    data: z.array(inactiveCustomerRowSchema),
    meta: z.object({ total: z.number(), limit: z.number() }),
  }),
  message: z.string(),
  status: z.number(),
});

const segmentRowSchema = z.object({
  customerId: z.string().uuid(),
  customerFullname: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  branchId: z.string().uuid(),
  branchName: z.string(),
  segment: segmentNameSchema,
  totalSpent: z.string(),
  purchaseCount: z.number(),
  lastPurchaseAt: z.string().nullable(),
});

export const customerSegmentsResponseSchema = z.object({
  data: z.object({
    data: z.array(segmentRowSchema),
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
