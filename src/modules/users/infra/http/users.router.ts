import { createRoute } from '@hono/zod-openapi'
import { authMiddleware } from '../../../../shared/auth'
import { roleGuard } from '../../../../shared/auth/role-guard'
import { ApiError, ApiResponse } from '../../../../shared/http/api-response'
import type { AppType } from '../../../../shared/types/app'
import { ChangeUserRole } from '../../use-cases/change-user-role.use-case'
import { CreateUser } from '../../use-cases/create-user.use-case'
import { GetMe } from '../../use-cases/get-me.use-case'
import { GetUserById } from '../../use-cases/get-user-by-id.use-case'
import { GetUsersPaginated } from '../../use-cases/get-users-paginated.use-case'
import { SoftDeleteUser } from '../../use-cases/soft-delete-user.use-case'
import { UpdateUser } from '../../use-cases/update-user.use-case'
import {
  changeUserRoleSchema,
  createUserSchema,
  updateUserSchema,
  userDeleteResponseSchema,
  userIdParamSchema,
  userListQuerySchema,
  userListResponseSchema,
  userResponseSchema,
} from './users.schemas'

export function registerUserRoutes(app: AppType) {
  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/v1/users/me',
      tags: ['Users'],
      summary: 'Obtener usuario autenticado con rol y sucursal',
      middleware: [authMiddleware] as const,
      security: [{ cookieAuth: [] }],
      responses: {
        200: {
          description: 'Usuario autenticado',
          content: { 'application/json': { schema: userResponseSchema } },
        },
        401: { description: 'No autenticado' },
      },
    }),
    async (c) => {
      const user = c.get('user')
      const db = c.get('db')
      const me = await new GetMe(db).execute(user.id)
      if (!me) throw new ApiError('Usuario no encontrado', 404)
      return c.json(new ApiResponse({ data: me, message: 'Usuario autenticado', status: 200 }), 200)
    },
  )

  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/v1/users',
      tags: ['Users'],
      summary: 'Listar usuarios de la organización (paginado)',
      middleware: [authMiddleware, roleGuard(['Admin'])] as const,
      security: [{ cookieAuth: [] }],
      request: { query: userListQuerySchema },
      responses: {
        200: {
          description: 'Usuarios de la organización',
          content: { 'application/json': { schema: userListResponseSchema } },
        },
        401: { description: 'No autenticado' },
        403: { description: 'No autorizado' },
      },
    }),
    async (c) => {
      const user = c.get('user')
      const db = c.get('db')
      const query = c.req.valid('query')

      const result = await new GetUsersPaginated(db).execute({
        organizationId: user.organizationId ?? '',
        page: query.page,
        limit: query.limit,
        filters: { search: query.search, roleId: query.roleId },
      })

      return c.json(
        new ApiResponse({ data: result, message: 'Usuarios obtenidos', status: 200 }),
        200,
      )
    },
  )

  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/v1/users/{id}',
      tags: ['Users'],
      summary: 'Obtener usuario por ID',
      middleware: [authMiddleware, roleGuard(['Admin'])] as const,
      security: [{ cookieAuth: [] }],
      request: { params: userIdParamSchema },
      responses: {
        200: {
          description: 'Usuario encontrado',
          content: { 'application/json': { schema: userResponseSchema } },
        },
        401: { description: 'No autenticado' },
        403: { description: 'No autorizado' },
        404: { description: 'Usuario no encontrado' },
      },
    }),
    async (c) => {
      const user = c.get('user')
      const db = c.get('db')
      const { id } = c.req.valid('param')

      const found = await new GetUserById(db).execute({
        id,
        organizationId: user.organizationId ?? '',
      })
      if (!found) throw new ApiError('Usuario no encontrado', 404)

      return c.json(
        new ApiResponse({ data: found, message: 'Usuario encontrado', status: 200 }),
        200,
      )
    },
  )

  app.openapi(
    createRoute({
      method: 'post',
      path: '/api/v1/users',
      tags: ['Users'],
      summary: 'Crear usuario en la organización',
      description:
        'Crea un usuario vía Better Auth y le asigna la organización, sucursal y rol del admin. Si el rol no es Admin, branchId es obligatorio. Si es Admin, branchId debe omitirse.',
      middleware: [authMiddleware, roleGuard(['Admin'])] as const,
      security: [{ cookieAuth: [] }],
      request: {
        body: { content: { 'application/json': { schema: createUserSchema } } },
      },
      responses: {
        201: {
          description: 'Usuario creado',
          content: { 'application/json': { schema: userResponseSchema } },
        },
        400: { description: 'Datos inválidos' },
        401: { description: 'No autenticado' },
        403: { description: 'No autorizado' },
        409: { description: 'Email ya registrado' },
      },
    }),
    async (c) => {
      const user = c.get('user')
      const db = c.get('db')
      const body = c.req.valid('json')

      const created = await new CreateUser().execute({
        email: body.email,
        password: body.password,
        name: body.name,
        branchId: body.branchId,
        roleId: body.roleId,
        isActive: body.isActive,
        organizationId: user.organizationId ?? '',
        defaultBranchId: user.branchId,
        env: c.env,
        db,
      })

      return c.json(
        new ApiResponse({ data: created, message: 'Usuario creado', status: 201 }),
        201,
      )
    },
  )

  app.openapi(
    createRoute({
      method: 'put',
      path: '/api/v1/users/{id}',
      tags: ['Users'],
      summary: 'Actualizar usuario (nombre, sucursal, isActive)',
      description:
        'No permite cambiar rol (usar PATCH /users/:id/role) ni email. Cross-tenant devuelve 404. Si branchId se setea a null, el usuario debe ser Admin.',
      middleware: [authMiddleware, roleGuard(['Admin'])] as const,
      security: [{ cookieAuth: [] }],
      request: {
        params: userIdParamSchema,
        body: { content: { 'application/json': { schema: updateUserSchema } } },
      },
      responses: {
        200: {
          description: 'Usuario actualizado',
          content: { 'application/json': { schema: userResponseSchema } },
        },
        400: { description: 'Datos inválidos' },
        401: { description: 'No autenticado' },
        403: { description: 'No autorizado' },
        404: { description: 'Usuario no encontrado' },
      },
    }),
    async (c) => {
      const user = c.get('user')
      const db = c.get('db')
      const { id } = c.req.valid('param')
      const body = c.req.valid('json')

      const updated = await new UpdateUser(db).execute({
        id,
        organizationId: user.organizationId ?? '',
        data: {
          name: body.name,
          branchId: body.branchId,
          isActive: body.isActive,
        },
      })

      if (!updated) throw new ApiError('Usuario no encontrado', 404)

      return c.json(
        new ApiResponse({ data: updated, message: 'Usuario actualizado', status: 200 }),
        200,
      )
    },
  )

  app.openapi(
    createRoute({
      method: 'patch',
      path: '/api/v1/users/{id}/role',
      tags: ['Users'],
      summary: 'Cambiar rol del usuario',
      description:
        'Si el nuevo rol no es Admin y el usuario no tiene sucursal asignada, devuelve 400.',
      middleware: [authMiddleware, roleGuard(['Admin'])] as const,
      security: [{ cookieAuth: [] }],
      request: {
        params: userIdParamSchema,
        body: { content: { 'application/json': { schema: changeUserRoleSchema } } },
      },
      responses: {
        200: {
          description: 'Rol actualizado',
          content: { 'application/json': { schema: userResponseSchema } },
        },
        400: { description: 'Datos inválidos' },
        401: { description: 'No autenticado' },
        403: { description: 'No autorizado' },
        404: { description: 'Usuario no encontrado' },
      },
    }),
    async (c) => {
      const user = c.get('user')
      const db = c.get('db')
      const { id } = c.req.valid('param')
      const body = c.req.valid('json')

      const updated = await new ChangeUserRole(db).execute({
        id,
        organizationId: user.organizationId ?? '',
        roleId: body.roleId,
      })

      if (!updated) throw new ApiError('Usuario no encontrado', 404)

      return c.json(
        new ApiResponse({ data: updated, message: 'Rol actualizado', status: 200 }),
        200,
      )
    },
  )

  app.openapi(
    createRoute({
      method: 'delete',
      path: '/api/v1/users/{id}',
      tags: ['Users'],
      summary: 'Eliminar usuario (soft delete)',
      description:
        'Marca al usuario como inactivo. No permite auto-borrarse. Cross-tenant devuelve 404.',
      middleware: [authMiddleware, roleGuard(['Admin'])] as const,
      security: [{ cookieAuth: [] }],
      request: { params: userIdParamSchema },
      responses: {
        200: {
          description: 'Usuario eliminado',
          content: { 'application/json': { schema: userDeleteResponseSchema } },
        },
        400: { description: 'No se puede eliminar el propio usuario' },
        401: { description: 'No autenticado' },
        403: { description: 'No autorizado' },
        404: { description: 'Usuario no encontrado' },
      },
    }),
    async (c) => {
      const user = c.get('user')
      const db = c.get('db')
      const { id } = c.req.valid('param')

      await new SoftDeleteUser(db).execute(id, user.id, user.organizationId ?? '')

      return c.json(
        new ApiResponse({ data: null, message: 'Usuario eliminado', status: 200 }),
        200,
      )
    },
  )
}
