import { eq } from 'drizzle-orm'
import { ApiError } from '../../../shared/http/api-response'
import type { DB } from '../../../shared/db'
import * as schema from '../../../shared/db/schema'
import { findItemByBarcode, type ItemWithRelations } from '../infra/repository/item.repository'
import { ADMIN_ROLE_ID, type ResolveItemBranchInput } from './resolve-item-branch'

export type LookupItemByBarcodeInput = ResolveItemBranchInput & {
  barcode: string
}

export class LookupItemByBarcode {
  constructor(private readonly db: DB) {}

  async execute(input: LookupItemByBarcodeInput): Promise<ItemWithRelations | null> {
    const item = await findItemByBarcode(this.db, input.barcode)
    if (!item) return null

    if (!input.userOrganizationId) return null

    const isAdmin = input.userRoleId === ADMIN_ROLE_ID

    if (isAdmin) {
      const branch = await this.db
        .select({ organizationId: schema.branches.organizationId })
        .from(schema.branches)
        .where(eq(schema.branches.id, item.branchId))
        .limit(1)

      if (!branch[0] || branch[0].organizationId !== input.userOrganizationId) {
        return null
      }
      return item
    }

    if (input.userBranchId === null) return null
    if (item.branchId !== input.userBranchId) return null

    return item
  }
}
