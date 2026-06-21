import { ApiError } from "../../../shared/http/api-response";

export const ADMIN_ROLE_ID = 1;

export type ResolveExternalDataScopeInput = {
  userRoleId: number | null;
  userOrganizationId: string | null;
};

export type ResolvedExternalDataScope = {
  organizationId: string;
  isAdmin: boolean;
};

export function resolveExternalDataScope(
  input: ResolveExternalDataScopeInput,
): ResolvedExternalDataScope {
  if (!input.userOrganizationId) throw new ApiError("No autorizado", 403);
  return {
    organizationId: input.userOrganizationId,
    isAdmin: input.userRoleId === ADMIN_ROLE_ID,
  };
}
