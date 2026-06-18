import { createRoute } from '@hono/zod-openapi'
import { authMiddleware } from '../../../../shared/auth'
import { roleGuard } from '../../../../shared/auth/role-guard'
import { ApiError, ApiResponse } from '../../../../shared/http/api-response'
import type { AppType } from '../../../../shared/types/app'
import { CreateItemCategory } from '../../use-cases/create-item-category.use-case'
import { GetItemCategoriesPaginated } from '../../use-cases/get-item-categories-paginated.use-case'
import { GetItemCategoryById } from '../../use-cases/get-item-category-by-id.use-case'
import { SoftDeleteItemCategory } from '../../use-cases/soft-delete-item-category.use-case'
import { UpdateItemCategory } from '../../use-cases/update-item-category.use-case'
import {
  createItemCategorySchema,
  itemCategoryDeleteResponseSchema,
  itemCategoryIdParamSchema,
  itemCategoryListResponseSchema,
  itemCategoryResponseSchema,
  listItemCategoriesQuerySchema,
  updateItemCategorySchema,
} from './item-categories.schemas'

export function registerItemCategoryRoutes(app: AppType) {
  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/v1/item-categories',
      tags: ['ItemCategories'],
      summary: 'Listar categorías de la sucursal efectiva',
      description:
        'Admin debe indicar ?branchId=. Manager/Employee: filtrado por su branch. Filtra isNull(deletedAt).',
      middleware: [authMiddleware] as const,
      security: [{ cookieAuth: [] }],
      request: { query: listItemCategoriesQuerySchema },
      responses: {
        200: {
          description: 'Categorías obtenidas',
          content: { 'application/json': { schema: itemCategoryListResponseSchema } },
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

      const result = await new GetItemCategoriesPaginated(db).execute({
        userRoleId: user.roleId,
        userBranchId: user.branchId,
        userOrganizationId: user.organizationId,
        requestedBranchId: query.branchId ?? null,
        page: query.page,
        limit: query.limit,
        filters: { search: query.search, isActive: query.isActive },
      })

      return c.json(
        new ApiResponse({ data: result, message: 'Categorías obtenidas', status: 200 }),
        200,
      )
    },
  )

  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/v1/item-categories/{id}',
      tags: ['ItemCategories'],
      summary: 'Obtener categoría por ID',
      description: 'Cross-branch (Manager) o cross-org (Admin) devuelve 404.',
      middleware: [authMiddleware] as const,
      security: [{ cookieAuth: [] }],
      request: { params: itemCategoryIdParamSchema },
      responses: {
        200: {
          description: 'Categoría encontrada',
          content: { 'application/json': { schema: itemCategoryResponseSchema } },
        },
        401: { description: 'No autenticado' },
        404: { description: 'Categoría no encontrada' },
      },
    }),
    async (c) => {
      const user = c.get('user')
      const db = c.get('db')
      const { id } = c.req.valid('param')

      const category = await new GetItemCategoryById(db).execute({
        id,
        userRoleId: user.roleId,
        userBranchId: user.branchId,
        userOrganizationId: user.organizationId,
        requestedBranchId: null,
      })

      if (!category) throw new ApiError('Categoría no encontrada', 404)

      return c.json(
        new ApiResponse({ data: category, message: 'Categoría encontrada', status: 200 }),
        200,
      )
    },
  )

  app.openapi(
    createRoute({
      method: 'post',
      path: '/api/v1/item-categories',
      tags: ['ItemCategories'],
      summary: 'Crear categoría',
      description:
        'Admin: debe mandar branchId en el body. Manager: se asigna a su branch automáticamente; si manda branchId de otra branch, devuelve 400. Employee: 403.',
      middleware: [authMiddleware, roleGuard(['Admin', 'Manager'])] as const,
      security: [{ cookieAuth: [] }],
      request: {
        body: { content: { 'application/json': { schema: createItemCategorySchema } } },
      },
      responses: {
        201: {
          description: 'Categoría creada',
          content: { 'application/json': { schema: itemCategoryResponseSchema } },
        },
        400: { description: 'Datos inválidos o branchId no autorizado' },
        401: { description: 'No autenticado' },
        403: { description: 'No autorizado' },
      },
    }),
    async (c) => {
      const user = c.get('user')
      const db = c.get('db')
      const body = c.req.valid('json')

      const category = await new CreateItemCategory(db).execute({
        userRoleId: user.roleId,
        userBranchId: user.branchId,
        userOrganizationId: user.organizationId,
        requestedBranchId: body.branchId ?? null,
        name: body.name,
        description: body.description,
        isActive: body.isActive,
      })

      return c.json(
        new ApiResponse({ data: category, message: 'Categoría creada', status: 201 }),
        201,
      )
    },
  )

  app.openapi(
    createRoute({
      method: 'put',
      path: '/api/v1/item-categories/{id}',
      tags: ['ItemCategories'],
      summary: 'Actualizar categoría (nombre, descripción, isActive)',
      description: 'Cross-branch (Manager) o cross-org (Admin) devuelve 404.',
      middleware: [authMiddleware, roleGuard(['Admin', 'Manager'])] as const,
      security: [{ cookieAuth: [] }],
      request: {
        params: itemCategoryIdParamSchema,
        body: { content: { 'application/json': { schema: updateItemCategorySchema } } },
      },
      responses: {
        200: {
          description: 'Categoría actualizada',
          content: { 'application/json': { schema: itemCategoryResponseSchema } },
        },
        400: { description: 'Datos inválidos' },
        401: { description: 'No autenticado' },
        403: { description: 'No autorizado' },
        404: { description: 'Categoría no encontrada' },
      },
    }),
    async (c) => {
      const user = c.get('user')
      const db = c.get('db')
      const { id } = c.req.valid('param')
      const body = c.req.valid('json')

      const category = await new UpdateItemCategory(db).execute({
        id,
        userRoleId: user.roleId,
        userBranchId: user.branchId,
        userOrganizationId: user.organizationId,
        requestedBranchId: null,
        data: {
          name: body.name,
          description: body.description,
          isActive: body.isActive,
        },
      })

      if (!category) throw new ApiError('Categoría no encontrada', 404)

      return c.json(
        new ApiResponse({ data: category, message: 'Categoría actualizada', status: 200 }),
        200,
      )
    },
  )

  app.openapi(
    createRoute({
      method: 'delete',
      path: '/api/v1/item-categories/{id}',
      tags: ['ItemCategories'],
      summary: 'Eliminar categoría (soft delete)',
      description:
        'Falla con 400 si tiene items activos asociados. Cross-branch (Manager) o cross-org (Admin) devuelve 404.',
      middleware: [authMiddleware, roleGuard(['Admin', 'Manager'])] as const,
      security: [{ cookieAuth: [] }],
      request: { params: itemCategoryIdParamSchema },
      responses: {
        200: {
          description: 'Categoría eliminada',
          content: { 'application/json': { schema: itemCategoryDeleteResponseSchema } },
        },
        400: { description: 'Tiene items activos asociados' },
        401: { description: 'No autenticado' },
        403: { description: 'No autorizado' },
        404: { description: 'Categoría no encontrada' },
      },
    }),
    async (c) => {
      const user = c.get('user')
      const db = c.get('db')
      const { id } = c.req.valid('param')

      await new SoftDeleteItemCategory(db).execute({
        id,
        userRoleId: user.roleId,
        userBranchId: user.branchId,
        userOrganizationId: user.organizationId,
        requestedBranchId: null,
      })

      return c.json(
        new ApiResponse({ data: null, message: 'Categoría eliminada', status: 200 }),
        200,
      )
    },
  )
}
