import { ApiError } from '../../../shared/http/api-response'
import type { DB } from '../../../shared/db'
import { findUserByIdRaw, softDeleteUser } from '../infra/repository/user.repository'
import { assertNotLastAdmin } from './validate-last-admin'

const ADMIN_ROLE_ID = 1

export class SoftDeleteUser {
  constructor(private readonly db: DB) {}

  async execute(id: string, requesterId: string, organizationId: string): Promise<void> {
    if (id === requesterId) {
      throw new ApiError('No podés eliminarte a vos mismo', 400)
    }

    const existing = await findUserByIdRaw(this.db, id)
    if (!existing || existing.deletedAt !== null) {
      return
    }

    if (existing.roleId === ADMIN_ROLE_ID && existing.isActive) {
      await assertNotLastAdmin(this.db, organizationId, id)
    }

    await softDeleteUser(this.db, id)
  }
}
