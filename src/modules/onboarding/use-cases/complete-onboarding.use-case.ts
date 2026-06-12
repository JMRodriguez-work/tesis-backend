import { ApiError } from '../../../shared/http/api-response'
import type { DB } from '../../../shared/db'
import {
  createOrganization,
  organizationTable,
} from '../../organizations/infra/repository/organization.repository'
import {
  createBranch,
  branchTable,
} from '../../branches/infra/repository/branch.repository'
import {
  updateUser,
  userTable,
  userIdEq,
} from '../../users/infra/repository/user.repository'

export type CompleteOnboardingInput = {
  userId: string
  organizationName: string
  branchName: string
}

export type CompleteOnboardingOutput = {
  organizationId: string
  branchId: string
  roleId: number
}

const ADMIN_ROLE_ID = 1

export class CompleteOnboarding {
  constructor(private readonly db: DB) {}

  async execute(
    input: CompleteOnboardingInput,
  ): Promise<CompleteOnboardingOutput> {
    return this.db.transaction(async (tx) => {
      const [org] = await tx
        .insert(organizationTable)
        .values({ name: input.organizationName })
        .returning()

      if (!org) throw new ApiError('Error al crear la organización', 500)

      const [branch] = await tx
        .insert(branchTable)
        .values({ organizationId: org.id, name: input.branchName })
        .returning()

      if (!branch) throw new ApiError('Error al crear la sucursal', 500)

      const [user] = await tx
        .update(userTable)
        .set({
          organizationId: org.id,
          branchId: branch.id,
          roleId: ADMIN_ROLE_ID,
          updatedAt: new Date(),
        })
        .where(userIdEq(input.userId))
        .returning()

      if (!user) throw new ApiError('Usuario no encontrado', 404)

      return {
        organizationId: org.id,
        branchId: branch.id,
        roleId: ADMIN_ROLE_ID,
      }
    })
  }
}
