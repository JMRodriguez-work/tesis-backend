import { ApiError } from '../../../shared/http/api-response'
import type { DB } from '../../../shared/db'
import { softDeleteCustomer } from '../infra/repository/customer.repository'
import { assertCustomerAccess } from './resolve-customer-branch'
import type { ResolveCustomerListInput } from './resolve-customer-branch'

export class SoftDeleteCustomer {
  constructor(private readonly db: DB) {}

  async execute(id: string, input: ResolveCustomerListInput): Promise<void> {
    const existing = await assertCustomerAccess(this.db, id, input)
    if (!existing) throw new ApiError('Cliente no encontrado', 404)
    if (!existing.isActive) return
    await softDeleteCustomer(this.db, id)
  }
}
