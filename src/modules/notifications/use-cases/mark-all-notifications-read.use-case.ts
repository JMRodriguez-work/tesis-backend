import { eq } from "drizzle-orm";
import { ApiError } from "../../../shared/http/api-response";
import type { DB } from "../../../shared/db";
import * as schema from "../../../shared/db/schema";
import { markAllRecommendationsAsRead } from "../../recommendations/infra/repository/recommendation.repository";

export type MarkAllNotificationsReadInput = {
  organizationId: string;
  userBranchId: string | null;
  requestedBranchId?: string | null;
  isAdmin: boolean;
};

export type MarkAllNotificationsReadResult = {
  markedCount: number;
};

const ADMIN_ROLE_ID = 1;

export class MarkAllNotificationsRead {
  constructor(private readonly db: DB) {}

  async execute(
    input: MarkAllNotificationsReadInput,
  ): Promise<MarkAllNotificationsReadResult> {
    let branchId: string | null;
    if (input.isAdmin) {
      branchId = input.requestedBranchId ?? null;
    } else {
      if (!input.userBranchId) throw new ApiError("No autorizado", 403);
      if (
        input.requestedBranchId &&
        input.requestedBranchId !== input.userBranchId
      ) {
        throw new ApiError("No autorizado", 403);
      }
      branchId = input.userBranchId;
    }

    if (!branchId) {
      throw new ApiError("Debes indicar branchId en query", 400);
    }

    const branch = await this.db
      .select({ organizationId: schema.branches.organizationId })
      .from(schema.branches)
      .where(eq(schema.branches.id, branchId))
      .limit(1);
    if (!branch[0] || branch[0].organizationId !== input.organizationId) {
      throw new ApiError("La sucursal no pertenece a tu organización", 400);
    }

    const now = new Date();
    const markedCount = await markAllRecommendationsAsRead(
      this.db,
      branchId,
      now,
    );
    return { markedCount };
  }
}
