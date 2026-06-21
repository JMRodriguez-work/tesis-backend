import { createRoute } from '@hono/zod-openapi'
import { eq } from 'drizzle-orm'
import { authMiddleware } from '../../../../shared/auth'
import { roleGuard } from '../../../../shared/auth/role-guard'
import { ApiError, ApiResponse } from '../../../../shared/http/api-response'
import * as schema from '../../../../shared/db/schema'
import type { AppType } from '../../../../shared/types/app'
import {
  countStockMovementsByWarehouse,
  findStockMovementById,
  findStockMovementsPaginated,
} from '../../infra/repository/stock-movement.repository'
import { CreateAdjustment } from '../../use-cases/create-adjustment.use-case'
import { GetItemStockHistory } from '../../use-cases/get-item-stock-history.use-case'
import { GetLowStockItems } from '../../use-cases/get-low-stock-items.use-case'
import { GetStockMovementById } from '../../use-cases/get-stock-movement-by-id.use-case'
import { GetStockMovementsPaginated } from '../../use-cases/get-stock-movements-paginated.use-case'
import { resolveStockMovementListScope } from '../../use-cases/resolve-stock-movement-access'
import { TransferStock } from '../../use-cases/transfer-stock.use-case'
import {
  adjustmentSchema,
  itemIdParamSchema,
  itemStockHistoryQuerySchema,
  listStockMovementsQuerySchema,
  lowStockItemsResponseSchema,
  stockHistoryResponseSchema,
  stockMovementIdParamSchema,
  stockMovementListResponseSchema,
  stockMovementResponseSchema,
  transferSchema,
  warehouseIdParamSchema,
} from './stock-movements.schemas'

const ADMIN_ROLE_ID = 1

