import { createRoute } from '@hono/zod-openapi'
import { authMiddleware } from '../../../../shared/auth'
import { roleGuard } from '../../../../shared/auth/role-guard'
import { ApiError, ApiResponse } from '../../../../shared/http/api-response'
import type { AppType } from '../../../../shared/types/app'
import { CancelSale } from '../../use-cases/cancel-sale.use-case'
import { CreateSale } from '../../use-cases/create-sale.use-case'
import { GetSaleById } from '../../use-cases/get-sale-by-id.use-case'
import { GetSalesExport } from '../../use-cases/get-sales-export.use-case'
import { GetSalesPaginated } from '../../use-cases/get-sales-paginated.use-case'
import {
  cancelSaleResponseSchema,
  cancelSaleSchema,
  createSaleSchema,
  exportSalesQuerySchema,
  listSalesQuerySchema,
  saleIdParamSchema,
  saleListResponseSchema,
  saleResponseSchema,
} from './sales.schemas'

const ADMIN_ROLE_ID = 1

export function registerSaleRoutes(app: AppType) {
  // POST /api/v1/sales
  app.openapi(
    createRoute({
      method: 'post',
      path: '/api/v1/sales',
      tags: ['Sales'],
      summary: 'Registrar una venta',
      description:
        'Crea la venta, sus items, descuenta stock de los warehouses asignados a la branch, y registra movimientos type=out. Todo en una transacción.',
      middleware: [authMiddleware, roleGuard(['Admin', 'Manager', 'Employee'])] as const,
      security: [{ cookieAuth: [] }],
      request: {
        body: { content: { 'application/json': { schema: createSaleSchema } } },
      },
      responses: {
        201: {
          description: 'Venta creada',
          content: { 'application/json': { schema: saleResponseSchema } },
        },
        400: { description: 'Datos inválidos, stock insuficiente o branchId no autorizado' },
        401: { description: 'No autenticado' },
        403: { description: 'No autorizado' },
      },
    }),
    async (c) => {
      const user = c.get('user')
      const db = c.get('db')
      const body = c.req.valid('json')
      const sale = await new CreateSale(db).execute({
        userId: user.id,
        userRoleId: user.roleId,
        userBranchId: user.branchId,
        userOrganizationId: user.organizationId,
        requestedBranchId: body.branchId ?? null,
        customerId: body.customerId,
        discountPercent: body.discountPercent,
        notes: body.notes,
        items: body.items,
      })
      return c.json(
        new ApiResponse({ data: sale, message: 'Venta creada', status: 201 }),
        201,
      )
    },
  )

  // GET /api/v1/sales
  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/v1/sales',
      tags: ['Sales'],
      summary: 'Listar ventas (historial)',
      description:
        'Default: desde inicio del día actual. Ordenado por createdAt desc. includeCancelled default false.',
      middleware: [authMiddleware] as const,
      security: [{ cookieAuth: [] }],
      request: { query: listSalesQuerySchema },
      responses: {
        200: {
          description: 'Ventas obtenidas',
          content: { 'application/json': { schema: saleListResponseSchema } },
        },
        400: { description: 'branchId inválido' },
        401: { description: 'No autenticado' },
      },
    }),
    async (c) => {
      const user = c.get('user')
      const db = c.get('db')
      const query = c.req.valid('query')
      const result = await new GetSalesPaginated(db).execute({
        userRoleId: user.roleId,
        userBranchId: user.branchId,
        userOrganizationId: user.organizationId,
        requestedBranchId: query.branchId ?? null,
        filters: {
          customerId: query.customerId,
          from: query.from,
          to: query.to,
          includeCancelled: query.includeCancelled,
        },
        page: query.page,
        limit: query.limit,
      })
      return c.json(
        new ApiResponse({ data: result, message: 'Ventas obtenidas', status: 200 }),
        200,
      )
    },
  )

  // GET /api/v1/sales/export
  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/v1/sales/export',
      tags: ['Sales'],
      summary: 'Exportar ventas (CSV o JSON)',
      description:
        'Devuelve archivo descargable. Solo Admin/Manager. Cap 10000 filas.',
      middleware: [authMiddleware, roleGuard(['Admin', 'Manager'])] as const,
      security: [{ cookieAuth: [] }],
      request: { query: exportSalesQuerySchema },
      responses: {
        200: { description: 'Archivo de exportación' },
        400: { description: 'Datos inválidos' },
        401: { description: 'No autenticado' },
        403: { description: 'No autorizado' },
      },
    }),
    async (c) => {
      const user = c.get('user')
      const db = c.get('db')
      const query = c.req.valid('query')
      const result = await new GetSalesExport(db).execute({
        userRoleId: user.roleId,
        userBranchId: user.branchId,
        userOrganizationId: user.organizationId,
        requestedBranchId: query.branchId ?? null,
        format: query.format,
        from: query.from,
        to: query.to,
      })
      return c.body(result.body, 200, {
        'Content-Type': result.contentType,
        'Content-Disposition': `attachment; filename="${result.filename}"`,
      })
    },
  )

  // GET /api/v1/sales/:id
  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/v1/sales/{id}',
      tags: ['Sales'],
      summary: 'Detalle de una venta',
      description: 'Cross-org/branch → 404.',
      middleware: [authMiddleware] as const,
      security: [{ cookieAuth: [] }],
      request: { params: saleIdParamSchema },
      responses: {
        200: {
          description: 'Venta encontrada',
          content: { 'application/json': { schema: saleResponseSchema } },
        },
        401: { description: 'No autenticado' },
        404: { description: 'Venta no encontrada' },
      },
    }),
    async (c) => {
      const user = c.get('user')
      const db = c.get('db')
      const { id } = c.req.valid('param')
      const isAdmin = user.roleId === ADMIN_ROLE_ID
      const sale = await new GetSaleById(db).execute({
        saleId: id,
        userRoleId: user.roleId,
        userBranchId: user.branchId,
        userOrganizationId: user.organizationId,
        isAdmin,
      })
      if (!sale) throw new ApiError('Venta no encontrada', 404)
      return c.json(
        new ApiResponse({ data: sale, message: 'Venta encontrada', status: 200 }),
        200,
      )
    },
  )

  // DELETE /api/v1/sales/:id
  app.openapi(
    createRoute({
      method: 'delete',
      path: '/api/v1/sales/{id}',
      tags: ['Sales'],
      summary: 'Cancelar una venta',
      description:
        'Solo Admin/Manager. Soft delete + movimientos compensatorios in. Idempotente. Body con cancellationReason (3-500 chars).',
      middleware: [authMiddleware, roleGuard(['Admin', 'Manager'])] as const,
      security: [{ cookieAuth: [] }],
      request: {
        params: saleIdParamSchema,
        body: { content: { 'application/json': { schema: cancelSaleSchema } } },
      },
      responses: {
        200: {
          description: 'Venta cancelada',
          content: { 'application/json': { schema: cancelSaleResponseSchema } },
        },
        400: { description: 'Motivo inválido' },
        401: { description: 'No autenticado' },
        403: { description: 'No autorizado' },
        404: { description: 'Venta no encontrada' },
      },
    }),
    async (c) => {
      const user = c.get('user')
      const db = c.get('db')
      const { id } = c.req.valid('param')
      const { cancellationReason } = c.req.valid('json')
      const isAdmin = user.roleId === ADMIN_ROLE_ID
      const result = await new CancelSale(db).execute({
        saleId: id,
        reason: cancellationReason,
        userId: user.id,
        userRoleId: user.roleId,
        userBranchId: user.branchId,
        userOrganizationId: user.organizationId,
        isAdmin,
      })
      const message = result.alreadyCancelled
        ? 'La venta ya estaba cancelada'
        : 'Venta cancelada'
      return c.json(
        new ApiResponse({ data: result, message, status: 200 }),
        200,
      )
    },
  )
}
