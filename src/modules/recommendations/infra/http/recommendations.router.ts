import { createRoute } from '@hono/zod-openapi'
import { authMiddleware } from '../../../../shared/auth'
import { roleGuard } from '../../../../shared/auth/role-guard'
import { ApiError, ApiResponse } from '../../../../shared/http/api-response'
import type { AppType } from '../../../../shared/types/app'
import { GetRecommendationById } from '../../use-cases/get-recommendation-by-id.use-case'
import { GetRecommendationsPaginated } from '../../use-cases/get-recommendations-paginated.use-case'
import { UpdateRecommendationStatus } from '../../use-cases/update-recommendation-status.use-case'
import {
  listRecommendationsQuerySchema,
  recommendationIdParamSchema,
  recommendationListResponseSchema,
  recommendationResponseSchema,
  updateRecommendationStatusSchema,
} from './recommendations.schemas'

const ADMIN_ROLE_ID = 1

export function registerRecommendationRoutes(app: AppType) {
  // GET /api/v1/recommendations
  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/v1/recommendations',
      tags: ['Recommendations'],
      summary: 'Listar recomendaciones',
      description:
        'Filtros: branchId (admin), type, status (default pending), itemId. Default status=pending para mostrar solo lo accionable.',
      middleware: [authMiddleware] as const,
      security: [{ cookieAuth: [] }],
      request: { query: listRecommendationsQuerySchema },
      responses: {
        200: {
          description: 'Recomendaciones obtenidas',
          content: { 'application/json': { schema: recommendationListResponseSchema } },
        },
        400: { description: 'branchId inválido' },
        401: { description: 'No autenticado' },
      },
    }),
    async (c) => {
      const user = c.get('user')
      const db = c.get('db')
      const query = c.req.valid('query')
      const result = await new GetRecommendationsPaginated(db).execute({
        userRoleId: user.roleId,
        userBranchId: user.branchId,
        userOrganizationId: user.organizationId,
        requestedBranchId: query.branchId ?? null,
        filters: {
          type: query.type,
          status: query.status,
          itemId: query.itemId,
        },
        page: query.page,
        limit: query.limit,
      })
      return c.json(
        new ApiResponse({ data: result, message: 'Recomendaciones obtenidas', status: 200 }),
        200,
      )
    },
  )

  // GET /api/v1/recommendations/{id}
  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/v1/recommendations/{id}',
      tags: ['Recommendations'],
      summary: 'Obtener recomendación por ID',
      description: 'Cross-org/branch → 404.',
      middleware: [authMiddleware] as const,
      security: [{ cookieAuth: [] }],
      request: { params: recommendationIdParamSchema },
      responses: {
        200: {
          description: 'Recomendación encontrada',
          content: { 'application/json': { schema: recommendationResponseSchema } },
        },
        401: { description: 'No autenticado' },
        404: { description: 'Recomendación no encontrada' },
      },
    }),
    async (c) => {
      const user = c.get('user')
      const db = c.get('db')
      const { id } = c.req.valid('param')
      const isAdmin = user.roleId === ADMIN_ROLE_ID
      const rec = await new GetRecommendationById(db).execute({
        recommendationId: id,
        userRoleId: user.roleId,
        userBranchId: user.branchId,
        userOrganizationId: user.organizationId,
        isAdmin,
      })
      if (!rec) throw new ApiError('Recomendación no encontrada', 404)
      return c.json(
        new ApiResponse({ data: rec, message: 'Recomendación encontrada', status: 200 }),
        200,
      )
    },
  )

  // PATCH /api/v1/recommendations/{id}/status
  app.openapi(
    createRoute({
      method: 'patch',
      path: '/api/v1/recommendations/{id}/status',
      tags: ['Recommendations'],
      summary: 'Actualizar status de la recomendación',
      description:
        'Solo Admin/Manager. Body: { status }. Transiciones permitidas: pending↔applied, pending↔dismissed. Idempotente.',
      middleware: [authMiddleware, roleGuard(['Admin', 'Manager'])] as const,
      security: [{ cookieAuth: [] }],
      request: {
        params: recommendationIdParamSchema,
        body: { content: { 'application/json': { schema: updateRecommendationStatusSchema } } },
      },
      responses: {
        200: {
          description: 'Status actualizado',
          content: { 'application/json': { schema: recommendationResponseSchema } },
        },
        400: { description: 'Transición de status no permitida' },
        401: { description: 'No autenticado' },
        403: { description: 'No autorizado' },
        404: { description: 'Recomendación no encontrada' },
      },
    }),
    async (c) => {
      const user = c.get('user')
      const db = c.get('db')
      const { id } = c.req.valid('param')
      const { status } = c.req.valid('json')
      const isAdmin = user.roleId === ADMIN_ROLE_ID
      const rec = await new UpdateRecommendationStatus(db).execute({
        recommendationId: id,
        newStatus: status,
        userRoleId: user.roleId,
        userBranchId: user.branchId,
        userOrganizationId: user.organizationId,
        isAdmin,
      })
      if (!rec) throw new ApiError('Recomendación no encontrada', 404)
      return c.json(
        new ApiResponse({ data: rec, message: 'Status actualizado', status: 200 }),
        200,
      )
    },
  )
}
