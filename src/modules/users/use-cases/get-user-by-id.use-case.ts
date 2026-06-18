import type { DB } from '../../../shared/db'
import { findUserById, type UserWithRelations } from '../infra/repository/user.repository'

export type GetUserByIdInput = {
  id: string
  organizationId: string
}

export class GetUserById {
  constructor(private readonly db: DB) {}

  async execute({ id, organizationId }: GetUserByIdInput): Promise<UserWithRelations | null> {
    const user = await findUserById(this.db, id)
    if (!user || user.organizationId !== organizationId) return null
    return user
  }
}