export function registerStockMovementRoutes(app: AppType) {
  // GET /api/v1/stock-movements
  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/v1/stock-movements',
      tags: ['StockMovements'],
      summary: 'Listar movimientos de stock',
      description:
        'Historial general. Filtros: itemId, type, branchId (admin), warehouseId, referenceType, referenceId, from, to.',
      middleware: [authMiddleware] as const,
      security: [{ cookieAuth: [] }],
      request: { query: listStockMovementsQuerySchema },
      responses: {
        200: {
          description: 'Movimientos obtenidos',
          content: { 'application/json': { schema: stockMovementListResponseSchema } },
        },
        400: { description: 'branchId inválido' },
        401: { description: 'No autenticado' },
      },
    }),
    async (c) => {
      const user = c.get('user')
      const db = c.get('db')
      const query = c.req.valid('query')
      const result = await new GetStockMovementsPaginated(db).execute({
        userRoleId: user.roleId,
        userBranchId: user.branchId,
        userOrganizationId: user.organizationId,
        requestedBranchId: query.branchId ?? null,
        filters: {
          itemId: query.itemId,
          type: query.type,
          warehouseId: query.warehouseId,
          referenceType: query.referenceType,
          referenceId: query.referenceId,
          from: query.from,
          to: query.to,
        },
        page: query.page,
        limit: query.limit,
      })
      return c.json(
        new ApiResponse({ data: result, message: 'Movimientos obtenidos', status: 200 }),
        200,
      )
    },
  )

  // GET /api/v1/stock-movements/low-stock
  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/v1/stock-movements/low-stock',
      tags: ['StockMovements'],
      summary: 'Items bajo nivel crítico de stock',
      description:
        'Devuelve items con quantity < minStock en al menos un warehouse asignado a la branch. Base para HU-017.',
      middleware: [authMiddleware] as const,
      security: [{ cookieAuth: [] }],
      request: { query: listStockMovementsQuerySchema.pick({ branchId: true }) },
      responses: {
        200: {
          description: 'Items bajo nivel crítico',
          content: { 'application/json': { schema: lowStockItemsResponseSchema } },
        },
        400: { description: 'branchId inválido' },
        401: { description: 'No autenticado' },
      },
    }),
    async (c) => {
      const user = c.get('user')
      const db = c.get('db')
      const query = c.req.valid('query')
      const data = await new GetLowStockItems(db).execute({
        userRoleId: user.roleId,
        userBranchId: user.branchId,
        userOrganizationId: user.organizationId,
        requestedBranchId: query.branchId ?? null,
      })
      return c.json(
        new ApiResponse({ data, message: 'Items bajo nivel crítico', status: 200 }),
        200,
      )
    },
  )

  // GET /api/v1/stock-movements/{id}
  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/v1/stock-movements/{id}',
      tags: ['StockMovements'],
      summary: 'Obtener movimiento por ID',
      description: 'Cross-org/branch → 404.',
      middleware: [authMiddleware] as const,
      security: [{ cookieAuth: [] }],
      request: { params: stockMovementIdParamSchema },
      responses: {
        200: {
          description: 'Movimiento encontrado',
          content: { 'application/json': { schema: stockMovementResponseSchema } },
        },
        401: { description: 'No autenticado' },
        404: { description: 'Movimiento no encontrado' },
      },
    }),
    async (c) => {
      const user = c.get('user')
      const db = c.get('db')
      const { id } = c.req.valid('param')
      const isAdmin = user.roleId === ADMIN_ROLE_ID
      const movement = await new GetStockMovementById(db).execute({
        movementId: id,
        userRoleId: user.roleId,
        userBranchId: user.branchId,
        userOrganizationId: user.organizationId,
        isAdmin,
      })
      if (!movement) throw new ApiError('Movimiento no encontrado', 404)
      return c.json(
        new ApiResponse({ data: movement, message: 'Movimiento encontrado', status: 200 }),
        200,
      )
    },
  )

  // GET /api/v1/items/{id}/stock-history
  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/v1/items/{id}/stock-history',
      tags: ['StockMovements'],
      summary: 'Historial de stock de un item',
      description:
        'Devuelve los movimientos del item con runningBalance calculado (total del item, o del warehouse si se filtra).',
      middleware: [authMiddleware] as const,
      security: [{ cookieAuth: [] }],
      request: { params: itemIdParamSchema, query: itemStockHistoryQuerySchema },
      responses: {
        200: {
          description: 'Historial del item',
          content: { 'application/json': { schema: stockHistoryResponseSchema } },
        },
        401: { description: 'No autenticado' },
        404: { description: 'Item no encontrado' },
      },
    }),
    async (c) => {
      const user = c.get('user')
      const db = c.get('db')
      const { id } = c.req.valid('param')
      const query = c.req.valid('query')
      const result = await new GetItemStockHistory(db).execute({
        userRoleId: user.roleId,
        userBranchId: user.branchId,
        userOrganizationId: user.organizationId,
        requestedBranchId: null,
        itemId: id,
        from: query.from,
        to: query.to,
        warehouseId: query.warehouseId,
        page: query.page,
        limit: query.limit,
      })
      return c.json(
        new ApiResponse({ data: result, message: 'Historial del item', status: 200 }),
        200,
      )
    },
  )

  // GET /api/v1/warehouses/{id}/stock-movements
  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/v1/warehouses/{id}/stock-movements',
      tags: ['StockMovements'],
      summary: 'Movimientos de un depósito (origen o destino)',
      description: 'Filtra movimientos donde fromWarehouseId=id OR toWarehouseId=id.',
      middleware: [authMiddleware] as const,
      security: [{ cookieAuth: [] }],
      request: { params: warehouseIdParamSchema, query: listStockMovementsQuerySchema },
      responses: {
        200: {
          description: 'Movimientos del depósito',
          content: { 'application/json': { schema: stockMovementListResponseSchema } },
        },
        401: { description: 'No autenticado' },
        404: { description: 'Depósito no encontrado' },
      },
    }),
    async (c) => {
      const user = c.get('user')
      const db = c.get('db')
      const { id } = c.req.valid('param')
      const query = c.req.valid('query')

      // Validate warehouse exists & tenant isolation
      const wh = await db
        .select({ organizationId: schema.warehouses.organizationId })
        .from(schema.warehouses)
        .where(eq(schema.warehouses.id, id))
        .limit(1)
      if (!wh[0] || wh[0].organizationId !== user.organizationId) {
        throw new ApiError('Depósito no encontrado', 404)
      }

      const scope = resolveStockMovementListScope({
        userRoleId: user.roleId,
        userBranchId: user.branchId,
        userOrganizationId: user.organizationId,
        requestedBranchId: query.branchId ?? null,
      })

      const filters = {
        itemId: query.itemId,
        type: query.type,
        referenceType: query.referenceType,
        referenceId: query.referenceId,
        from: query.from,
        to: query.to,
      }
      const offset = (query.page - 1) * query.limit
      const [data, total] = await Promise.all([
        findStockMovementsPaginated(
          db,
          scope.organizationId,
          { ...filters, branchId: scope.branchId, warehouseId: id },
          query.limit,
          offset,
        ),
        countStockMovementsByWarehouse(
          db,
          scope.organizationId,
          id,
          filters,
          scope.branchId,
        ),
      ])
      return c.json(
        new ApiResponse({
          data: {
            data,
            meta: {
              page: query.page,
              limit: query.limit,
              total,
              totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
            },
          },
          message: 'Movimientos del depósito',
          status: 200,
        }),
        200,
      )
    },
  )

  // POST /api/v1/stock-movements/adjustment
  app.openapi(
    createRoute({
      method: 'post',
      path: '/api/v1/stock-movements/adjustment',
      tags: ['StockMovements'],
      summary: 'Ajuste manual de stock',
      description:
        'Solo Admin/Manager. Body: branchId, warehouseId, itemId, direction (in|out), quantity, notes?. Tx: stock + movement type=adjustment.',
      middleware: [authMiddleware, roleGuard(['Admin', 'Manager'])] as const,
      security: [{ cookieAuth: [] }],
      request: {
        body: { content: { 'application/json': { schema: adjustmentSchema } } },
      },
      responses: {
        200: {
          description: 'Ajuste realizado',
          content: { 'application/json': { schema: stockMovementResponseSchema } },
        },
        400: { description: 'Datos inválidos o stock insuficiente' },
        401: { description: 'No autenticado' },
        403: { description: 'No autorizado' },
      },
    }),
    async (c) => {
      const user = c.get('user')
      const db = c.get('db')
      const body = c.req.valid('json')
      const movement = await new CreateAdjustment(db).execute({
        branchId: body.branchId,
        warehouseId: body.warehouseId,
        itemId: body.itemId,
        direction: body.direction,
        quantity: body.quantity,
        notes: body.notes,
        userId: user.id,
        userOrganizationId: user.organizationId,
      })
      const enriched = await findStockMovementById(db, movement.id)
      if (!enriched) throw new ApiError('No se pudo recuperar el movimiento', 500)
      return c.json(
        new ApiResponse({ data: enriched, message: 'Ajuste realizado', status: 200 }),
        200,
      )
    },
  )

  // POST /api/v1/stock-movements/transfer
  app.openapi(
    createRoute({
      method: 'post',
      path: '/api/v1/stock-movements/transfer',
      tags: ['StockMovements'],
      summary: 'Transferir stock entre depósitos',
      description:
        'Solo Admin/Manager. Body: branchId, itemId, fromWarehouseId, toWarehouseId, quantity, notes?. Tx: decrement from + increment to + 1 movement type=transfer.',
      middleware: [authMiddleware, roleGuard(['Admin', 'Manager'])] as const,
      security: [{ cookieAuth: [] }],
      request: {
        body: { content: { 'application/json': { schema: transferSchema } } },
      },
      responses: {
        200: {
          description: 'Transferencia realizada',
          content: { 'application/json': { schema: stockMovementResponseSchema } },
        },
        400: { description: 'Datos inválidos o stock insuficiente' },
        401: { description: 'No autenticado' },
        403: { description: 'No autorizado' },
      },
    }),
    async (c) => {
      const user = c.get('user')
      const db = c.get('db')
      const body = c.req.valid('json')
      const movement = await new TransferStock(db).execute({
        branchId: body.branchId,
        itemId: body.itemId,
        fromWarehouseId: body.fromWarehouseId,
        toWarehouseId: body.toWarehouseId,
        quantity: body.quantity,
        notes: body.notes,
        userId: user.id,
        userOrganizationId: user.organizationId,
      })
      const enriched = await findStockMovementById(db, movement.id)
      if (!enriched) throw new ApiError('No se pudo recuperar el movimiento', 500)
      return c.json(
        new ApiResponse({ data: enriched, message: 'Transferencia realizada', status: 200 }),
        200,
      )
    },
  )
}
