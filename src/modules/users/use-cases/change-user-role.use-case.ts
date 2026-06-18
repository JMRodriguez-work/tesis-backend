import { ApiError } from '../../../shared/http/api-response'
import type { DB } from '../../../shared/db'
import {
  changeUserRole,
  findUserById,
  findUserByIdRaw,
  type UserWithRelations,
} from '../infra/repository/user.repository'
import {
  assertBranchRoleConsistency,
  assertRoleExists,
} from './validate-user-branch-role'

export type ChangeUserRoleInput = {
  id: string
  organizationId: string
  roleId: number
}

export class ChangeUserRole {
  constructor(private readonly db: DB) {}

  async execute({ id, organizationId, roleId }: ChangeUserRoleInput): Promise<UserWithRelations | null> {
    const existing = await findUserByIdRaw(this.db, id)
    if (!existing || existing.organizationId !== organizationId) return null

    if (existing.deletedAt !== null) {
      throw new ApiError('No se puede cambiar el rol de un usuario eliminado', 400)
    }

    await assertRoleExists(this.db, roleId)
    assertBranchRoleConsistency({ roleId, branchId: existing.branchId })

    const updated = await changeUserRole(this.db, id, roleId)
    if (!updated) return null

    return findUserById(this.db, id)
  }
}
