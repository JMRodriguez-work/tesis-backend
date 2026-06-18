import type { DB } from '../../../shared/db'
import { updateOrganization } from '../infra/repository/organization.repository'

export type UpdateOrganizationInput = {
  id: string
  organizationId: string
  name: string
}

export class UpdateOrganization {
  constructor(private readonly db: DB) {}

  async execute({ id, organizationId, name }: UpdateOrganizationInput) {
    const org = await updateOrganization(this.db, id, {
      name: name.trim(),
    })

    if (!org || org.id !== organizationId) return null
    return org
  }
}
