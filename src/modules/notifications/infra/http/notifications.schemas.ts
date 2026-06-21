import { z } from "@hono/zod-openapi";

const notificationRecommendationSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(["restock", "pricing", "trend", "seasonal", "retention"]),
  priority: z.enum(["high", "medium", "low"]),
  description: z.string(),
  branchId: z.string().uuid(),
  branchName: z.string(),
  itemId: z.string().uuid().nullable(),
  itemName: z.string().nullable(),
  customerId: z.string().uuid().nullable(),
  customerFullname: z.string().nullable(),
  generatedAt: z.string(),
});

const lowStockNotificationSchema = z.object({
  itemId: z.string().uuid(),
  itemName: z.string(),
  itemCode: z.string().nullable(),
  warehouseId: z.string().uuid(),
  warehouseName: z.string(),
  branchId: z.string().uuid(),
  branchName: z.string(),
  quantity: z.string(),
  minStock: z.string(),
  status: z.enum(["out", "low"]),
});

export const listNotificationsResponseSchema = z.object({
  data: z.object({
    recommendations: z.array(notificationRecommendationSchema),
    lowStock: z.array(lowStockNotificationSchema),
    unreadCount: z.number(),
  }),
  message: z.string(),
  status: z.number(),
});

export const listNotificationsQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
});

export const notificationIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const markNotificationReadResponseSchema = z.object({
  data: z.object({
    id: z.string().uuid(),
    readAt: z.string(),
    alreadyRead: z.boolean(),
  }),
  message: z.string(),
  status: z.number(),
});

export const markAllNotificationsReadResponseSchema = z.object({
  data: z.object({
    markedCount: z.number(),
  }),
  message: z.string(),
  status: z.number(),
});
