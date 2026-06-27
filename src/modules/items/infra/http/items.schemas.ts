import { z } from '@hono/zod-openapi'

const decimalStringSchema = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, 'Debe ser un decimal positivo con hasta 2 decimales')

const branchRelationSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
})

const categoryRelationSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
})

const baseUnitRelationSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  abbreviation: z.string(),
  unitType: z.string(),
  conversionFactor: z.string(),
})

export const itemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  categoryId: z.string().uuid().nullable(),
  baseUnitId: z.number().int().nullable(),
  purchasePrice: z.string().nullable(),
  salePrice: z.string().nullable(),
  code: z.string().nullable(),
  barcode: z.string().nullable(),
  isActive: z.boolean(),
  branchId: z.string().uuid(),
  branch: branchRelationSchema,
  category: categoryRelationSchema.nullable(),
  baseUnit: baseUnitRelationSchema.nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const listItemsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).max(255).optional(),
  categoryId: z.string().uuid().optional(),
  isActive: z.coerce.boolean().optional(),
  branchId: z.string().uuid().optional(),
})

export const itemIdParamSchema = z.object({
  id: z.string().uuid(),
})

export const itemBarcodeParamSchema = z.object({
  code: z.string().trim().min(1).max(255),
})

export const createItemSchema = z
  .object({
    name: z.string().trim().min(1).max(255),
    description: z.string().max(2000).optional(),
    categoryId: z.string().uuid().optional(),
    baseUnitId: z.number().int().positive().optional(),
    purchasePrice: decimalStringSchema.optional(),
    salePrice: decimalStringSchema.optional(),
    code: z.string().trim().min(1).max(100).optional(),
    barcode: z.string().trim().min(1).max(100).optional(),
    isActive: z.boolean().optional(),
    branchId: z.string().uuid().optional(),
  })
  .strict()

export const updateItemSchema = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    description: z.string().max(2000).nullable().optional(),
    categoryId: z.string().uuid().nullable().optional(),
    baseUnitId: z.number().int().positive().nullable().optional(),
    purchasePrice: decimalStringSchema.nullable().optional(),
    salePrice: decimalStringSchema.nullable().optional(),
    code: z.string().trim().min(1).max(100).nullable().optional(),
    barcode: z.string().trim().min(1).max(100).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .strict()

const pricingWarningSchema = z.object({
  field: z.literal('salePrice'),
  message: z.string(),
  salePrice: z.string(),
  purchasePrice: z.string(),
})

export const itemResponseSchema = z.object({
  data: z.object({
    item: itemSchema,
    warning: pricingWarningSchema.nullable(),
  }),
  message: z.string(),
  status: z.number(),
})

export const itemListResponseSchema = z.object({
  data: z.object({
    data: z.array(itemSchema),
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

export const itemDeleteResponseSchema = z.object({
  data: z.null(),
  message: z.string(),
  status: z.number(),
})

export const itemStockWarehouseSchema = z.object({
  warehouseId: z.string().uuid(),
  warehouseName: z.string(),
  unitType: z.enum(['count', 'weight', 'volume']).nullable(),
  quantity: z.string(),
  minStock: z.string(),
  status: z.enum(['out', 'low', 'ok']),
})

export const itemStockRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  code: z.string().nullable(),
  isActive: z.boolean(),
  unitType: z.enum(['count', 'weight', 'volume']).nullable(),
  category: categoryRelationSchema.nullable(),
  totalQuantity: z.string(),
  totalMinStock: z.string(),
  status: z.enum(['out', 'low', 'ok']),
  warehouses: z.array(itemStockWarehouseSchema),
})

export const listItemsWithStockQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).max(255).optional(),
  status: z.enum(['out', 'low', 'ok']).optional(),
  showInactive: z.coerce.boolean().optional().default(false),
  branchId: z.string().uuid().optional(),
})

export const itemsWithStockListResponseSchema = z.object({
  data: z.object({
    data: z.array(itemStockRowSchema),
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
