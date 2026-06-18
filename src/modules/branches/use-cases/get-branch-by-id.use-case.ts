import type { DB } from '../../../shared/db'
import { findBranchById, type BranchWithRelations } from '../infra/repository/branch.repository'

export type GetBranchByIdInput = {
  id: string
  organizationId: string
}

export class GetBranchById {
  constructor(private readonly db: DB) {}

  async execute({ id, organizationId }: GetBranchByIdInput): Promise<BranchWithRelations | null> {
    const branch = await findBranchById(this.db, id)
    if (!branch || branch.organizationId !== organizationId) return null
    return branch
  }
}
