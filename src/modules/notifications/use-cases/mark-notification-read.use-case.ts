import { and, eq, isNull, sql } from "drizzle-orm";
import { ApiError } from "../../../shared/http/api-response";
import type { DB } from "../../../shared/db";
import * as schema from "../../../shared/db/schema";
import {
  findRecommendationByIdRaw,
  markRecommendationAsRead,
} from "../../recommendations/infra/repository/recommendation.repository";

export type MarkNotificationReadInput = {
  recommendationId: string;
  organizationId: string;
  userBranchId: string | null;
  isAdmin: boolean;
};

export type MarkNotificationReadResult = {
  id: string;
  readAt: string;
  alreadyRead: boolean;
};

export class MarkNotificationRead {
  constructor(private readonly db: DB) {}

  async execute(
    input: MarkNotificationReadInput,
  ): Promise<MarkNotificationReadResult> {
    const rec = await findRecommendationByIdRaw(
      this.db,
      input.recommendationId,
    );
    if (!rec) {
      throw new ApiError("Notificación no encontrada", 404);
    }

    const branch = await this.db
      .select({ organizationId: schema.branches.organizationId })
      .from(schema.branches)
      .where(eq(schema.branches.id, rec.branchId))
      .limit(1);
    if (!branch[0] || branch[0].organizationId !== input.organizationId) {
      throw new ApiError("Notificación no encontrada", 404);
    }

    if (!input.isAdmin && rec.branchId !== input.userBranchId) {
      throw new ApiError("Notificación no encontrada", 404);
    }

    if (rec.readAt) {
      return {
        id: rec.id,
        readAt: rec.readAt.toISOString(),
        alreadyRead: true,
      };
    }

    const now = new Date();
    const updated = await markRecommendationAsRead(this.db, rec.id, now);
    if (!updated || !updated.readAt) {
      const refetched = await findRecommendationByIdRaw(this.db, rec.id);
      return {
        id: rec.id,
        readAt: (refetched?.readAt ?? now).toISOString(),
        alreadyRead: true,
      };
    }
    return {
      id: updated.id,
      readAt: updated.readAt.toISOString(),
      alreadyRead: false,
    };
  }
}
