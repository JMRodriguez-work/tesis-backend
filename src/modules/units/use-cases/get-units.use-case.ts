import type { DB } from '../../../shared/db'
import { findAllUnits } from '../infra/repository/unit.repository'

export class GetUnits {
  constructor(private readonly db: DB) {}

  async execute() {
    return findAllUnits(this.db)
  }
}
