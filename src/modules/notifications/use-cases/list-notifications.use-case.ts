import { ApiError } from "../../../shared/http/api-response";
import type { DB } from "../../../shared/db";
import { findLowStockItems } from "../../stock-movements/infra/repository/stock-movement.repository";
import {
  countUnreadRecommendations,
  findUnreadRecommendations,
} from "../../recommendations/infra/repository/recommendation.repository";

export type ListNotificationsInput = {
  organizationId: string | null;
  userRoleId: number | null;
  userBranchId: string | null;
  requestedBranchId?: string | null;
};

const ADMIN_ROLE_ID = 1;
const NOTIFICATIONS_LIMIT = 50;

export type NotificationRecommendation = {
  id: string;
  type: "restock" | "pricing" | "trend" | "seasonal" | "retention";
  priority: "high" | "medium" | "low";
  description: string;
  branchId: string;
  branchName: string;
  itemId: string | null;
  itemName: string | null;
  customerId: string | null;
  customerFullname: string | null;
  generatedAt: Date;
};

export type ListNotificationsResult = {
  recommendations: NotificationRecommendation[];
  lowStock: Awaited<ReturnType<typeof findLowStockItems>>;
  unreadCount: number;
};

export class ListNotifications {
  constructor(private readonly db: DB) {}

  async execute(input: ListNotificationsInput): Promise<ListNotificationsResult> {
    if (!input.organizationId) throw new ApiError("No autorizado", 403);

    const isAdmin = input.userRoleId === ADMIN_ROLE_ID;
    let branchId: string | null;
    if (isAdmin) {
      branchId = input.requestedBranchId ?? null;
    } else {
      if (!input.userBranchId) throw new ApiError("No autorizado", 403);
      if (
        input.requestedBranchId &&
        input.requestedBranchId !== input.userBranchId
      ) {
        throw new ApiError("No podés consultar notificaciones de otra sucursal", 400);
      }
      branchId = input.userBranchId;
    }

    const [rows, lowStock, unreadCount] = await Promise.all([
      findUnreadRecommendations(this.db, {
        organizationId: input.organizationId,
        branchId,
        limit: NOTIFICATIONS_LIMIT,
      }),
      findLowStockItems(this.db, input.organizationId, branchId),
      countUnreadRecommendations(this.db, input.organizationId, branchId),
    ]);

    const recommendations: NotificationRecommendation[] = rows.map((r) => ({
      id: r.id,
      type: r.type,
      priority: r.priority,
      description: r.description,
      branchId: r.branchId,
      branchName: r.branchName,
      itemId: r.itemId,
      itemName: r.itemName,
      customerId: r.customerId,
      customerFullname: r.customerFullname,
      generatedAt: r.generatedAt,
    }));

    return { recommendations, lowStock, unreadCount };
  }
}
