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

export const itemResponseSchema = z.object({
  data: itemSchema,
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
