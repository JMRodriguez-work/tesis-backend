import { ApiError } from '../../../shared/http/api-response'
import type { DB } from '../../../shared/db'
import * as schema from '../../../shared/db/schema'
import {
  findActiveCustomerByEmailInOrganization,
  findActiveCustomerByPhoneInOrganization,
  findBranchByIdRaw,
  findCustomerById,
  findCustomerByIdRaw,
  updateCustomer,
  type CustomerWithRelations,
} from '../infra/repository/customer.repository'
import { assertCustomerAccess } from './resolve-customer-branch'
import type { ResolveCustomerListInput } from './resolve-customer-branch'

export type UpdateCustomerInput = ResolveCustomerListInput & {
  id: string
  data: {
    fullname?: string
    email?: string | null
    phone?: string | null
    address?: string | null
    isActive?: boolean
    branchId?: string
  }
}

export class UpdateCustomer {
  constructor(private readonly db: DB) {}

  async execute(input: UpdateCustomerInput): Promise<CustomerWithRelations | null> {
    const existing = await findCustomerByIdRaw(this.db, input.id)
    if (!existing) return null

    const scoped = await assertCustomerAccess(this.db, input.id, input)
    if (!scoped) return null

    const patch: Partial<typeof schema.customers.$inferInsert> = {}

    if (input.data.fullname !== undefined) {
      const trimmed = input.data.fullname.trim()
      if (trimmed.length === 0) throw new ApiError('El nombre es obligatorio', 400)
      patch.fullname = trimmed
    }

    if (input.data.email !== undefined) {
      const newEmail = input.data.email === null ? null : input.data.email
      if (newEmail) {
        const dup = await findActiveCustomerByEmailInOrganization(
          this.db,
          existing.organizationId,
          newEmail,
          input.id,
        )
        if (dup) throw new ApiError('Ya existe un cliente activo con ese email en la organización', 409)
      }
      patch.email = newEmail
    }

    if (input.data.phone !== undefined) {
      const newPhone = input.data.phone === null ? null : input.data.phone
      if (newPhone) {
        const dup = await findActiveCustomerByPhoneInOrganization(
          this.db,
          existing.organizationId,
          newPhone,
          input.id,
        )
        if (dup) throw new ApiError('Ya existe un cliente activo con ese teléfono en la organización', 409)
      }
      patch.phone = newPhone
    }

    if (input.data.address !== undefined) {
      patch.address = input.data.address === null ? null : input.data.address
    }

    if (input.data.isActive !== undefined) {
      patch.isActive = input.data.isActive
    }

    if (input.data.branchId !== undefined && input.data.branchId !== existing.branchId) {
      const branch = await findBranchByIdRaw(this.db, input.data.branchId)
      if (!branch || branch.organizationId !== existing.organizationId) {
        throw new ApiError('La sucursal no pertenece a la organización del cliente', 400)
      }
      patch.branchId = input.data.branchId
    }

    if (Object.keys(patch).length === 0) {
      return findCustomerById(this.db, input.id)
    }

    const updated = await updateCustomer(this.db, input.id, patch)
    if (!updated) return null
    return findCustomerById(this.db, input.id)
  }
}
