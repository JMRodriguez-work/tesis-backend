import { ApiError } from '../../../shared/http/api-response'
import type { DB } from '../../../shared/db'
import {
  createCustomer,
  findActiveCustomerByEmailInOrganization,
  findActiveCustomerByPhoneInOrganization,
  findCustomerById,
  type CustomerWithRelations,
} from '../infra/repository/customer.repository'
import {
  resolveCustomerBranchForWrite,
  type ResolveCustomerBranchInput,
} from './resolve-customer-branch'

export type CreateCustomerInput = ResolveCustomerBranchInput & {
  fullname: string
  email?: string
  phone?: string
  address?: string
}

export class CreateCustomer {
  constructor(private readonly db: DB) {}

  async execute(input: CreateCustomerInput): Promise<CustomerWithRelations> {
    const trimmedName = input.fullname.trim()
    if (trimmedName.length === 0) {
      throw new ApiError('El nombre es obligatorio', 400)
    }

    const { branchId } = await resolveCustomerBranchForWrite(this.db, input)
    const orgId = input.userOrganizationId!

    if (input.email) {
      const dup = await findActiveCustomerByEmailInOrganization(this.db, orgId, input.email)
      if (dup) throw new ApiError('Ya existe un cliente activo con ese email en la organización', 409)
    }

    if (input.phone) {
      const dup = await findActiveCustomerByPhoneInOrganization(this.db, orgId, input.phone)
      if (dup) throw new ApiError('Ya existe un cliente activo con ese teléfono en la organización', 409)
    }

    const created = await createCustomer(this.db, {
      organizationId: orgId,
      branchId,
      fullname: trimmedName,
      email: input.email,
      phone: input.phone,
      address: input.address,
      isActive: true,
    })

    if (!created) throw new ApiError('No se pudo crear el cliente', 500)

    const enriched = await findCustomerById(this.db, created.id)
    if (!enriched) throw new ApiError('No se pudo recuperar el cliente creado', 500)
    return enriched
  }
}
