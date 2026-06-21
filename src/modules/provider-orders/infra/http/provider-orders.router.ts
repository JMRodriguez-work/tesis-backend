import { createRoute } from '@hono/zod-openapi'
import { authMiddleware } from '../../../../shared/auth'
import { roleGuard } from '../../../../shared/auth/role-guard'
import { ApiError, ApiResponse } from '../../../../shared/http/api-response'
import type { AppType } from '../../../../shared/types/app'
import { CancelProviderOrder } from '../../use-cases/cancel-provider-order.use-case'
import { CreateProviderOrder } from '../../use-cases/create-provider-order.use-case'
import { GetProviderOrderById } from '../../use-cases/get-provider-order-by-id.use-case'
import { GetProviderOrdersPaginated } from '../../use-cases/get-provider-orders-paginated.use-case'
import { ReceiveProviderOrder } from '../../use-cases/receive-provider-order.use-case'
import { UpdateProviderOrder } from '../../use-cases/update-provider-order.use-case'
import {
  createProviderOrderSchema,
  listProviderOrdersQuerySchema,
  providerOrderCancelResponseSchema,
  providerOrderDeleteResponseSchema,
  providerOrderIdParamSchema,
  providerOrderListResponseSchema,
  providerOrderResponseSchema,
  receiveProviderOrderSchema,
  updateProviderOrderSchema,
} from './provider-orders.schemas'

const ADMIN_ROLE_ID = 1

