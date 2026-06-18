import type { DB } from '../../../shared/db'
import { findOrganizationById } from '../infra/repository/organization.repository'

export type GetOrganizationByIdInput = {
  id: string
  organizationId: string
}

export class GetOrganizationById {
  constructor(private readonly db: DB) {}

  async execute({ id, organizationId }: GetOrganizationByIdInput) {
    const org = await findOrganizationById(this.db, id)
    if (!org || org.id !== organizationId) return null
    return org
  }
}
