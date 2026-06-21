import { createRoute } from '@hono/zod-openapi'
import { authMiddleware } from '../../../../shared/auth'
import { roleGuard } from '../../../../shared/auth/role-guard'
import { ApiError, ApiResponse } from '../../../../shared/http/api-response'
import type { AppType } from '../../../../shared/types/app'
import { AssignWarehouseToBranch } from '../../use-cases/assign-warehouse-to-branch.use-case'
import { CreateWarehouse } from '../../use-cases/create-warehouse.use-case'
import { GetStockByItem } from '../../use-cases/get-stock-by-item.use-case'
import { GetStockByWarehouse } from '../../use-cases/get-stock-by-warehouse.use-case'
import { GetWarehouseById } from '../../use-cases/get-warehouse-by-id.use-case'
import { GetWarehousesPaginated } from '../../use-cases/get-warehouses-paginated.use-case'
import { SoftDeleteWarehouse } from '../../use-cases/soft-delete-warehouse.use-case'
import { UnassignWarehouseFromBranch } from '../../use-cases/unassign-warehouse-from-branch.use-case'
import { UpdateMinStock } from '../../use-cases/update-min-stock.use-case'
import { UpdateWarehouse } from '../../use-cases/update-warehouse.use-case'
import { UpsertStock } from '../../use-cases/upsert-stock.use-case'
import {
  assignBranchSchema,
  createWarehouseSchema,
  itemIdParamSchema,
  listStockQuerySchema,
  listWarehousesQuerySchema,
  minStockResponseSchema,
  stockByItemResponseSchema,
  stockListResponseSchema,
  updateMinStockSchema,
  updateWarehouseSchema,
  upsertStockResponseSchema,
  upsertStockSchema,
  warehouseBranchParamsSchema,
  warehouseDeleteResponseSchema,
  warehouseIdParamSchema,
  warehouseListResponseSchema,
  warehouseResponseSchema,
} from './warehouses.schemas'

