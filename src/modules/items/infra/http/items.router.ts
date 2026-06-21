import { createRoute } from '@hono/zod-openapi'
import { authMiddleware } from '../../../../shared/auth'
import { roleGuard } from '../../../../shared/auth/role-guard'
import { ApiError, ApiResponse } from '../../../../shared/http/api-response'
import type { AppType } from '../../../../shared/types/app'
import { CreateItem } from '../../use-cases/create-item.use-case'
import { GetItemById } from '../../use-cases/get-item-by-id.use-case'
import { GetItemsPaginated } from '../../use-cases/get-items-paginated.use-case'
import { LookupItemByBarcode } from '../../use-cases/lookup-item-by-barcode.use-case'
import { SoftDeleteItem } from '../../use-cases/soft-delete-item.use-case'
import { UpdateItem } from '../../use-cases/update-item.use-case'
import {
  createItemSchema,
  itemBarcodeParamSchema,
  itemDeleteResponseSchema,
  itemIdParamSchema,
  itemListResponseSchema,
  itemResponseSchema,
  listItemsQuerySchema,
  updateItemSchema,
} from './items.schemas'

export function registerItemRoutes(app: AppType) {
  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/v1/items',
      tags: ['Items'],
      summary: 'Listar items de la sucursal efectiva (paginado)',
      description:
        'Admin debe indicar ?branchId=. Manager/Employee: filtrado por su branch. Filtra isNull(deletedAt). Búsqueda: name, code, barcode (ILIKE). Orden alfabético por nombre.',
      middleware: [authMiddleware] as const,
      security: [{ cookieAuth: [] }],
      request: { query: listItemsQuerySchema },
      responses: {
        200: {
          description: 'Items obtenidos',
          content: { 'application/json': { schema: itemListResponseSchema } },
        },
        400: { description: 'Falta branchId (Admin) o branchId inválido' },
        401: { description: 'No autenticado' },
        403: { description: 'No autorizado' },
      },
    }),
    async (c) => {
      const user = c.get('user')
      const db = c.get('db')
      const query = c.req.valid('query')

      const result = await new GetItemsPaginated(db).execute({
        userRoleId: user.roleId,
        userBranchId: user.branchId,
        userOrganizationId: user.organizationId,
        requestedBranchId: query.branchId ?? null,
        page: query.page,
        limit: query.limit,
        filters: {
          search: query.search,
          categoryId: query.categoryId,
          isActive: query.isActive,
        },
      })

      return c.json(
        new ApiResponse({ data: result, message: 'Items obtenidos', status: 200 }),
        200,
      )
    },
  )

  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/v1/items/barcode/{code}',
      tags: ['Items'],
      summary: 'Buscar item por código de barras exacto (para scanner)',
      description: 'Cross-branch/org devuelve 404. Solo items activos (no soft-deleted).',
      middleware: [authMiddleware] as const,
      security: [{ cookieAuth: [] }],
      request: { params: itemBarcodeParamSchema },
      responses: {
        200: {
          description: 'Item encontrado',
          content: { 'application/json': { schema: itemResponseSchema } },
        },
        401: { description: 'No autenticado' },
        404: { description: 'Item no encontrado' },
      },
    }),
    async (c) => {
      const user = c.get('user')
      const db = c.get('db')
      const { code } = c.req.valid('param')

      const item = await new LookupItemByBarcode(db).execute({
        userRoleId: user.roleId,
        userBranchId: user.branchId,
        userOrganizationId: user.organizationId,
        requestedBranchId: null,
        barcode: code,
      })

      if (!item) throw new ApiError('Item no encontrado', 404)

      return c.json(
        new ApiResponse({ data: item, message: 'Item encontrado', status: 200 }),
        200,
      )
    },
  )

  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/v1/items/{id}',
      tags: ['Items'],
      summary: 'Obtener item por ID',
      description: 'Cross-branch (Manager) o cross-org (Admin) devuelve 404.',
      middleware: [authMiddleware] as const,
      security: [{ cookieAuth: [] }],
      request: { params: itemIdParamSchema },
      responses: {
        200: {
          description: 'Item encontrado',
          content: { 'application/json': { schema: itemResponseSchema } },
        },
        401: { description: 'No autenticado' },
        404: { description: 'Item no encontrado' },
      },
    }),
    async (c) => {
      const user = c.get('user')
      const db = c.get('db')
      const { id } = c.req.valid('param')

      const item = await new GetItemById(db).execute({
        id,
        userRoleId: user.roleId,
        userBranchId: user.branchId,
        userOrganizationId: user.organizationId,
        requestedBranchId: null,
      })

      if (!item) throw new ApiError('Item no encontrado', 404)

      return c.json(
        new ApiResponse({
          data: { item, warning: null },
          message: 'Item encontrado',
          status: 200,
        }),
        200,
      )
    },
  )

  app.openapi(
    createRoute({
      method: 'post',
      path: '/api/v1/items',
      tags: ['Items'],
      summary: 'Crear item',
      description:
        'Admin: debe mandar branchId. Manager: forzado a su branch (branchId de otra branch → 400). Employee: 403. Nombre único dentro de la branch. Barcode único global. Code único dentro de la branch.',
      middleware: [authMiddleware, roleGuard(['Admin', 'Manager'])] as const,
      security: [{ cookieAuth: [] }],
      request: {
        body: { content: { 'application/json': { schema: createItemSchema } } },
      },
      responses: {
        201: {
          description: 'Item creado',
          content: { 'application/json': { schema: itemResponseSchema } },
        },
        400: { description: 'Datos inválidos o branchId/category/baseUnit no autorizado' },
        401: { description: 'No autenticado' },
        403: { description: 'No autorizado' },
        409: { description: 'Nombre, code o barcode duplicado' },
      },
    }),
    async (c) => {
      const user = c.get('user')
      const db = c.get('db')
      const body = c.req.valid('json')

      const result = await new CreateItem(db).execute({
        userRoleId: user.roleId,
        userBranchId: user.branchId,
        userOrganizationId: user.organizationId,
        requestedBranchId: body.branchId ?? null,
        name: body.name,
        description: body.description,
        categoryId: body.categoryId,
        baseUnitId: body.baseUnitId,
        purchasePrice: body.purchasePrice,
        salePrice: body.salePrice,
        code: body.code,
        barcode: body.barcode,
        isActive: body.isActive,
      })

      return c.json(
        new ApiResponse({ data: result, message: 'Item creado', status: 201 }),
        201,
      )
    },
  )

  app.openapi(
    createRoute({
      method: 'put',
      path: '/api/v1/items/{id}',
      tags: ['Items'],
      summary: 'Actualizar item (incluye reactivación con isActive: true)',
      description:
        'No permite cambiar branchId (key rechazada por .strict()). Permite reactivar items soft-deleted seteando isActive: true. Re-valida unicidad de name/code/barcode.',
      middleware: [authMiddleware, roleGuard(['Admin', 'Manager'])] as const,
      security: [{ cookieAuth: [] }],
      request: {
        params: itemIdParamSchema,
        body: { content: { 'application/json': { schema: updateItemSchema } } },
      },
      responses: {
        200: {
          description: 'Item actualizado',
          content: { 'application/json': { schema: itemResponseSchema } },
        },
        400: { description: 'Datos inválidos' },
        401: { description: 'No autenticado' },
        403: { description: 'No autorizado' },
        404: { description: 'Item no encontrado' },
        409: { description: 'Nombre, code o barcode duplicado' },
      },
    }),
    async (c) => {
      const user = c.get('user')
      const db = c.get('db')
      const { id } = c.req.valid('param')
      const body = c.req.valid('json')

      const result = await new UpdateItem(db).execute({
        id,
        userRoleId: user.roleId,
        userBranchId: user.branchId,
        userOrganizationId: user.organizationId,
        requestedBranchId: null,
        data: {
          name: body.name,
          description: body.description,
          categoryId: body.categoryId,
          baseUnitId: body.baseUnitId,
          purchasePrice: body.purchasePrice,
          salePrice: body.salePrice,
          code: body.code,
          barcode: body.barcode,
          isActive: body.isActive,
        },
      })

      if (!result) throw new ApiError('Item no encontrado', 404)

      return c.json(
        new ApiResponse({ data: result, message: 'Item actualizado', status: 200 }),
        200,
      )
    },
  )

  app.openapi(
    createRoute({
      method: 'delete',
      path: '/api/v1/items/{id}',
      tags: ['Items'],
      summary: 'Eliminar item (soft delete)',
      description:
        'Falla con 400 si tiene ventas activas asociadas. Cross-branch/org devuelve 404.',
      middleware: [authMiddleware, roleGuard(['Admin', 'Manager'])] as const,
      security: [{ cookieAuth: [] }],
      request: { params: itemIdParamSchema },
      responses: {
        200: {
          description: 'Item eliminado',
          content: { 'application/json': { schema: itemDeleteResponseSchema } },
        },
        400: { description: 'Tiene ventas activas asociadas' },
        401: { description: 'No autenticado' },
        403: { description: 'No autorizado' },
        404: { description: 'Item no encontrado' },
      },
    }),
    async (c) => {
      const user = c.get('user')
      const db = c.get('db')
      const { id } = c.req.valid('param')

      await new SoftDeleteItem(db).execute({
        id,
        userRoleId: user.roleId,
        userBranchId: user.branchId,
        userOrganizationId: user.organizationId,
        requestedBranchId: null,
      })

      return c.json(
        new ApiResponse({ data: null, message: 'Item eliminado', status: 200 }),
        200,
      )
    },
  )
}
