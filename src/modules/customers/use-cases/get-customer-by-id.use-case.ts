import type { DB } from '../../../shared/db'
import { findCustomerById, type CustomerWithRelations } from '../infra/repository/customer.repository'
import { assertCustomerAccess, type ResolveCustomerListInput } from './resolve-customer-branch'

export type GetCustomerByIdInput = ResolveCustomerListInput & { id: string }

export class GetCustomerById {
  constructor(private readonly db: DB) {}

  async execute(input: GetCustomerByIdInput): Promise<CustomerWithRelations | null> {
    const raw = await assertCustomerAccess(this.db, input.id, input)
    if (!raw) return null
    return findCustomerById(this.db, input.id)
  }
}