export function registerWarehouseRoutes(app: AppType) {
  // GET /api/v1/warehouses
  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/v1/warehouses',
      tags: ['Warehouses'],
      summary: 'Listar depósitos',
      description:
        'Admin: ve todos los de su org. Manager: solo los asignados a su branch. Filtra isNull(deletedAt). Restringido a Admin/Manager.',
      middleware: [authMiddleware, roleGuard(['Admin', 'Manager'])] as const,
      security: [{ cookieAuth: [] }],
      request: { query: listWarehousesQuerySchema },
      responses: {
        200: {
          description: 'Depósitos obtenidos',
          content: { 'application/json': { schema: warehouseListResponseSchema } },
        },
        401: { description: 'No autenticado' },
      },
    }),
    async (c) => {
      const user = c.get('user')
      const db = c.get('db')
      const query = c.req.valid('query')
      const result = await new GetWarehousesPaginated(db).execute({
        userRoleId: user.roleId,
        userBranchId: user.branchId,
        userOrganizationId: user.organizationId,
        filters: { search: query.search, isActive: query.isActive },
        page: query.page,
        limit: query.limit,
      })
      return c.json(
        new ApiResponse({ data: result, message: 'Depósitos obtenidos', status: 200 }),
        200,
      )
    },
  )

  // GET /api/v1/warehouses/:id
  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/v1/warehouses/{id}',
      tags: ['Warehouses'],
      summary: 'Obtener depósito por ID',
      description:
        'Cross-org → 404. Manager solo si está asignado a su branch. Restringido a Admin/Manager.',
      middleware: [authMiddleware, roleGuard(['Admin', 'Manager'])] as const,
      security: [{ cookieAuth: [] }],
      request: { params: warehouseIdParamSchema },
      responses: {
        200: {
          description: 'Depósito encontrado',
          content: { 'application/json': { schema: warehouseResponseSchema } },
        },
        401: { description: 'No autenticado' },
        404: { description: 'Depósito no encontrado' },
      },
    }),
    async (c) => {
      const user = c.get('user')
      const db = c.get('db')
      const { id } = c.req.valid('param')
      const wh = await new GetWarehouseById(db).execute({
        id,
        userRoleId: user.roleId,
        userBranchId: user.branchId,
        userOrganizationId: user.organizationId,
      })
      if (!wh) throw new ApiError('Depósito no encontrado', 404)
      return c.json(new ApiResponse({ data: wh, message: 'Depósito encontrado', status: 200 }), 200)
    },
  )

  // POST /api/v1/warehouses
  app.openapi(
    createRoute({
      method: 'post',
      path: '/api/v1/warehouses',
      tags: ['Warehouses'],
      summary: 'Crear depósito',
      description:
        'Solo Admin. branchIds es obligatorio (mínimo 1). El depósito se crea y se asigna a las branches en una transacción.',
      middleware: [authMiddleware, roleGuard(['Admin'])] as const,
      security: [{ cookieAuth: [] }],
      request: { body: { content: { 'application/json': { schema: createWarehouseSchema } } } },
      responses: {
        201: {
          description: 'Depósito creado',
          content: { 'application/json': { schema: warehouseResponseSchema } },
        },
        400: { description: 'branchIds vacío o branch inválido' },
        401: { description: 'No autenticado' },
        403: { description: 'No autorizado' },
        409: { description: 'Nombre duplicado' },
      },
    }),
    async (c) => {
      const user = c.get('user')
      const db = c.get('db')
      const body = c.req.valid('json')
      const wh = await new CreateWarehouse(db).execute({
        name: body.name,
        description: body.description,
        branchIds: body.branchIds,
        organizationId: user.organizationId ?? '',
      })
      return c.json(new ApiResponse({ data: wh, message: 'Depósito creado', status: 201 }), 201)
    },
  )

  // PUT /api/v1/warehouses/:id
  app.openapi(
    createRoute({
      method: 'put',
      path: '/api/v1/warehouses/{id}',
      tags: ['Warehouses'],
      summary: 'Actualizar depósito (nombre, descripción, isActive)',
      description:
        'Solo Admin. Para asignar/desasignar branches usar las sub-rutas dedicadas.',
      middleware: [authMiddleware, roleGuard(['Admin'])] as const,
      security: [{ cookieAuth: [] }],
      request: {
        params: warehouseIdParamSchema,
        body: { content: { 'application/json': { schema: updateWarehouseSchema } } },
      },
      responses: {
        200: {
          description: 'Depósito actualizado',
          content: { 'application/json': { schema: warehouseResponseSchema } },
        },
        400: { description: 'Datos inválidos' },
        401: { description: 'No autenticado' },
        403: { description: 'No autorizado' },
        404: { description: 'Depósito no encontrado' },
        409: { description: 'Nombre duplicado' },
      },
    }),
    async (c) => {
      const user = c.get('user')
      const db = c.get('db')
      const { id } = c.req.valid('param')
      const body = c.req.valid('json')
      const wh = await new UpdateWarehouse(db).execute({
        id,
        organizationId: user.organizationId ?? '',
        data: { name: body.name, description: body.description, isActive: body.isActive },
      })
      if (!wh) throw new ApiError('Depósito no encontrado', 404)
      return c.json(new ApiResponse({ data: wh, message: 'Depósito actualizado', status: 200 }), 200)
    },
  )

  // DELETE /api/v1/warehouses/:id
  app.openapi(
    createRoute({
      method: 'delete',
      path: '/api/v1/warehouses/{id}',
      tags: ['Warehouses'],
      summary: 'Eliminar depósito (soft delete)',
      description: 'Falla con 400 si tiene items con stock > 0.',
      middleware: [authMiddleware, roleGuard(['Admin'])] as const,
      security: [{ cookieAuth: [] }],
      request: { params: warehouseIdParamSchema },
      responses: {
        200: {
          description: 'Depósito eliminado',
          content: { 'application/json': { schema: warehouseDeleteResponseSchema } },
        },
        400: { description: 'Tiene items con stock > 0' },
        401: { description: 'No autenticado' },
        403: { description: 'No autorizado' },
        404: { description: 'Depósito no encontrado' },
      },
    }),
    async (c) => {
      const user = c.get('user')
      const db = c.get('db')
      const { id } = c.req.valid('param')
      await new SoftDeleteWarehouse(db).execute(id, user.organizationId ?? '')
      return c.json(new ApiResponse({ data: null, message: 'Depósito eliminado', status: 200 }), 200)
    },
  )

  // POST /api/v1/warehouses/:id/branches
  app.openapi(
    createRoute({
      method: 'post',
      path: '/api/v1/warehouses/{id}/branches',
      tags: ['Warehouses'],
      summary: 'Asignar depósito a una sucursal',
      description: 'Solo Admin. Cross-org branchId → 400. Duplicado → 409.',
      middleware: [authMiddleware, roleGuard(['Admin'])] as const,
      security: [{ cookieAuth: [] }],
      request: {
        params: warehouseIdParamSchema,
        body: { content: { 'application/json': { schema: assignBranchSchema } } },
      },
      responses: {
        200: {
          description: 'Sucursal asignada',
          content: { 'application/json': { schema: warehouseResponseSchema } },
        },
        400: { description: 'Branch inválido o de otra org' },
        401: { description: 'No autenticado' },
        403: { description: 'No autorizado' },
        404: { description: 'Depósito no encontrado' },
        409: { description: 'Ya asignado' },
      },
    }),
    async (c) => {
      const user = c.get('user')
      const db = c.get('db')
      const { id } = c.req.valid('param')
      const { branchId } = c.req.valid('json')
      await new AssignWarehouseToBranch(db).execute(id, branchId, user.organizationId ?? '')
      const wh = await new GetWarehouseById(db).execute({
        id,
        userRoleId: user.roleId,
        userBranchId: user.branchId,
        userOrganizationId: user.organizationId,
      })
      return c.json(new ApiResponse({ data: wh, message: 'Sucursal asignada', status: 200 }), 200)
    },
  )

  // DELETE /api/v1/warehouses/:id/branches/:branchId
  app.openapi(
    createRoute({
      method: 'delete',
      path: '/api/v1/warehouses/{id}/branches/{branchId}',
      tags: ['Warehouses'],
      summary: 'Desasignar depósito de una sucursal',
      description: 'Solo Admin. Idempotente.',
      middleware: [authMiddleware, roleGuard(['Admin'])] as const,
      security: [{ cookieAuth: [] }],
      request: { params: warehouseBranchParamsSchema },
      responses: {
        200: {
          description: 'Sucursal desasignada',
          content: { 'application/json': { schema: warehouseResponseSchema } },
        },
        401: { description: 'No autenticado' },
        403: { description: 'No autorizado' },
        404: { description: 'Depósito no encontrado' },
      },
    }),
    async (c) => {
      const user = c.get('user')
      const db = c.get('db')
      const { id, branchId } = c.req.valid('param')
      await new UnassignWarehouseFromBranch(db).execute(id, branchId, user.organizationId ?? '')
      const wh = await new GetWarehouseById(db).execute({
        id,
        userRoleId: user.roleId,
        userBranchId: user.branchId,
        userOrganizationId: user.organizationId,
      })
      return c.json(
        new ApiResponse({ data: wh, message: 'Sucursal desasignada', status: 200 }),
        200,
      )
    },
  )

  // GET /api/v1/warehouses/:id/stock
  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/v1/warehouses/{id}/stock',
      tags: ['Warehouses'],
      summary: 'Listar stock del depósito',
      description:
        'Items con quantity, minStock, status (low/ok/out). Manager solo si el depósito está asignado a su branch. Restringido a Admin/Manager: expone inventario completo.',
      middleware: [authMiddleware, roleGuard(['Admin', 'Manager'])] as const,
      security: [{ cookieAuth: [] }],
      request: { params: warehouseIdParamSchema, query: listStockQuerySchema },
      responses: {
        200: {
          description: 'Stock del depósito',
          content: { 'application/json': { schema: stockListResponseSchema } },
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
      const result = await new GetStockByWarehouse(db).execute({
        userRoleId: user.roleId,
        userBranchId: user.branchId,
        userOrganizationId: user.organizationId,
        warehouseId: id,
        filters: { search: query.search, status: query.status },
        page: query.page,
        limit: query.limit,
      })
      return c.json(new ApiResponse({ data: result, message: 'Stock obtenido', status: 200 }), 200)
    },
  )

  // GET /api/v1/items/:id/stock
  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/v1/items/{id}/stock',
      tags: ['Warehouses'],
      summary: 'Stock de un item en todos los depósitos',
      description:
        'Cross-branch/org → 404. Restringido a Admin/Manager: expone stock estratégico cross-warehouse.',
      middleware: [authMiddleware, roleGuard(['Admin', 'Manager'])] as const,
      security: [{ cookieAuth: [] }],
      request: { params: itemIdParamSchema },
      responses: {
        200: {
          description: 'Stock del item',
          content: { 'application/json': { schema: stockByItemResponseSchema } },
        },
        401: { description: 'No autenticado' },
        404: { description: 'Item no encontrado' },
      },
    }),
    async (c) => {
      const user = c.get('user')
      const db = c.get('db')
      const { id } = c.req.valid('param')
      const data = await new GetStockByItem(db).execute(id, {
        userRoleId: user.roleId,
        userBranchId: user.branchId,
        userOrganizationId: user.organizationId,
      })
      return c.json(new ApiResponse({ data, message: 'Stock del item', status: 200 }), 200)
    },
  )

  // PATCH /api/v1/items/:id/min-stock
  app.openapi(
    createRoute({
      method: 'patch',
      path: '/api/v1/items/{id}/min-stock',
      tags: ['Warehouses'],
      summary: 'Actualizar min_stock del item (en todos los depósitos)',
      description: 'Solo Admin/Manager.',
      middleware: [authMiddleware, roleGuard(['Admin', 'Manager'])] as const,
      security: [{ cookieAuth: [] }],
      request: {
        params: itemIdParamSchema,
        body: { content: { 'application/json': { schema: updateMinStockSchema } } },
      },
      responses: {
        200: {
          description: 'min_stock actualizado',
          content: { 'application/json': { schema: minStockResponseSchema } },
        },
        400: { description: 'Datos inválidos' },
        401: { description: 'No autenticado' },
        403: { description: 'No autorizado' },
        404: { description: 'Item no encontrado' },
      },
    }),
    async (c) => {
      const user = c.get('user')
      const db = c.get('db')
      const { id } = c.req.valid('param')
      const { minStock } = c.req.valid('json')
      const data = await new UpdateMinStock(db).execute(id, minStock, {
        userRoleId: user.roleId,
        userBranchId: user.branchId,
        userOrganizationId: user.organizationId,
      })
      return c.json(new ApiResponse({ data, message: 'min_stock actualizado', status: 200 }), 200)
    },
  )

  // POST /api/v1/warehouses/:id/stock
  app.openapi(
    createRoute({
      method: 'post',
      path: '/api/v1/warehouses/{id}/stock',
      tags: ['Warehouses'],
      summary: 'Inicializar o actualizar stock (upsert)',
      description:
        'Solo Admin/Manager. Para inicializar el catálogo sin esperar a Fase 2. Si la fila ya existe, actualiza quantity (y opcionalmente minStock).',
      middleware: [authMiddleware, roleGuard(['Admin', 'Manager'])] as const,
      security: [{ cookieAuth: [] }],
      request: {
        params: warehouseIdParamSchema,
        body: { content: { 'application/json': { schema: upsertStockSchema } } },
      },
      responses: {
        200: {
          description: 'Stock guardado',
          content: { 'application/json': { schema: upsertStockResponseSchema } },
        },
        400: { description: 'Item o depósito inválido / sin acceso' },
        401: { description: 'No autenticado' },
        403: { description: 'No autorizado' },
      },
    }),
    async (c) => {
      const user = c.get('user')
      const db = c.get('db')
      const { id } = c.req.valid('param')
      const body = c.req.valid('json')
      const data = await new UpsertStock(db).execute({
        userRoleId: user.roleId,
        userBranchId: user.branchId,
        userOrganizationId: user.organizationId,
        userId: user.id,
        warehouseId: id,
        itemId: body.itemId,
        quantity: body.quantity,
        minStock: body.minStock,
      })
      return c.json(new ApiResponse({ data, message: 'Stock guardado', status: 200 }), 200)
    },
  )
}
