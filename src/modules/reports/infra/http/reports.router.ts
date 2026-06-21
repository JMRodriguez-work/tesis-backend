import { createRoute } from '@hono/zod-openapi'
import { authMiddleware } from '../../../../shared/auth'
import { ApiResponse } from '../../../../shared/http/api-response'
import type { AppType } from '../../../../shared/types/app'
import { GetCategoryDistribution } from '../../use-cases/get-category-distribution.use-case'
import { GetRevenueTimeline } from '../../use-cases/get-revenue-timeline.use-case'
import { GetSalesTrend } from '../../use-cases/get-sales-trend.use-case'
import { GetTopItems } from '../../use-cases/get-top-items.use-case'
import {
  categoryDistributionQuerySchema,
  categoryDistributionResponseSchema,
  revenueTimelineQuerySchema,
  revenueTimelineResponseSchema,
  salesTrendQuerySchema,
  salesTrendResponseSchema,
  topItemsQuerySchema,
  topItemsResponseSchema,
} from './reports.schemas'

export function registerReportRoutes(app: AppType) {
  // GET /api/v1/reports/sales-trend
  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/v1/reports/sales-trend',
      tags: ['Reports'],
      summary: 'Tendencia de ventas agrupada por día/semana/mes',
      description:
        'HU-029. Default: últimos 30 días, interval=day. Cap de buckets: 366/104/60 (day/week/month).',
      middleware: [authMiddleware] as const,
      security: [{ cookieAuth: [] }],
      request: { query: salesTrendQuerySchema },
      responses: {
        200: {
          description: 'Tendencia de ventas',
          content: { 'application/json': { schema: salesTrendResponseSchema } },
        },
        400: { description: 'Rango excede el máximo de buckets permitido' },
        401: { description: 'No autenticado' },
      },
    }),
    async (c) => {
      const user = c.get('user')
      const db = c.get('db')
      const query = c.req.valid('query')
      const data = await new GetSalesTrend(db).execute({
        userRoleId: user.roleId,
        userBranchId: user.branchId,
        userOrganizationId: user.organizationId,
        requestedBranchId: query.branchId ?? null,
        from: query.from,
        to: query.to,
        interval: query.interval,
      })
      return c.json(
        new ApiResponse({ data, message: 'Tendencia de ventas', status: 200 }),
        200,
      )
    },
  )

  // GET /api/v1/reports/revenue-timeline
  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/v1/reports/revenue-timeline',
      tags: ['Reports'],
      summary: 'Timeline de revenue agrupado por día/semana/mes',
      description:
        'Igual que sales-trend pero solo devuelve totalSales (sin transactionCount). Cap de buckets: 366/104/60.',
      middleware: [authMiddleware] as const,
      security: [{ cookieAuth: [] }],
      request: { query: revenueTimelineQuerySchema },
      responses: {
        200: {
          description: 'Timeline de revenue',
          content: { 'application/json': { schema: revenueTimelineResponseSchema } },
        },
        400: { description: 'Rango excede el máximo de buckets permitido' },
        401: { description: 'No autenticado' },
      },
    }),
    async (c) => {
      const user = c.get('user')
      const db = c.get('db')
      const query = c.req.valid('query')
      const data = await new GetRevenueTimeline(db).execute({
        userRoleId: user.roleId,
        userBranchId: user.branchId,
        userOrganizationId: user.organizationId,
        requestedBranchId: query.branchId ?? null,
        from: query.from,
        to: query.to,
        interval: query.interval,
      })
      return c.json(
        new ApiResponse({ data, message: 'Timeline de revenue', status: 200 }),
        200,
      )
    },
  )

  // GET /api/v1/reports/top-items
  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/v1/reports/top-items',
      tags: ['Reports'],
      summary: 'Top items por revenue o cantidad',
      description:
        'Default: últimos 30 días, sortBy=revenue, limit=20 (max 100).',
      middleware: [authMiddleware] as const,
      security: [{ cookieAuth: [] }],
      request: { query: topItemsQuerySchema },
      responses: {
        200: {
          description: 'Top items',
          content: { 'application/json': { schema: topItemsResponseSchema } },
        },
        400: { description: 'Datos inválidos' },
        401: { description: 'No autenticado' },
      },
    }),
    async (c) => {
      const user = c.get('user')
      const db = c.get('db')
      const query = c.req.valid('query')
      const data = await new GetTopItems(db).execute({
        userRoleId: user.roleId,
        userBranchId: user.branchId,
        userOrganizationId: user.organizationId,
        requestedBranchId: query.branchId ?? null,
        from: query.from,
        to: query.to,
        sortBy: query.sortBy,
        limit: query.limit,
      })
      return c.json(
        new ApiResponse({ data, message: 'Top items', status: 200 }),
        200,
      )
    },
  )

  // GET /api/v1/reports/category-distribution
  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/v1/reports/category-distribution',
      tags: ['Reports'],
      summary: 'Distribución de ventas por categoría',
      description:
        'Default: últimos 30 días. Items sin categoría se agrupan bajo "Sin categoría". Solo categorías con ventas en el período.',
      middleware: [authMiddleware] as const,
      security: [{ cookieAuth: [] }],
      request: { query: categoryDistributionQuerySchema },
      responses: {
        200: {
          description: 'Distribución por categoría',
          content: { 'application/json': { schema: categoryDistributionResponseSchema } },
        },
        400: { description: 'Datos inválidos' },
        401: { description: 'No autenticado' },
      },
    }),
    async (c) => {
      const user = c.get('user')
      const db = c.get('db')
      const query = c.req.valid('query')
      const data = await new GetCategoryDistribution(db).execute({
        userRoleId: user.roleId,
        userBranchId: user.branchId,
        userOrganizationId: user.organizationId,
        requestedBranchId: query.branchId ?? null,
        from: query.from,
        to: query.to,
      })
      return c.json(
        new ApiResponse({ data, message: 'Distribución por categoría', status: 200 }),
        200,
      )
    },
  )
}
