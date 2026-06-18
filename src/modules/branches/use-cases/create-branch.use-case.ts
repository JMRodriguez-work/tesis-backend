import type { DB } from '../../../shared/db'
import { createBranch, findBranchById, type BranchWithRelations } from '../infra/repository/branch.repository'

export type CreateBranchInput = {
  name: string
  organizationId: string
}

export class CreateBranch {
  constructor(private readonly db: DB) {}

  async execute({ name, organizationId }: CreateBranchInput): Promise<BranchWithRelations> {
    const created = await createBranch(this.db, {
      name: name.trim(),
      organizationId,
      isActive: true,
    })

    if (!created) throw new Error('No se pudo crear la sucursal')

    const enriched = await findBranchById(this.db, created.id)
    if (!enriched) throw new Error('No se pudo recuperar la sucursal creada')
    return enriched
  }
}
