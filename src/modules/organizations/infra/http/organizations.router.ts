import { createRoute } from '@hono/zod-openapi'
import { authMiddleware } from '../../../../shared/auth'
import { roleGuard } from '../../../../shared/auth/role-guard'
import { ApiError, ApiResponse } from '../../../../shared/http/api-response'
import { GetOrganizationById } from '../../use-cases/get-organization-by-id.use-case'
import { UpdateOrganization } from '../../use-cases/update-organization.use-case'
import {
  organizationIdParamSchema,
  organizationResponseSchema,
  updateOrganizationSchema,
} from './organizations.schemas'
import type { AppType } from '../../../../shared/types/app'

export function registerOrganizationRoutes(app: AppType) {
  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/v1/organizations/{id}',
      tags: ['Organizations'],
      summary: 'Obtener organización por ID',
      description:
        'Devuelve la organización del usuario autenticado. Por anti-enumeration devuelve 404 si el ID no corresponde a su organización.',
      middleware: [authMiddleware] as const,
      security: [{ cookieAuth: [] }],
      request: { params: organizationIdParamSchema },
      responses: {
        200: {
          description: 'Organización encontrada',
          content: { 'application/json': { schema: organizationResponseSchema } },
        },
        401: { description: 'No autenticado' },
        404: { description: 'Organización no encontrada' },
      },
    }),
    async (c) => {
      const { id } = c.req.valid('param')
      const user = c.get('user')
      const db = c.get('db')

      const useCase = new GetOrganizationById(db)
      const org = await useCase.execute({ id, organizationId: user.organizationId ?? '' })

      if (!org) throw new ApiError('Organización no encontrada', 404)

      return c.json(
        new ApiResponse({ data: org, message: 'Organización encontrada', status: 200 }),
        200,
      )
    },
  )

  app.openapi(
    createRoute({
      method: 'put',
      path: '/api/v1/organizations/{id}',
      tags: ['Organizations'],
      summary: 'Actualizar organización',
      description:
        'Edita el nombre del comercio. Solo Admin. Devuelve 404 si el ID no corresponde a su organización.',
      middleware: [authMiddleware, roleGuard(['Admin'])] as const,
      security: [{ cookieAuth: [] }],
      request: {
        params: organizationIdParamSchema,
        body: { content: { 'application/json': { schema: updateOrganizationSchema } } },
      },
      responses: {
        200: {
          description: 'Organización actualizada',
          content: { 'application/json': { schema: organizationResponseSchema } },
        },
        400: { description: 'Datos inválidos' },
        401: { description: 'No autenticado' },
        403: { description: 'No autorizado' },
        404: { description: 'Organización no encontrada' },
      },
    }),
    async (c) => {
      const { id } = c.req.valid('param')
      const body = c.req.valid('json')
      const user = c.get('user')
      const db = c.get('db')

      const useCase = new UpdateOrganization(db)
      const org = await useCase.execute({
        id,
        organizationId: user.organizationId ?? '',
        name: body.name,
      })

      if (!org) throw new ApiError('Organización no encontrada', 404)

      return c.json(
        new ApiResponse({ data: org, message: 'Organización actualizada', status: 200 }),
        200,
      )
    },
  )
}
