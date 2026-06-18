import { z } from '@hono/zod-openapi'

export const organizationIdParamSchema = z.object({
  id: z.string().uuid(),
})

export const updateOrganizationSchema = z.object({
  name: z.string().trim().min(1).max(255),
})

export const organizationSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const organizationResponseSchema = z.object({
  data: organizationSchema,
  message: z.string(),
  status: z.number(),
})
