import { eq } from "drizzle-orm";
import { ApiError } from "../../../shared/http/api-response";
import type { DB } from "../../../shared/db";
import * as schema from "../../../shared/db/schema";
import {
  findItemById,
  type ItemWithRelations,
} from "../infra/repository/item.repository";
import {
  ADMIN_ROLE_ID,
  type ResolveItemBranchInput,
} from "./resolve-item-branch";

export type GetItemByIdInput = ResolveItemBranchInput & {
  id: string;
};

export class GetItemById {
  constructor(private readonly db: DB) {}

  async execute(input: GetItemByIdInput): Promise<ItemWithRelations | null> {
    const item = await findItemById(this.db, input.id);
    if (!item) return null;

    if (!input.userOrganizationId) return null;

    const isAdmin = input.userRoleId === ADMIN_ROLE_ID;

    if (isAdmin) {
      const [branch] = await this.db
        .select({ organizationId: schema.branches.organizationId })
        .from(schema.branches)
        .where(eq(schema.branches.id, item.branchId))
        .limit(1);

      if (!branch || branch.organizationId !== input.userOrganizationId) {
        return null;
      }
      return item;
    }

    if (input.userBranchId === null) return null;
    if (item.branchId !== input.userBranchId) return null;

    return item;
  }
}