export function registerProviderOrderRoutes(app: AppType) {
  // POST /api/v1/provider-orders
  app.openapi(
    createRoute({
      method: 'post',
      path: '/api/v1/provider-orders',
      tags: ['ProviderOrders'],
      summary: 'Crear orden a proveedor',
      description:
        'Solo Admin/Manager. Status inicial = pending. Tx: order + items, sin tocar stock (el stock se actualiza al recibir la orden).',
      middleware: [authMiddleware, roleGuard(['Admin', 'Manager'])] as const,
      security: [{ cookieAuth: [] }],
      request: {
        body: { content: { 'application/json': { schema: createProviderOrderSchema } } },
      },
      responses: {
        201: {
          description: 'Orden creada',
          content: { 'application/json': { schema: providerOrderResponseSchema } },
        },
        400: { description: 'Datos inválidos, provider inactivo o item de otra branch' },
        401: { description: 'No autenticado' },
        403: { description: 'No autorizado' },
      },
    }),
    async (c) => {
      const user = c.get('user')
      const db = c.get('db')
      const body = c.req.valid('json')
      const order = await new CreateProviderOrder(db).execute({
        userId: user.id,
        userRoleId: user.roleId,
        userBranchId: user.branchId,
        userOrganizationId: user.organizationId,
        requestedBranchId: body.branchId ?? null,
        providerId: body.providerId,
        estimatedDelivery: body.estimatedDelivery,
        items: body.items,
      })
      return c.json(
        new ApiResponse({ data: order, message: 'Orden creada', status: 201 }),
        201,
      )
    },
  )

  // GET /api/v1/provider-orders
  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/v1/provider-orders',
      tags: ['ProviderOrders'],
      summary: 'Listar órdenes a proveedores',
      description:
        'Filtros: branchId, providerId, status, from, to. Ordenado por createdAt desc.',
      middleware: [authMiddleware] as const,
      security: [{ cookieAuth: [] }],
      request: { query: listProviderOrdersQuerySchema },
      responses: {
        200: {
          description: 'Órdenes obtenidas',
          content: { 'application/json': { schema: providerOrderListResponseSchema } },
        },
        400: { description: 'branchId inválido' },
        401: { description: 'No autenticado' },
      },
    }),
    async (c) => {
      const user = c.get('user')
      const db = c.get('db')
      const query = c.req.valid('query')
      const result = await new GetProviderOrdersPaginated(db).execute({
        userRoleId: user.roleId,
        userBranchId: user.branchId,
        userOrganizationId: user.organizationId,
        requestedBranchId: query.branchId ?? null,
        filters: {
          providerId: query.providerId,
          status: query.status,
          from: query.from,
          to: query.to,
        },
        page: query.page,
        limit: query.limit,
      })
      return c.json(
        new ApiResponse({ data: result, message: 'Órdenes obtenidas', status: 200 }),
        200,
      )
    },
  )

  // GET /api/v1/provider-orders/:id
  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/v1/provider-orders/{id}',
      tags: ['ProviderOrders'],
      summary: 'Obtener orden por ID',
      description: 'Cross-org/branch → 404.',
      middleware: [authMiddleware] as const,
      security: [{ cookieAuth: [] }],
      request: { params: providerOrderIdParamSchema },
      responses: {
        200: {
          description: 'Orden encontrada',
          content: { 'application/json': { schema: providerOrderResponseSchema } },
        },
        401: { description: 'No autenticado' },
        404: { description: 'Orden no encontrada' },
      },
    }),
    async (c) => {
      const user = c.get('user')
      const db = c.get('db')
      const { id } = c.req.valid('param')
      const isAdmin = user.roleId === ADMIN_ROLE_ID
      const order = await new GetProviderOrderById(db).execute({
        orderId: id,
        userRoleId: user.roleId,
        userBranchId: user.branchId,
        userOrganizationId: user.organizationId,
        isAdmin,
      })
      if (!order) throw new ApiError('Orden no encontrada', 404)
      return c.json(
        new ApiResponse({ data: order, message: 'Orden encontrada', status: 200 }),
        200,
      )
    },
  )

  // PATCH /api/v1/provider-orders/:id
  app.openapi(
    createRoute({
      method: 'patch',
      path: '/api/v1/provider-orders/{id}',
      tags: ['ProviderOrders'],
      summary: 'Actualizar metadata de la orden (solo estimatedDelivery)',
      description:
        'Solo Admin/Manager. Solo si status=pending. No permite modificar items (cancel + recreate).',
      middleware: [authMiddleware, roleGuard(['Admin', 'Manager'])] as const,
      security: [{ cookieAuth: [] }],
      request: {
        params: providerOrderIdParamSchema,
        body: { content: { 'application/json': { schema: updateProviderOrderSchema } } },
      },
      responses: {
        200: {
          description: 'Orden actualizada',
          content: { 'application/json': { schema: providerOrderResponseSchema } },
        },
        400: { description: 'Orden no está en pending' },
        401: { description: 'No autenticado' },
        403: { description: 'No autorizado' },
        404: { description: 'Orden no encontrada' },
      },
    }),
    async (c) => {
      const user = c.get('user')
      const db = c.get('db')
      const { id } = c.req.valid('param')
      const body = c.req.valid('json')
      const isAdmin = user.roleId === ADMIN_ROLE_ID
      const order = await new UpdateProviderOrder(db).execute({
        orderId: id,
        userRoleId: user.roleId,
        userBranchId: user.branchId,
        userOrganizationId: user.organizationId,
        isAdmin,
        estimatedDelivery: body.estimatedDelivery,
      })
      if (!order) throw new ApiError('Orden no encontrada', 404)
      return c.json(
        new ApiResponse({ data: order, message: 'Orden actualizada', status: 200 }),
        200,
      )
    },
  )

  // POST /api/v1/provider-orders/:id/receive
  app.openapi(
    createRoute({
      method: 'post',
      path: '/api/v1/provider-orders/{id}/receive',
      tags: ['ProviderOrders'],
      summary: 'Recibir la orden (status → received, stock in, movimientos)',
      description:
        'Solo Admin/Manager. Body: warehouseId. Tx: status=received + upsert de stock por item + INSERT stock_movements type=in referenceType=provider_order.',
      middleware: [authMiddleware, roleGuard(['Admin', 'Manager'])] as const,
      security: [{ cookieAuth: [] }],
      request: {
        params: providerOrderIdParamSchema,
        body: { content: { 'application/json': { schema: receiveProviderOrderSchema } } },
      },
      responses: {
        200: {
          description: 'Orden recibida',
          content: { 'application/json': { schema: providerOrderResponseSchema } },
        },
        400: { description: 'Orden no está en pending, o warehouse inválido' },
        401: { description: 'No autenticado' },
        403: { description: 'No autorizado' },
        404: { description: 'Orden no encontrada' },
      },
    }),
    async (c) => {
      const user = c.get('user')
      const db = c.get('db')
      const { id } = c.req.valid('param')
      const { warehouseId } = c.req.valid('json')
      const isAdmin = user.roleId === ADMIN_ROLE_ID
      const order = await new ReceiveProviderOrder(db).execute({
        orderId: id,
        warehouseId,
        userId: user.id,
        userRoleId: user.roleId,
        userBranchId: user.branchId,
        userOrganizationId: user.organizationId,
        isAdmin,
      })
      return c.json(
        new ApiResponse({ data: order, message: 'Orden recibida', status: 200 }),
        200,
      )
    },
  )

  // POST /api/v1/provider-orders/:id/cancel
  app.openapi(
    createRoute({
      method: 'post',
      path: '/api/v1/provider-orders/{id}/cancel',
      tags: ['ProviderOrders'],
      summary: 'Cancelar la orden (status → cancelled)',
      description:
        'Solo Admin/Manager. Solo si status=pending. Idempotente. 400 si ya fue recibida (no se revierte stock desde acá).',
      middleware: [authMiddleware, roleGuard(['Admin', 'Manager'])] as const,
      security: [{ cookieAuth: [] }],
      request: { params: providerOrderIdParamSchema },
      responses: {
        200: {
          description: 'Orden cancelada',
          content: { 'application/json': { schema: providerOrderCancelResponseSchema } },
        },
        400: { description: 'Orden ya recibida o ya cancelada' },
        401: { description: 'No autenticado' },
        403: { description: 'No autorizado' },
        404: { description: 'Orden no encontrada' },
      },
    }),
    async (c) => {
      const user = c.get('user')
      const db = c.get('db')
      const { id } = c.req.valid('param')
      const isAdmin = user.roleId === ADMIN_ROLE_ID
      const result = await new CancelProviderOrder(db).execute({
        orderId: id,
        userRoleId: user.roleId,
        userBranchId: user.branchId,
        userOrganizationId: user.organizationId,
        isAdmin,
      })
      const message = result.alreadyCancelled
        ? 'La orden ya estaba cancelada'
        : 'Orden cancelada'
      return c.json(
        new ApiResponse({ data: result, message, status: 200 }),
        200,
      )
    },
  )

  // DELETE /api/v1/provider-orders/:id
  app.openapi(
    createRoute({
      method: 'delete',
      path: '/api/v1/provider-orders/{id}',
      tags: ['ProviderOrders'],
      summary: 'Eliminar la orden (equivalente a cancel)',
      description:
        'Solo Admin. Soft vía status=cancelled. Solo si status=pending. Idempotente. 400 si ya fue recibida.',
      middleware: [authMiddleware, roleGuard(['Admin'])] as const,
      security: [{ cookieAuth: [] }],
      request: { params: providerOrderIdParamSchema },
      responses: {
        200: {
          description: 'Orden eliminada',
          content: { 'application/json': { schema: providerOrderDeleteResponseSchema } },
        },
        400: { description: 'Orden ya recibida' },
        401: { description: 'No autenticado' },
        403: { description: 'No autorizado' },
        404: { description: 'Orden no encontrada' },
      },
    }),
    async (c) => {
      const user = c.get('user')
      const db = c.get('db')
      const { id } = c.req.valid('param')
      const isAdmin = user.roleId === ADMIN_ROLE_ID
      const result = await new CancelProviderOrder(db).execute({
        orderId: id,
        userRoleId: user.roleId,
        userBranchId: user.branchId,
        userOrganizationId: user.organizationId,
        isAdmin,
      })
      const message = result.alreadyCancelled
        ? 'La orden ya estaba cancelada'
        : 'Orden eliminada'
      return c.json(
        new ApiResponse({ data: null, message, status: 200 }),
        200,
      )
    },
  )
}
