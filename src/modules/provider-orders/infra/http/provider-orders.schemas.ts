import { z } from '@hono/zod-openapi'

const quantitySchema = z
  .string()
  .regex(/^\d+(\.\d{1,3})?$/, 'Cantidad debe ser decimal positivo con hasta 3 decimales')

const costSchema = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, 'Costo debe ser decimal positivo con hasta 2 decimales')

const createItemSchema = z
  .object({
    itemId: z.string().uuid(),
    quantity: quantitySchema,
    cost: costSchema,
    unitId: z.number().int().positive().optional(),
  })
  .strict()

export const createProviderOrderSchema = z
  .object({
    branchId: z.string().uuid().optional(),
    providerId: z.string().uuid(),
    estimatedDelivery: z.coerce.date().optional(),
    items: z.array(createItemSchema).min(1).max(200),
  })
  .strict()

export const updateProviderOrderSchema = z
  .object({
    estimatedDelivery: z.coerce.date().nullable().optional(),
  })
  .strict()

export const receiveProviderOrderSchema = z
  .object({
    warehouseId: z.string().uuid(),
  })
  .strict()

export const listProviderOrdersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  branchId: z.string().uuid().optional(),
  providerId: z.string().uuid().optional(),
  status: z.enum(['pending', 'received', 'cancelled']).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
})

export const providerOrderIdParamSchema = z.object({
  id: z.string().uuid(),
})

// ─── Response schemas ──────────────────────────────────────────────────────

const userRefSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
})

const branchRefSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
})

const providerRefSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
})

const providerOrderItemSchema = z.object({
  id: z.string().uuid(),
  itemId: z.string().uuid(),
  itemName: z.string(),
  itemCode: z.string().nullable(),
  unitId: z.number().int().nullable(),
  quantity: z.string(),
  cost: z.string(),
  lineTotal: z.string(),
})

export const providerOrderSchema = z.object({
  id: z.string().uuid(),
  branchId: z.string().uuid(),
  branch: branchRefSchema,
  provider: providerRefSchema,
  createdBy: userRefSchema,
  status: z.enum(['pending', 'received', 'cancelled']),
  total: z.string(),
  estimatedDelivery: z.string().nullable(),
  items: z.array(providerOrderItemSchema),
  createdAt: z.string(),
})

export const providerOrderResponseSchema = z.object({
  data: providerOrderSchema,
  message: z.string(),
  status: z.number(),
})

const providerOrderListRowSchema = z.object({
  id: z.string().uuid(),
  branchId: z.string().uuid(),
  branchName: z.string(),
  providerId: z.string().uuid(),
  providerName: z.string(),
  status: z.enum(['pending', 'received', 'cancelled']),
  total: z.string(),
  itemCount: z.number(),
  estimatedDelivery: z.string().nullable(),
  createdAt: z.string(),
})

export const providerOrderListResponseSchema = z.object({
  data: z.object({
    data: z.array(providerOrderListRowSchema),
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

export const providerOrderCancelResponseSchema = z.object({
  data: z.object({
    order: providerOrderSchema,
    alreadyCancelled: z.boolean(),
  }),
  message: z.string(),
  status: z.number(),
})

export const providerOrderDeleteResponseSchema = z.object({
  data: z.null(),
  message: z.string(),
  status: z.number(),
})
