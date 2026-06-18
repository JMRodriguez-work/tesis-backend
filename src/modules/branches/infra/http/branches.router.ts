import { createRoute } from '@hono/zod-openapi'
import { authMiddleware } from '../../../../shared/auth'
import { roleGuard } from '../../../../shared/auth/role-guard'
import { ApiError, ApiResponse } from '../../../../shared/http/api-response'
import type { AppType } from '../../../../shared/types/app'
import { CreateBranch } from '../../use-cases/create-branch.use-case'
import { GetBranchById } from '../../use-cases/get-branch-by-id.use-case'
import { GetBranchesPaginated } from '../../use-cases/get-branches-paginated.use-case'
import { SoftDeleteBranch } from '../../use-cases/soft-delete-branch.use-case'
import { UpdateBranch } from '../../use-cases/update-branch.use-case'
import {
  branchDeleteResponseSchema,
  branchIdParamSchema,
  branchListResponseSchema,
  branchResponseSchema,
  createBranchSchema,
  listBranchesQuerySchema,
  updateBranchSchema,
} from './branches.schemas'

export function registerBranchRoutes(app: AppType) {
  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/v1/branches',
      tags: ['Branches'],
      summary: 'Listar sucursales de la organización (paginado)',
      description:
        'Lista las sucursales activas por defecto. Pasar `isActive=false` para ver inactivas. Filtra `isNull(deletedAt)`.',
      middleware: [authMiddleware, roleGuard(['Admin', 'Manager'])] as const,
      security: [{ cookieAuth: [] }],
      request: { query: listBranchesQuerySchema },
      responses: {
        200: {
          description: 'Sucursales obtenidas',
          content: { 'application/json': { schema: branchListResponseSchema } },
        },
        401: { description: 'No autenticado' },
        403: { description: 'No autorizado' },
      },
    }),
    async (c) => {
      const user = c.get('user')
      const db = c.get('db')
      const query = c.req.valid('query')

      const filters = {
        search: query.search,
        isActive: query.isActive,
      }

      const result = await new GetBranchesPaginated(db).execute({
        organizationId: user.organizationId ?? '',
        page: query.page,
        limit: query.limit,
        filters,
      })

      return c.json(
        new ApiResponse({ data: result, message: 'Sucursales obtenidas', status: 200 }),
        200,
      )
    },
  )

  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/v1/branches/{id}',
      tags: ['Branches'],
      summary: 'Obtener sucursal por ID',
      description: 'Cross-tenant devuelve 404.',
      middleware: [authMiddleware, roleGuard(['Admin', 'Manager'])] as const,
      security: [{ cookieAuth: [] }],
      request: { params: branchIdParamSchema },
      responses: {
        200: {
          description: 'Sucursal encontrada',
          content: { 'application/json': { schema: branchResponseSchema } },
        },
        401: { description: 'No autenticado' },
        403: { description: 'No autorizado' },
        404: { description: 'Sucursal no encontrada' },
      },
    }),
    async (c) => {
      const user = c.get('user')
      const db = c.get('db')
      const { id } = c.req.valid('param')

      const branch = await new GetBranchById(db).execute({
        id,
        organizationId: user.organizationId ?? '',
      })
      if (!branch) throw new ApiError('Sucursal no encontrada', 404)

      return c.json(
        new ApiResponse({ data: branch, message: 'Sucursal encontrada', status: 200 }),
        200,
      )
    },
  )

  app.openapi(
    createRoute({
      method: 'post',
      path: '/api/v1/branches',
      tags: ['Branches'],
      summary: 'Crear sucursal',
      description: 'Solo Admin. La organización se toma del usuario autenticado.',
      middleware: [authMiddleware, roleGuard(['Admin'])] as const,
      security: [{ cookieAuth: [] }],
      request: {
        body: { content: { 'application/json': { schema: createBranchSchema } } },
      },
      responses: {
        201: {
          description: 'Sucursal creada',
          content: { 'application/json': { schema: branchResponseSchema } },
        },
        400: { description: 'Datos inválidos' },
        401: { description: 'No autenticado' },
        403: { description: 'No autorizado' },
      },
    }),
    async (c) => {
      const user = c.get('user')
      const db = c.get('db')
      const body = c.req.valid('json')

      const branch = await new CreateBranch(db).execute({
        name: body.name,
        organizationId: user.organizationId ?? '',
      })

      return c.json(
        new ApiResponse({ data: branch, message: 'Sucursal creada', status: 201 }),
        201,
      )
    },
  )

  app.openapi(
    createRoute({
      method: 'put',
      path: '/api/v1/branches/{id}',
      tags: ['Branches'],
      summary: 'Actualizar sucursal (nombre, isActive)',
      description: 'Solo Admin. Cross-tenant devuelve 404.',
      middleware: [authMiddleware, roleGuard(['Admin'])] as const,
      security: [{ cookieAuth: [] }],
      request: {
        params: branchIdParamSchema,
        body: { content: { 'application/json': { schema: updateBranchSchema } } },
      },
      responses: {
        200: {
          description: 'Sucursal actualizada',
          content: { 'application/json': { schema: branchResponseSchema } },
        },
        400: { description: 'Datos inválidos' },
        401: { description: 'No autenticado' },
        403: { description: 'No autorizado' },
        404: { description: 'Sucursal no encontrada' },
      },
    }),
    async (c) => {
      const user = c.get('user')
      const db = c.get('db')
      const { id } = c.req.valid('param')
      const body = c.req.valid('json')

      const branch = await new UpdateBranch(db).execute({
        id,
        organizationId: user.organizationId ?? '',
        data: { name: body.name, isActive: body.isActive },
      })

      if (!branch) throw new ApiError('Sucursal no encontrada', 404)

      return c.json(
        new ApiResponse({ data: branch, message: 'Sucursal actualizada', status: 200 }),
        200,
      )
    },
  )

  app.openapi(
    createRoute({
      method: 'delete',
      path: '/api/v1/branches/{id}',
      tags: ['Branches'],
      summary: 'Eliminar sucursal (soft delete)',
      description:
        'Solo Admin. Falla con 400 si es la última branch activa de la org o si tiene usuarios activos. Cross-tenant devuelve 404.',
      middleware: [authMiddleware, roleGuard(['Admin'])] as const,
      security: [{ cookieAuth: [] }],
      request: { params: branchIdParamSchema },
      responses: {
        200: {
          description: 'Sucursal eliminada',
          content: { 'application/json': { schema: branchDeleteResponseSchema } },
        },
        400: { description: 'No se puede eliminar (última activa o con usuarios)' },
        401: { description: 'No autenticado' },
        403: { description: 'No autorizado' },
        404: { description: 'Sucursal no encontrada' },
      },
    }),
    async (c) => {
      const user = c.get('user')
      const db = c.get('db')
      const { id } = c.req.valid('param')

      await new SoftDeleteBranch(db).execute(id, user.organizationId ?? '')

      return c.json(
        new ApiResponse({ data: null, message: 'Sucursal eliminada', status: 200 }),
        200,
      )
    },
  )
}
