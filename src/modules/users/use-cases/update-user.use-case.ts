import { ApiError } from '../../../shared/http/api-response'
import type { DB } from '../../../shared/db'
import * as schema from '../../../shared/db/schema'
import {
  findUserById,
  findUserByIdRaw,
  updateUser,
  type UserWithRelations,
} from '../infra/repository/user.repository'
import { assertBranchRoleConsistency } from './validate-user-branch-role'

export type UpdateUserInput = {
  id: string
  organizationId: string
  data: {
    name?: string
    branchId?: string | null
    isActive?: boolean
  }
}

export class UpdateUser {
  constructor(private readonly db: DB) {}

  async execute({ id, organizationId, data }: UpdateUserInput): Promise<UserWithRelations | null> {
    const existing = await findUserByIdRaw(this.db, id)
    if (!existing || existing.organizationId !== organizationId) {
      return null
    }

    if (existing.deletedAt !== null) {
      throw new ApiError('No se puede actualizar un usuario eliminado', 400)
    }

    const effectiveRoleId = existing.roleId
    const effectiveBranchId =
      data.branchId !== undefined ? data.branchId : existing.branchId

    if (effectiveRoleId !== null) {
      assertBranchRoleConsistency({
        roleId: effectiveRoleId,
        branchId: effectiveBranchId,
      })
    }

    const patch: Record<string, unknown> = {}
    if (data.name !== undefined) patch.name = data.name.trim()
    if (data.branchId !== undefined) patch.branchId = data.branchId
    if (data.isActive !== undefined) patch.isActive = data.isActive

    if (Object.keys(patch).length === 0) {
      const current = await findUserById(this.db, id)
      return current
    }

    const updated = await updateUser(this.db, id, patch as Partial<typeof schema.user.$inferInsert>)
    if (!updated) return null

    return findUserById(this.db, id)
  }
}
