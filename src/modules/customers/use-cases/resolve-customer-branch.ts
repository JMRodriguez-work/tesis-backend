import { eq } from "drizzle-orm";
import { ApiError } from "../../../shared/http/api-response";
import type { DB } from "../../../shared/db";
import * as schema from "../../../shared/db/schema";
import { findBranchByIdRaw } from "../infra/repository/customer.repository";

export const ADMIN_ROLE_ID = 1;

export type ResolveCustomerBranchInput = {
  requestedBranchId?: string | null;
  userRoleId: number | null;
  userBranchId: string | null;
  userOrganizationId: string | null;
};

export type ResolvedBranch = { branchId: string };

export type ResolveCustomerListInput = {
  requestedBranchId?: string | null;
  userRoleId: number | null;
  userBranchId: string | null;
  userOrganizationId: string | null;
};

export type ResolvedListScope = {
  organizationId: string;
  branchId: string | null;
  isAdmin: boolean;
};

export async function resolveCustomerBranchForWrite(
  db: DB,
  input: ResolveCustomerBranchInput,
): Promise<ResolvedBranch> {
  const { requestedBranchId, userRoleId, userBranchId, userOrganizationId } =
    input;

  if (!userOrganizationId) throw new ApiError("No autorizado", 403);

  const isAdmin = userRoleId === ADMIN_ROLE_ID;

  if (isAdmin) {
    if (requestedBranchId === null || requestedBranchId === undefined) {
      throw new ApiError("Debes indicar branchId en el body", 400);
    }
    const branch = await findBranchByIdRaw(db, requestedBranchId);
    if (!branch || branch.organizationId !== userOrganizationId) {
      throw new ApiError("La sucursal no pertenece a tu organización", 400);
    }
    return { branchId: requestedBranchId };
  }

  if (userBranchId === null) throw new ApiError("No autorizado", 403);

  if (
    requestedBranchId !== null &&
    requestedBranchId !== undefined &&
    requestedBranchId !== userBranchId
  ) {
    throw new ApiError(
      "No podés crear o modificar clientes en otra sucursal",
      400,
    );
  }

  return { branchId: userBranchId };
}

export function resolveCustomerListScope(
  input: ResolveCustomerListInput,
): ResolvedListScope {
  if (!input.userOrganizationId) throw new ApiError("No autorizado", 403);
  const isAdmin = input.userRoleId === ADMIN_ROLE_ID;
  if (isAdmin) {
    if (
      input.requestedBranchId !== null &&
      input.requestedBranchId !== undefined
    ) {
      return {
        organizationId: input.userOrganizationId,
        branchId: input.requestedBranchId,
        isAdmin: true,
      };
    }
    return {
      organizationId: input.userOrganizationId,
      branchId: null,
      isAdmin: true,
    };
  }
  if (input.userBranchId === null) throw new ApiError("No autorizado", 403);
  if (
    input.requestedBranchId !== null &&
    input.requestedBranchId !== undefined &&
    input.requestedBranchId !== input.userBranchId
  ) {
    throw new ApiError("No podés consultar clientes de otra sucursal", 400);
  }
  return {
    organizationId: input.userOrganizationId,
    branchId: input.userBranchId,
    isAdmin: false,
  };
}

export async function assertCustomerAccess(
  db: DB,
  customerId: string,
  input: ResolveCustomerListInput,
): Promise<typeof schema.customers.$inferSelect | null> {
  if (!input.userOrganizationId) return null;

  const customer = await db
    .select()
    .from(schema.customers)
    .where(eq(schema.customers.id, customerId))
    .limit(1)
    .then((r) => r[0] ?? null);

  if (!customer) return null;
  if (customer.organizationId !== input.userOrganizationId) return null;

  const isAdmin = input.userRoleId === ADMIN_ROLE_ID;
  if (isAdmin) return customer;

  if (input.userBranchId === null) return null;
  if (customer.branchId !== input.userBranchId) return null;
  return customer;
}
