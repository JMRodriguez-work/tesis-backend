import { and, count, eq, isNull } from 'drizzle-orm'
import { ApiError } from '../../../shared/http/api-response'
import type { DB } from '../../../shared/db'
import * as schema from '../../../shared/db/schema'
import {
  countActiveBranchesByOrganization,
  findBranchByIdRaw,
  softDeleteBranch,
} from '../infra/repository/branch.repository'

export class SoftDeleteBranch {
  constructor(private readonly db: DB) {}

  async execute(id: string, organizationId: string): Promise<void> {
    const existing = await findBranchByIdRaw(this.db, id)
    if (!existing || existing.organizationId !== organizationId) {
      throw new ApiError('Sucursal no encontrada', 404)
    }
    if (existing.deletedAt !== null) return

    const activeBranches = await countActiveBranchesByOrganization(this.db, organizationId)
    if (activeBranches <= 1) {
      throw new ApiError('No se puede eliminar la última sucursal activa de la organización', 400)
    }

    const activeUsersResult = await this.db
      .select({ id: schema.user.id, email: schema.user.email })
      .from(schema.user)
      .where(
        and(
          eq(schema.user.branchId, id),
          eq(schema.user.isActive, true),
          isNull(schema.user.deletedAt),
        ),
      )

    if (activeUsersResult.length > 0) {
      const emails = activeUsersResult.map((u) => u.email).join(', ')
      throw new ApiError(
        `No se puede eliminar la sucursal porque tiene ${activeUsersResult.length} usuario(s) activo(s): ${emails}`,
        400,
      )
    }

    await softDeleteBranch(this.db, id)
  }
}
