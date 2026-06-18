import { z } from '@hono/zod-openapi'

export const listItemCategoriesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).max(255).optional(),
  isActive: z.coerce.boolean().optional(),
  branchId: z.string().uuid().optional(),
})

export const itemCategoryIdParamSchema = z.object({
  id: z.string().uuid(),
})

export const createItemCategorySchema = z
  .object({
    name: z.string().trim().min(1).max(255),
    description: z.string().max(1000).optional(),
    isActive: z.boolean().optional(),
    branchId: z.string().uuid().optional(),
  })
  .strict()

export const updateItemCategorySchema = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    description: z.string().max(1000).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .strict()

const branchRelationSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
})

export const itemCategorySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  isActive: z.boolean(),
  branchId: z.string().uuid(),
  branch: branchRelationSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const itemCategoryResponseSchema = z.object({
  data: itemCategorySchema,
  message: z.string(),
  status: z.number(),
})

export const itemCategoryListResponseSchema = z.object({
  data: z.object({
    data: z.array(itemCategorySchema),
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

export const itemCategoryDeleteResponseSchema = z.object({
  data: z.null(),
  message: z.string(),
  status: z.number(),
})
