import { and, count, eq, isNull, ne } from "drizzle-orm";
import { ApiError } from "../../../shared/http/api-response";
import type { DB } from "../../../shared/db";
import * as schema from "../../../shared/db/schema";

const ADMIN_ROLE_ID = 1;

export async function assertNotLastAdmin(
  db: DB,
  organizationId: string,
  targetUserId: string,
): Promise<void> {
  const result = await db
    .select({ value: count() })
    .from(schema.user)
    .where(
      and(
        eq(schema.user.organizationId, organizationId),
        eq(schema.user.roleId, ADMIN_ROLE_ID),
        eq(schema.user.isActive, true),
        isNull(schema.user.deletedAt),
        ne(schema.user.id, targetUserId),
      ),
    );

  const otherAdminsCount = result[0]?.value ?? 0;

  if (otherAdminsCount === 0) {
    throw new ApiError(
      "No se puede dejar a la organización sin administradores activos",
      400,
    );
  }
}
