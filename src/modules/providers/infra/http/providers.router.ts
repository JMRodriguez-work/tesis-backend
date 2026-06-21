import { createRoute } from '@hono/zod-openapi'
import { authMiddleware } from '../../../../shared/auth'
import { roleGuard } from '../../../../shared/auth/role-guard'
import { ApiError, ApiResponse } from '../../../../shared/http/api-response'
import type { AppType } from '../../../../shared/types/app'
import { CreateProvider } from '../../use-cases/create-provider.use-case'
import { GetProviderById } from '../../use-cases/get-provider-by-id.use-case'
import { GetProvidersPaginated } from '../../use-cases/get-providers-paginated.use-case'
import { SoftDeleteProvider } from '../../use-cases/soft-delete-provider.use-case'
import { UpdateProvider } from '../../use-cases/update-provider.use-case'
import {
  createProviderSchema,
  listProvidersQuerySchema,
  providerDeleteResponseSchema,
  providerIdParamSchema,
  providerListResponseSchema,
  providerResponseSchema,
  updateProviderSchema,
} from './providers.schemas'

export function registerProviderRoutes(app: AppType) {
  // GET /api/v1/providers
  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/v1/providers',
      tags: ['Providers'],
      summary: 'Listar proveedores',
      description:
        'Org-wide. Filtros: search (name, companyName, contactName), isActive.',
      middleware: [authMiddleware] as const,
      security: [{ cookieAuth: [] }],
      request: { query: listProvidersQuerySchema },
      responses: {
        200: {
          description: 'Proveedores obtenidos',
          content: { 'application/json': { schema: providerListResponseSchema } },
        },
        401: { description: 'No autenticado' },
      },
    }),
    async (c) => {
      const user = c.get('user')
      const db = c.get('db')
      const query = c.req.valid('query')
      const result = await new GetProvidersPaginated(db).execute({
        organizationId: user.organizationId ?? '',
        filters: { search: query.search, isActive: query.isActive },
        page: query.page,
        limit: query.limit,
      })
      return c.json(
        new ApiResponse({ data: result, message: 'Proveedores obtenidos', status: 200 }),
        200,
      )
    },
  )

  // GET /api/v1/providers/:id
  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/v1/providers/{id}',
      tags: ['Providers'],
      summary: 'Obtener proveedor por ID',
      description: 'Cross-org → 404.',
      middleware: [authMiddleware] as const,
      security: [{ cookieAuth: [] }],
      request: { params: providerIdParamSchema },
      responses: {
        200: {
          description: 'Proveedor encontrado',
          content: { 'application/json': { schema: providerResponseSchema } },
        },
        401: { description: 'No autenticado' },
        404: { description: 'Proveedor no encontrado' },
      },
    }),
    async (c) => {
      const user = c.get('user')
      const db = c.get('db')
      const { id } = c.req.valid('param')
      const provider = await new GetProviderById(db).execute({
        id,
        organizationId: user.organizationId ?? '',
      })
      if (!provider) throw new ApiError('Proveedor no encontrado', 404)
      return c.json(
        new ApiResponse({ data: provider, message: 'Proveedor encontrado', status: 200 }),
        200,
      )
    },
  )

  // POST /api/v1/providers
  app.openapi(
    createRoute({
      method: 'post',
      path: '/api/v1/providers',
      tags: ['Providers'],
      summary: 'Crear proveedor',
      description:
        'Solo Admin/Manager. Name único dentro de la org activa.',
      middleware: [authMiddleware, roleGuard(['Admin', 'Manager'])] as const,
      security: [{ cookieAuth: [] }],
      request: {
        body: { content: { 'application/json': { schema: createProviderSchema } } },
      },
      responses: {
        201: {
          description: 'Proveedor creado',
          content: { 'application/json': { schema: providerResponseSchema } },
        },
        400: { description: 'Datos inválidos' },
        401: { description: 'No autenticado' },
        403: { description: 'No autorizado' },
        409: { description: 'Nombre duplicado' },
      },
    }),
    async (c) => {
      const user = c.get('user')
      const db = c.get('db')
      const body = c.req.valid('json')
      const provider = await new CreateProvider(db).execute({
        organizationId: user.organizationId ?? '',
        name: body.name,
        companyName: body.companyName,
        contactName: body.contactName,
        contactEmail: body.contactEmail,
        contactPhone: body.contactPhone,
      })
      return c.json(
        new ApiResponse({ data: provider, message: 'Proveedor creado', status: 201 }),
        201,
      )
    },
  )

  // PUT /api/v1/providers/:id
  app.openapi(
    createRoute({
      method: 'put',
      path: '/api/v1/providers/{id}',
      tags: ['Providers'],
      summary: 'Actualizar proveedor (incluye reactivación con isActive: true)',
      description:
        'Solo Admin/Manager. Cross-org → 404. Re-valida unicidad de name con excludeId.',
      middleware: [authMiddleware, roleGuard(['Admin', 'Manager'])] as const,
      security: [{ cookieAuth: [] }],
      request: {
        params: providerIdParamSchema,
        body: { content: { 'application/json': { schema: updateProviderSchema } } },
      },
      responses: {
        200: {
          description: 'Proveedor actualizado',
          content: { 'application/json': { schema: providerResponseSchema } },
        },
        400: { description: 'Datos inválidos' },
        401: { description: 'No autenticado' },
        403: { description: 'No autorizado' },
        404: { description: 'Proveedor no encontrado' },
        409: { description: 'Nombre duplicado' },
      },
    }),
    async (c) => {
      const user = c.get('user')
      const db = c.get('db')
      const { id } = c.req.valid('param')
      const body = c.req.valid('json')
      const provider = await new UpdateProvider(db).execute({
        id,
        organizationId: user.organizationId ?? '',
        data: {
          name: body.name,
          companyName: body.companyName,
          contactName: body.contactName,
          contactEmail: body.contactEmail,
          contactPhone: body.contactPhone,
          isActive: body.isActive,
        },
      })
      if (!provider) throw new ApiError('Proveedor no encontrado', 404)
      return c.json(
        new ApiResponse({ data: provider, message: 'Proveedor actualizado', status: 200 }),
        200,
      )
    },
  )

  // DELETE /api/v1/providers/:id
  app.openapi(
    createRoute({
      method: 'delete',
      path: '/api/v1/providers/{id}',
      tags: ['Providers'],
      summary: 'Eliminar proveedor (soft delete)',
      description:
        'Solo Admin. 400 si tiene órdenes activas (status != cancelled). Idempotente.',
      middleware: [authMiddleware, roleGuard(['Admin'])] as const,
      security: [{ cookieAuth: [] }],
      request: { params: providerIdParamSchema },
      responses: {
        200: {
          description: 'Proveedor eliminado',
          content: { 'application/json': { schema: providerDeleteResponseSchema } },
        },
        400: { description: 'Tiene órdenes activas' },
        401: { description: 'No autenticado' },
        403: { description: 'No autorizado' },
        404: { description: 'Proveedor no encontrado' },
      },
    }),
    async (c) => {
      const user = c.get('user')
      const db = c.get('db')
      const { id } = c.req.valid('param')
      await new SoftDeleteProvider(db).execute({
        id,
        organizationId: user.organizationId ?? '',
      })
      return c.json(
        new ApiResponse({ data: null, message: 'Proveedor eliminado', status: 200 }),
        200,
      )
    },
  )
}
