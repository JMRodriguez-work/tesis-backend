import { ApiError } from '../../../shared/http/api-response'
import { getAuth } from '../../../shared/auth'
import type { Auth } from '../../../shared/auth'
import type { DB } from '../../../shared/db'
import type { Env } from '../../../shared/env'
import {
  findUserByEmail,
  findUserById,
  softDeleteUser,
  updateUser,
  type UserWithRelations,
} from '../infra/repository/user.repository'
import {
  assertBranchRoleConsistency,
  assertRoleExists,
} from './validate-user-branch-role'

const ADMIN_ROLE_ID = 1
const EMPLOYEE_ROLE_ID = 3

export type CreateUserInput = {
  email: string
  password: string
  name: string
  branchId?: string
  roleId?: number
  isActive?: boolean
  organizationId: string
  defaultBranchId: string | null
  env: Env
  db: DB
}

export class CreateUser {
  async execute(input: CreateUserInput): Promise<UserWithRelations> {
    const roleId = input.roleId ?? EMPLOYEE_ROLE_ID
    const isActive = input.isActive ?? true
    const branchId = input.branchId ?? null

    assertBranchRoleConsistency({ roleId, branchId })
    await assertRoleExists(input.db, roleId)

    const existing = await findUserByEmail(input.db, input.email)
    if (existing && existing.deletedAt === null) {
      throw new ApiError('Ya existe un usuario con ese email', 409)
    }

    const auth = getAuth(input.env, input.db)
    const result = await this.signUp(auth, input)

    if (!result.user) {
      throw new ApiError('No se pudo crear el usuario', 500)
    }

    try {
      const updated = await updateUser(input.db, result.user.id, {
        organizationId: input.organizationId,
        branchId: branchId,
        roleId,
        isActive,
      })

      if (!updated) {
        throw new ApiError('No se pudo asignar la organización al usuario', 500)
      }

      const enriched = await findUserById(input.db, result.user.id)
      if (!enriched) {
        throw new ApiError('No se pudo recuperar el usuario creado', 500)
      }

      return enriched
    } catch (err) {
      await softDeleteUser(input.db, result.user.id).catch(() => null)
      if (err instanceof ApiError) throw err
      throw new ApiError('Error al crear el usuario', 500)
    }
  }

  private async signUp(
    auth: Auth,
    input: CreateUserInput,
  ): Promise<{ user: { id: string } | null }> {
    let response: Response
    try {
      response = await auth.api.signUpEmail({
        body: {
          email: input.email,
          password: input.password,
          name: input.name,
        },
        headers: new Headers(),
        asResponse: true,
        returnHeaders: false,
      })
    } catch {
      throw new ApiError('No se pudo crear el usuario', 500)
    }

    const status = response.status
    let body: { user?: { id: string }; code?: string; message?: string } | null = null
    try {
      const parsed: unknown = await response.clone().json()
      if (parsed && typeof parsed === 'object') {
        body = parsed as { user?: { id: string }; code?: string; message?: string }
      }
    } catch {
      body = null
    }

    if (status >= 400) {
      const code = body?.code ?? ''
      const message =
        code === 'USER_ALREADY_EXISTS' || code.startsWith('USER_ALREADY_EXISTS')
          ? 'Ya existe un usuario con ese email'
          : code === 'PASSWORD_TOO_SHORT' || code.startsWith('PASSWORD_TOO_')
            ? 'La contraseña no cumple los requisitos'
            : 'No se pudo crear el usuario'
      throw new ApiError(message, status === 409 ? 409 : 400)
    }

    return { user: body?.user ?? null }
  }
}
