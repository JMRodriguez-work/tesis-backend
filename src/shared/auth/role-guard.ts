import { eq } from 'drizzle-orm'
import { createMiddleware } from 'hono/factory'
import { ApiError } from '../http/api-response'
import type { Env } from '../env'
import type { Variables } from '../types/app'
import * as schema from '../db/schema'

export const ROLES = ['Admin', 'Manager', 'Employee'] as const
export type RoleName = (typeof ROLES)[number]

export function isRoleName(value: unknown): value is RoleName {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value)
}

export const roleGuard = (allowedRoles: readonly RoleName[]) =>
  createMiddleware<{ Bindings: Env; Variables: Variables }>(async (c, next) => {
    const user = c.get('user')
    const db = c.get('db')

    if (user.roleId === null || user.roleId === undefined) {
      throw new ApiError('No autorizado', 403)
    }

    const role = await db
      .select({ name: schema.roles.name })
      .from(schema.roles)
      .where(eq(schema.roles.id, user.roleId))
      .limit(1)

    const roleName = role[0]?.name
    if (!isRoleName(roleName) || !allowedRoles.includes(roleName)) {
      throw new ApiError('No autorizado', 403)
    }

    await next()
  })
