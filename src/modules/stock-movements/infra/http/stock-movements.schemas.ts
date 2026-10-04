import { z } from '@hono/zod-openapi'

const quantitySchema = z
  .string()
  .regex(/^\d+(\.\d{1,3})?$/, 'Cantidad debe ser decimal positivo con hasta 3 decimales')

export const adjustmentSchema = z
  .object({
    branchId: z.string().uuid(),
    warehouseId: z.string().uuid(),
    itemId: z.string().uuid(),
    direction: z.enum(['in', 'out']),
    quantity: quantitySchema,
    notes: z.string().trim().max(500).optional(),
  })
  .strict()

export const transferSchema = z
  .object({
    branchId: z.string().uuid(),
    itemId: z.string().uuid(),
    fromWarehouseId: z.string().uuid(),
    toWarehouseId: z.string().uuid(),
    quantity: quantitySchema,
    notes: z.string().trim().max(500).optional(),
  })
  .strict()
  .refine((d) => d.fromWarehouseId !== d.toWarehouseId, {
    message: 'El depósito de origen y destino no pueden ser iguales',
  })

export const listStockMovementsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  itemId: z.string().uuid().optional(),
  type: z.enum(['in', 'out', 'transfer', 'adjustment']).optional(),
  branchId: z.string().uuid().optional(),
  warehouseId: z.string().uuid().optional(),
  referenceType: z.string().optional(),
  referenceId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
})

export const itemStockHistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  warehouseId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
})

export const stockMovementIdParamSchema = z.object({
  id: z.string().uuid(),
})

export const itemIdParamSchema = z.object({
  id: z.string().uuid(),
})

export const warehouseIdParamSchema = z.object({
  id: z.string().uuid(),
})

// ─── Response schemas ──────────────────────────────────────────────────────

const itemRefSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  code: z.string().nullable(),
})

const branchRefSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
})

const warehouseRefSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
})

const userRefSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
})

export const stockMovementSchema = z.object({
  id: z.string().uuid(),
  itemId: z.string().uuid(),
  item: itemRefSchema,
  branchId: z.string().uuid(),
  branch: branchRefSchema,
  fromWarehouse: warehouseRefSchema.nullable(),
  toWarehouse: warehouseRefSchema.nullable(),
  type: z.enum(['in', 'out', 'transfer', 'adjustment']),
  quantity: z.string(),
  referenceType: z.string().nullable(),
  referenceId: z.string().uuid().nullable(),
  notes: z.string().nullable(),
  createdBy: userRefSchema,
  createdAt: z.string(),
})

export const stockMovementResponseSchema = z.object({
  data: stockMovementSchema,
  message: z.string(),
  status: z.number(),
})

const stockMovementListRowSchema = z.object({
  id: z.string().uuid(),
  itemId: z.string().uuid(),
  itemName: z.string(),
  itemCode: z.string().nullable(),
  branchId: z.string().uuid(),
  branchName: z.string(),
  fromWarehouseId: z.string().uuid().nullable(),
  fromWarehouseName: z.string().nullable(),
  toWarehouseId: z.string().uuid().nullable(),
  toWarehouseName: z.string().nullable(),
  type: z.enum(['in', 'out', 'transfer', 'adjustment']),
  quantity: z.string(),
  referenceType: z.string().nullable(),
  referenceId: z.string().uuid().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
})

export const stockMovementListResponseSchema = z.object({
  data: z.object({
    data: z.array(stockMovementListRowSchema),
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

export const stockHistoryRowSchema = stockMovementListRowSchema.extend({
  runningBalance: z.string(),
})

export const stockHistoryResponseSchema = z.object({
  data: z.object({
    data: z.array(stockHistoryRowSchema),
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

export const lowStockItemSchema = z.object({
  itemId: z.string().uuid(),
  itemName: z.string(),
  itemCode: z.string().nullable(),
  unitType: z.enum(['count', 'weight', 'volume']).nullable(),
  warehouseId: z.string().uuid(),
  warehouseName: z.string(),
  branchId: z.string().uuid(),
  branchName: z.string(),
  quantity: z.string(),
  minStock: z.string(),
  deficit: z.string(),
  status: z.enum(['out', 'low']),
})

export const lowStockItemsResponseSchema = z.object({
  data: z.array(lowStockItemSchema),
  message: z.string(),
  status: z.number(),
})
