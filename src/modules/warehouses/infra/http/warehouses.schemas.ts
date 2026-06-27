import { z } from '@hono/zod-openapi'

const decimalStringSchema = z
  .string()
  .regex(/^\d+(\.\d{1,3})?$/, 'Debe ser un decimal positivo con hasta 3 decimales')

const nonNegativeDecimalSchema = z
  .string()
  .regex(/^\d+(\.\d{1,3})?$/, 'Debe ser un decimal no negativo')

const branchRefSchema = z.object({ id: z.string().uuid(), name: z.string() })

export const listWarehousesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  search: z.string().trim().min(1).max(255).optional(),
  isActive: z.coerce.boolean().optional(),
})

export const warehouseIdParamSchema = z.object({
  id: z.string().uuid(),
})

export const itemIdParamSchema = z.object({
  id: z.string().uuid(),
})

export const createWarehouseSchema = z
  .object({
    name: z.string().trim().min(1).max(255),
    description: z.string().max(2000).optional(),
    branchIds: z.array(z.string().uuid()).min(1),
  })
  .strict()

export const updateWarehouseSchema = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    description: z.string().max(2000).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .strict()

export const assignBranchSchema = z
  .object({
    branchId: z.string().uuid(),
  })
  .strict()

export const warehouseBranchParamsSchema = z.object({
  id: z.string().uuid(),
  branchId: z.string().uuid(),
})

export const listStockQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  search: z.string().trim().min(1).max(255).optional(),
  status: z.enum(['low', 'ok', 'out']).optional(),
})

export const upsertStockSchema = z
  .object({
    itemId: z.string().uuid(),
    quantity: nonNegativeDecimalSchema,
    minStock: nonNegativeDecimalSchema.optional(),
  })
  .strict()

export const updateMinStockSchema = z
  .object({
    minStock: nonNegativeDecimalSchema,
  })
  .strict()

const organizationRefSchema = z.object({ id: z.string().uuid(), name: z.string() })

export const warehouseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  isActive: z.boolean(),
  organizationId: z.string().uuid(),
  organization: organizationRefSchema,
  branches: z.array(branchRefSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const warehouseResponseSchema = z.object({
  data: warehouseSchema,
  message: z.string(),
  status: z.number(),
})

export const warehouseListResponseSchema = z.object({
  data: z.object({
    data: z.array(warehouseSchema),
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

export const warehouseDeleteResponseSchema = z.object({
  data: z.null(),
  message: z.string(),
  status: z.number(),
})

export const stockRowSchema = z.object({
  itemId: z.string().uuid(),
  itemName: z.string(),
  itemCode: z.string().nullable(),
  unitType: z.enum(['count', 'weight', 'volume']).nullable(),
  quantity: z.string(),
  minStock: z.string(),
  status: z.enum(['low', 'ok', 'out']),
})

export const stockListResponseSchema = z.object({
  data: z.object({
    data: z.array(stockRowSchema),
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

export const stockByItemResponseSchema = z.object({
  data: z.array(
    stockRowSchema.extend({
      warehouseId: z.string().uuid(),
      warehouseName: z.string(),
    }),
  ),
  message: z.string(),
  status: z.number(),
})

export const upsertStockResponseSchema = z.object({
  data: z.object({
    id: z.string().uuid(),
    itemId: z.string().uuid(),
    warehouseId: z.string().uuid(),
    quantity: z.string(),
    minStock: z.string(),
  }),
  message: z.string(),
  status: z.number(),
})

export const minStockResponseSchema = z.object({
  data: z.object({ itemId: z.string().uuid(), minStock: z.string() }),
  message: z.string(),
  status: z.number(),
})
