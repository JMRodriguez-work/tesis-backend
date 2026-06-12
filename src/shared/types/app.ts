import type { OpenAPIHono } from '@hono/zod-openapi'
import type { Env } from '../env'

export type AuthUser = {
  id: string
  email: string
  name: string
  organizationId: string
  branchId: string
  roleId: number
  isActive: boolean
}

export type Variables = {
  user: AuthUser
}

export type AppType = OpenAPIHono<{
  Bindings: Env
  Variables: Variables
}>
