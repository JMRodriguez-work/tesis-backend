import { z } from '@hono/zod-openapi'

export const unitSchema = z.object({
  id: z.number().int(),
  baseUnitId: z.number().int().nullable(),
  name: z.string(),
  abbreviation: z.string(),
  unitType: z.string(),
  conversionFactor: z.string(),
  createdAt: z.string(),
})

export const unitListResponseSchema = z.object({
  data: z.array(unitSchema),
  message: z.string(),
  status: z.number(),
})

export const unitResponseSchema = z.object({
  data: unitSchema,
  message: z.string(),
  status: z.number(),
})

export const unitIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
})
