import { z } from '@hono/zod-openapi'

const optionalString = (max: number) =>
  z
    .preprocess(
      (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
      z.string().trim().max(max).optional(),
    )

const nullableString = (max: number) =>
  z
    .preprocess(
      (v) => {
        if (v === null) return null
        if (typeof v === 'string' && v.trim() === '') return null
        return v
      },
      z.string().trim().max(max).nullable(),
    )

const optionalEmail = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z.string().email().max(100).optional(),
)

const nullableEmail = z.preprocess(
  (v) => {
    if (v === null) return null
    if (typeof v === 'string' && v.trim() === '') return null
    return v
  },
  z.string().email().max(100).nullable(),
)

export const listProvidersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).max(255).optional(),
  isActive: z.coerce.boolean().optional(),
})

export const providerIdParamSchema = z.object({
  id: z.string().uuid(),
})

export const createProviderSchema = z
  .object({
    name: z.string().trim().min(1).max(255),
    companyName: optionalString(255),
    contactName: optionalString(100),
    contactEmail: optionalEmail,
    contactPhone: optionalString(50),
  })
  .strict()

export const updateProviderSchema = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    companyName: nullableString(255).optional(),
    contactName: nullableString(100).optional(),
    contactEmail: nullableEmail.optional(),
    contactPhone: nullableString(50).optional(),
    isActive: z.boolean().optional(),
  })
  .strict()

export const providerSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  companyName: z.string().nullable(),
  contactName: z.string().nullable(),
  contactEmail: z.string().nullable(),
  contactPhone: z.string().nullable(),
  isActive: z.boolean(),
  organizationId: z.string().uuid(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const providerResponseSchema = z.object({
  data: providerSchema,
  message: z.string(),
  status: z.number(),
})

export const providerListResponseSchema = z.object({
  data: z.object({
    data: z.array(providerSchema),
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

export const providerDeleteResponseSchema = z.object({
  data: z.null(),
  message: z.string(),
  status: z.number(),
})
