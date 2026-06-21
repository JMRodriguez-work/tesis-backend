import { z } from '@hono/zod-openapi'

export const listRecommendationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  branchId: z.string().uuid().optional(),
  type: z
    .enum(['restock', 'pricing', 'trend', 'seasonal', 'retention'])
    .optional(),
  status: z.enum(['pending', 'applied', 'dismissed']).optional().default('pending'),
  itemId: z.string().uuid().optional(),
})

export const recommendationIdParamSchema = z.object({
  id: z.string().uuid(),
})

export const updateRecommendationStatusSchema = z
  .object({
    status: z.enum(['pending', 'applied', 'dismissed']),
  })
  .strict()

// ─── Response schemas ──────────────────────────────────────────────────────

const branchRefSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
})

const itemRefSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  code: z.string().nullable(),
})

const customerRefSchema = z.object({
  id: z.string().uuid(),
  fullname: z.string(),
})

export const recommendationSchema = z.object({
  id: z.string().uuid(),
  branchId: z.string().uuid(),
  branch: branchRefSchema,
  itemId: z.string().uuid().nullable(),
  item: itemRefSchema.nullable(),
  customerId: z.string().uuid().nullable(),
  customer: customerRefSchema.nullable(),
  type: z.enum(['restock', 'pricing', 'trend', 'seasonal', 'retention']),
  description: z.string(),
  priority: z.enum(['high', 'medium', 'low']),
  status: z.enum(['pending', 'applied', 'dismissed']),
  generatedAt: z.string(),
  expiresAt: z.string().nullable(),
})

export const recommendationResponseSchema = z.object({
  data: recommendationSchema,
  message: z.string(),
  status: z.number(),
})

const recommendationListRowSchema = z.object({
  id: z.string().uuid(),
  branchId: z.string().uuid(),
  branchName: z.string(),
  itemId: z.string().uuid().nullable(),
  itemName: z.string().nullable(),
  itemCode: z.string().nullable(),
  customerId: z.string().uuid().nullable(),
  customerFullname: z.string().nullable(),
  type: z.enum(['restock', 'pricing', 'trend', 'seasonal', 'retention']),
  description: z.string(),
  priority: z.enum(['high', 'medium', 'low']),
  status: z.enum(['pending', 'applied', 'dismissed']),
  generatedAt: z.string(),
  expiresAt: z.string().nullable(),
})

export const recommendationListResponseSchema = z.object({
  data: z.object({
    data: z.array(recommendationListRowSchema),
    meta: z.object({
      page: z.number(),
      limit: z.number(),
      total: z.number(),
      totalPages: z.number(),
    }),
  }),
  message: z.string(),
  status: z.number(),
})
