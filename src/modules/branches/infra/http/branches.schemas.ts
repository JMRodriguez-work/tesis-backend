import { z } from '@hono/zod-openapi'

export const listBranchesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).max(255).optional(),
  isActive: z.coerce.boolean().optional(),
})

export const branchIdParamSchema = z.object({
  id: z.string().uuid(),
})

export const createBranchSchema = z.object({
  name: z.string().trim().min(1).max(255),
  isActive: z.boolean().optional(),
})

export const updateBranchSchema = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    isActive: z.boolean().optional(),
  })
  .strict()

const organizationRelationSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
})

export const branchSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  isActive: z.boolean(),
  organizationId: z.string().uuid(),
  organization: organizationRelationSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const branchResponseSchema = z.object({
  data: branchSchema,
  message: z.string(),
  status: z.number(),
})

export const branchListResponseSchema = z.object({
  data: z.object({
    data: z.array(branchSchema),
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

export const branchDeleteResponseSchema = z.object({
  data: z.null(),
  message: z.string(),
  status: z.number(),
})
