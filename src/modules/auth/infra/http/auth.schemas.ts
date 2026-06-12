import { z } from '@hono/zod-openapi'

export const authUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  organizationId: z.string().nullable(),
  branchId: z.string().nullable(),
  roleId: z.number().nullable(),
  isActive: z.boolean(),
})
