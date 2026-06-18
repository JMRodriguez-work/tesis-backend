import type { DB } from '../../../shared/db'
import { findUserById, type UserWithRelations } from '../infra/repository/user.repository'

export class GetMe {
  constructor(private readonly db: DB) {}

  async execute(userId: string): Promise<UserWithRelations | null> {
    return findUserById(this.db, userId)
  }
}
