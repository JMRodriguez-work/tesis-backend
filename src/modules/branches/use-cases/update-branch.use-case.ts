import type { DB } from '../../../shared/db'
import * as schema from '../../../shared/db/schema'
import {
  findBranchById,
  findBranchByIdRaw,
  updateBranch,
  type BranchWithRelations,
} from '../infra/repository/branch.repository'

export type UpdateBranchInput = {
  id: string
  organizationId: string
  data: {
    name?: string
    isActive?: boolean
  }
}

export class UpdateBranch {
  constructor(private readonly db: DB) {}

  async execute({ id, organizationId, data }: UpdateBranchInput): Promise<BranchWithRelations | null> {
    const existing = await findBranchByIdRaw(this.db, id)
    if (!existing || existing.organizationId !== organizationId) return null
    if (existing.deletedAt !== null) return null

    const patch: Partial<typeof schema.branches.$inferInsert> = {}
    if (data.name !== undefined) patch.name = data.name.trim()
    if (data.isActive !== undefined) patch.isActive = data.isActive

    if (Object.keys(patch).length === 0) {
      return findBranchById(this.db, id)
    }

    const updated = await updateBranch(this.db, id, patch)
    if (!updated) return null
    return findBranchById(this.db, id)
  }
}
