import { z } from '@hono/zod-openapi'

export const completeOnboardingSchema = z.object({
  organizationName: z.string().min(1).max(255),
  branchName: z.string().min(1).max(255),
})

export const onboardingResponseSchema = z.object({
  data: z.object({
    organizationId: z.string(),
    branchId: z.string(),
    roleId: z.number(),
  }),
  message: z.string(),
  status: z.number(),
})
