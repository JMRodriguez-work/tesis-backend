import type { DB } from '../../../shared/db'
import { findUnitById } from '../infra/repository/unit.repository'

export class GetUnitById {
  constructor(private readonly db: DB) {}

  async execute(id: number) {
    return findUnitById(this.db, id)
  }
}
