import type { DB } from "../../../shared/db";
import {
  findItemsWithStockByBranch,
  type ItemStockRow,
} from "../infra/repository/item.repository";
import {
  resolveItemBranchForRead,
  type ResolveItemBranchInput,
} from "./resolve-item-branch";

export type ListItemsWithStockInput = ResolveItemBranchInput & {
  page: number;
  limit: number;
  search?: string;
  status?: "out" | "low" | "ok";
  showInactive: boolean;
};

export type ListItemsWithStockResult = {
  data: ItemStockRow[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};

export class ListItemsWithStock {
  constructor(private readonly db: DB) {}

  async execute(
    input: ListItemsWithStockInput,
  ): Promise<ListItemsWithStockResult> {
    const { branchId } = await resolveItemBranchForRead(this.db, input);

    const { data, total } = await findItemsWithStockByBranch(this.db, {
      branchId,
      page: input.page,
      limit: input.limit,
      search: input.search,
      status: input.status,
      showInactive: input.showInactive,
    });

    return {
      data,
      meta: {
        page: input.page,
        limit: input.limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / input.limit),
      },
    };
  }
}
