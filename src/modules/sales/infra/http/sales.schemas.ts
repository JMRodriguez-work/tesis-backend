import { z } from '@hono/zod-openapi'

const quantitySchema = z
  .string()
  .regex(/^\d+(\.\d{1,3})?$/, 'Cantidad debe ser decimal positivo con hasta 3 decimales')

const priceSchema = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, 'Precio debe ser decimal positivo con hasta 2 decimales')

const discountSchema = z
  .string()
  .regex(/^\d{1,3}(\.\d{1,2})?$/, 'Descuento debe ser un número entre 0 y 100')

export const createSaleItemSchema = z
  .object({
    itemId: z.string().uuid(),
    warehouseId: z.string().uuid().optional(),
    quantity: quantitySchema,
    price: priceSchema,
    unitId: z.number().int().positive().optional(),
  })
  .strict()

export const createSaleSchema = z
  .object({
    branchId: z.string().uuid().optional(),
    customerId: z.string().uuid().optional(),
    discountPercent: discountSchema.optional(),
    notes: z.string().max(2000).optional(),
    items: z.array(createSaleItemSchema).min(1).max(200),
  })
  .strict()

export const cancelSaleSchema = z
  .object({
    cancellationReason: z.string().trim().min(3).max(500),
  })
  .strict()

export const listSalesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  branchId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  includeCancelled: z.coerce.boolean().optional().default(false),
})

export const exportSalesQuerySchema = z.object({
  format: z.enum(['csv', 'json']).optional().default('csv'),
  branchId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
})

export const customerSalesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  includeCancelled: z.coerce.boolean().optional().default(true),
})

export const saleIdParamSchema = z.object({
  id: z.string().uuid(),
})

// ─── Response schemas ──────────────────────────────────────────────────────

const userRefSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
})

const customerRefSchema = z.object({
  id: z.string().uuid(),
  fullname: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
})

const branchRefSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
})

const saleItemSchema = z.object({
  id: z.string().uuid(),
  itemId: z.string().uuid(),
  itemName: z.string(),
  itemCode: z.string().nullable(),
  unitId: z.number().int().nullable(),
  warehouseId: z.string().uuid(),
  warehouseName: z.string(),
  quantity: z.string(),
  price: z.string(),
  lineTotal: z.string(),
})

export const saleSchema = z.object({
  id: z.string().uuid(),
  branchId: z.string().uuid(),
  branch: branchRefSchema,
  customer: customerRefSchema.nullable(),
  createdBy: userRefSchema,
  total: z.string(),
  discountPercent: z.string(),
  subtotal: z.string(),
  notes: z.string().nullable(),
  isActive: z.boolean(),
  status: z.enum(['active', 'cancelled']),
  cancellationReason: z.string().nullable(),
  items: z.array(saleItemSchema),
  createdAt: z.string(),
  deletedAt: z.string().nullable(),
})

export const saleResponseSchema = z.object({
  data: saleSchema,
  message: z.string(),
  status: z.number(),
})

const saleListRowSchema = z.object({
  id: z.string().uuid(),
  branchId: z.string().uuid(),
  branchName: z.string(),
  customerId: z.string().uuid().nullable(),
  customerName: z.string().nullable(),
  total: z.string(),
  discountPercent: z.string(),
  itemCount: z.number(),
  status: z.enum(['active', 'cancelled']),
  createdAt: z.string(),
})

export const saleListResponseSchema = z.object({
  data: z.object({
    data: z.array(saleListRowSchema),
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

export const cancelSaleResponseSchema = z.object({
  data: z.object({
    sale: saleSchema,
    alreadyCancelled: z.boolean(),
  }),
  message: z.string(),
  status: z.number(),
})

export const customerPurchaseSummarySchema = z.object({
  totalSpent: z.string(),
  purchaseCount: z.number(),
  lastPurchaseAt: z.string().nullable(),
  averageTicket: z.string(),
})

export const customerSalesResponseSchema = z.object({
  data: z.object({
    data: z.array(saleListRowSchema),
    summary: customerPurchaseSummarySchema,
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
