import { z } from '@hono/zod-openapi'

const branchRelationSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
})

const roleRelationSchema = z.object({
  id: z.number().int(),
  name: z.string(),
})

export const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  organizationId: z.string().uuid().nullable(),
  branchId: z.string().uuid().nullable(),
  roleId: z.number().int().nullable(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  branch: branchRelationSchema.nullable(),
  role: roleRelationSchema.nullable(),
})

export const userListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).max(255).optional(),
  roleId: z.coerce.number().int().positive().optional(),
})

export const userIdParamSchema = z.object({
  id: z.string().min(1),
})

export const createUserSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  name: z.string().trim().min(1).max(255),
  branchId: z.string().uuid().optional(),
  roleId: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
})

export const updateUserSchema = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    branchId: z.string().uuid().nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .strict()

export const changeUserRoleSchema = z.object({
  roleId: z.number().int().positive(),
})

export const userResponseSchema = z.object({
  data: userSchema,
  message: z.string(),
  status: z.number(),
})

export const userListResponseSchema = z.object({
  data: z.object({
    data: z.array(userSchema),
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

export const userDeleteResponseSchema = z.object({
  data: z.null(),
  message: z.string(),
  status: z.number(),
})
