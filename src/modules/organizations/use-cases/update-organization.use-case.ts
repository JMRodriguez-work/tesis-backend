import { ApiError } from '../../../shared/http/api-response'
import type { DB } from '../../../shared/db'
import { updateOrganization } from '../infra/repository/organization.repository'

const NAME_MAX_LENGTH = 255

export type UpdateOrganizationInput = {
  id: string
  organizationId: string
  name: string
}

export class UpdateOrganization {
  constructor(private readonly db: DB) {}

  async execute({ id, organizationId, name }: UpdateOrganizationInput) {
    const trimmed = name.trim()
    if (trimmed.length === 0) {
      throw new ApiError('El nombre de la organización es obligatorio', 400)
    }
    if (trimmed.length > NAME_MAX_LENGTH) {
      throw new ApiError(
        `El nombre no puede tener más de ${NAME_MAX_LENGTH} caracteres`,
        400,
      )
    }

    const org = await updateOrganization(this.db, id, {
      name: trimmed,
    })

    if (!org || org.id !== organizationId) return null
    return org
  }
}
