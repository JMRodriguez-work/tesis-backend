import { z } from '@hono/zod-openapi'

const branchRefSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
})

export const listCustomersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  search: z.string().trim().min(1).max(255).optional(),
  isActive: z.coerce.boolean().optional(),
  branchId: z.string().uuid().optional(),
})

export const customerIdParamSchema = z.object({
  id: z.string().uuid(),
})

export const createCustomerSchema = z
  .object({
    fullname: z.string().trim().min(1).max(255),
    email: z.string().email().max(255).optional(),
    phone: z.string().trim().min(1).max(50).optional(),
    address: z.string().max(500).optional(),
    branchId: z.string().uuid().optional(),
  })
  .strict()

export const updateCustomerSchema = z
  .object({
    fullname: z.string().trim().min(1).max(255).optional(),
    email: z.string().email().max(255).nullable().optional(),
    phone: z.string().trim().min(1).max(50).nullable().optional(),
    address: z.string().max(500).nullable().optional(),
    isActive: z.boolean().optional(),
    branchId: z.string().uuid().optional(),
  })
  .strict()

export const customerSchema = z.object({
  id: z.string().uuid(),
  fullname: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  isActive: z.boolean(),
  organizationId: z.string().uuid(),
  branchId: z.string().uuid(),
  branch: branchRefSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const customerResponseSchema = z.object({
  data: customerSchema,
  message: z.string(),
  status: z.number(),
})

export const customerListResponseSchema = z.object({
  data: z.object({
    data: z.array(customerSchema),
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

export const customerDeleteResponseSchema = z.object({
  data: z.null(),
  message: z.string(),
  status: z.number(),
})

export const customerSalesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  includeCancelled: z.coerce.boolean().optional().default(true),
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

const customerPurchaseSummarySchema = z.object({
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
