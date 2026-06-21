import { createRoute } from "@hono/zod-openapi";
import { authMiddleware } from "../../../../shared/auth";
import { roleGuard } from "../../../../shared/auth/role-guard";
import { ApiError, ApiResponse } from "../../../../shared/http/api-response";
import type { AppType } from "../../../../shared/types/app";
import { GetCustomerSegments } from "../../../customer-analytics/use-cases/get-customer-segments.use-case";
import { GetCustomerPurchaseHistory } from "../../../sales/use-cases/get-customer-purchase-history.use-case";
import { CreateCustomer } from "../../use-cases/create-customer.use-case";
import { GetCustomerById } from "../../use-cases/get-customer-by-id.use-case";
import { GetCustomersPaginated } from "../../use-cases/get-customers-paginated.use-case";
import { SoftDeleteCustomer } from "../../use-cases/soft-delete-customer.use-case";
import { UpdateCustomer } from "../../use-cases/update-customer.use-case";
import {
  createCustomerSchema,
  customerDeleteResponseSchema,
  customerIdParamSchema,
  customerListResponseSchema,
  customerResponseSchema,
  customerSalesQuerySchema,
  customerSalesResponseSchema,
  listCustomersQuerySchema,
  segmentsQuerySchema,
  segmentsResponseSchema,
  updateCustomerSchema,
} from "./customers.schemas";

export function registerCustomerRoutes(app: AppType) {
  app.openapi(
    createRoute({
      method: "get",
      path: "/api/v1/customers",
      tags: ["Customers"],
      summary: "Listar clientes",
      description:
        "Admin: ve todos los de su org, puede filtrar por ?branchId=. Manager/Employee: solo los de su branch. Filtra por isActive (default ambos).",
      middleware: [authMiddleware] as const,
      security: [{ cookieAuth: [] }],
      request: { query: listCustomersQuerySchema },
      responses: {
        200: {
          description: "Clientes obtenidos",
          content: {
            "application/json": { schema: customerListResponseSchema },
          },
        },
        400: { description: "branchId inválido" },
        401: { description: "No autenticado" },
      },
    }),
    async (c) => {
      const user = c.get("user");
      const db = c.get("db");
      const query = c.req.valid("query");
      const result = await new GetCustomersPaginated(db).execute({
        userRoleId: user.roleId,
        userBranchId: user.branchId,
        userOrganizationId: user.organizationId,
        requestedBranchId: query.branchId ?? null,
        filters: { search: query.search, isActive: query.isActive },
        page: query.page,
        limit: query.limit,
      });
      return c.json(
        new ApiResponse({
          data: result,
          message: "Clientes obtenidos",
          status: 200,
        }),
        200,
      );
    },
  );

  app.openapi(
    createRoute({
      method: "get",
      path: "/api/v1/customers/{id}",
      tags: ["Customers"],
      summary: "Obtener cliente por ID",
      description: "Cross-org/branch → 404.",
      middleware: [authMiddleware] as const,
      security: [{ cookieAuth: [] }],
      request: { params: customerIdParamSchema },
      responses: {
        200: {
          description: "Cliente encontrado",
          content: { "application/json": { schema: customerResponseSchema } },
        },
        401: { description: "No autenticado" },
        404: { description: "Cliente no encontrado" },
      },
    }),
    async (c) => {
      const user = c.get("user");
      const db = c.get("db");
      const { id } = c.req.valid("param");
      const customer = await new GetCustomerById(db).execute({
        id,
        userRoleId: user.roleId,
        userBranchId: user.branchId,
        userOrganizationId: user.organizationId,
        requestedBranchId: null,
      });
      if (!customer) throw new ApiError("Cliente no encontrado", 404);
      return c.json(
        new ApiResponse({
          data: customer,
          message: "Cliente encontrado",
          status: 200,
        }),
        200,
      );
    },
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/api/v1/customers",
      tags: ["Customers"],
      summary: "Crear cliente",
      description:
        "Admin: debe mandar branchId. Manager: forzado a su branch (branchId de otra branch → 400). Email/phone únicos dentro de la org activa si se proporcionan.",
      middleware: [authMiddleware, roleGuard(["Admin", "Manager"])] as const,
      security: [{ cookieAuth: [] }],
      request: {
        body: {
          content: { "application/json": { schema: createCustomerSchema } },
        },
      },
      responses: {
        201: {
          description: "Cliente creado",
          content: { "application/json": { schema: customerResponseSchema } },
        },
        400: { description: "Datos inválidos o branchId no autorizado" },
        401: { description: "No autenticado" },
        403: { description: "No autorizado" },
        409: { description: "Email o teléfono duplicado" },
      },
    }),
    async (c) => {
      const user = c.get("user");
      const db = c.get("db");
      const body = c.req.valid("json");
      const customer = await new CreateCustomer(db).execute({
        userRoleId: user.roleId,
        userBranchId: user.branchId,
        userOrganizationId: user.organizationId,
        requestedBranchId: body.branchId ?? null,
        fullname: body.fullname,
        email: body.email,
        phone: body.phone,
        address: body.address,
      });
      return c.json(
        new ApiResponse({
          data: customer,
          message: "Cliente creado",
          status: 201,
        }),
        201,
      );
    },
  );

  app.openapi(
    createRoute({
      method: "put",
      path: "/api/v1/customers/{id}",
      tags: ["Customers"],
      summary: "Actualizar cliente (incluye reactivación con isActive: true)",
      description:
        "Cross-org/branch → 404. branchId puede cambiar (un cliente puede rotar de branch). Email/phone re-validados.",
      middleware: [authMiddleware, roleGuard(["Admin", "Manager"])] as const,
      security: [{ cookieAuth: [] }],
      request: {
        params: customerIdParamSchema,
        body: {
          content: { "application/json": { schema: updateCustomerSchema } },
        },
      },
      responses: {
        200: {
          description: "Cliente actualizado",
          content: { "application/json": { schema: customerResponseSchema } },
        },
        400: { description: "Datos inválidos" },
        401: { description: "No autenticado" },
        403: { description: "No autorizado" },
        404: { description: "Cliente no encontrado" },
        409: { description: "Email o teléfono duplicado" },
      },
    }),
    async (c) => {
      const user = c.get("user");
      const db = c.get("db");
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");
      const customer = await new UpdateCustomer(db).execute({
        id,
        userRoleId: user.roleId,
        userBranchId: user.branchId,
        userOrganizationId: user.organizationId,
        requestedBranchId: null,
        data: {
          fullname: body.fullname,
          email: body.email,
          phone: body.phone,
          address: body.address,
          isActive: body.isActive,
          branchId: body.branchId,
        },
      });
      if (!customer) throw new ApiError("Cliente no encontrado", 404);
      return c.json(
        new ApiResponse({
          data: customer,
          message: "Cliente actualizado",
          status: 200,
        }),
        200,
      );
    },
  );

  app.openapi(
    createRoute({
      method: "delete",
      path: "/api/v1/customers/{id}",
      tags: ["Customers"],
      summary: "Eliminar cliente (soft delete vía isActive: false)",
      description:
        "Cross-org/branch → 404. No hay check de ventas activas (Fase 2.4 lo agrega cuando exista la tabla sales).",
      middleware: [authMiddleware, roleGuard(["Admin", "Manager"])] as const,
      security: [{ cookieAuth: [] }],
      request: { params: customerIdParamSchema },
      responses: {
        200: {
          description: "Cliente eliminado",
          content: {
            "application/json": { schema: customerDeleteResponseSchema },
          },
        },
        401: { description: "No autenticado" },
        403: { description: "No autorizado" },
        404: { description: "Cliente no encontrado" },
      },
    }),
    async (c) => {
      const user = c.get("user");
      const db = c.get("db");
      const { id } = c.req.valid("param");
      await new SoftDeleteCustomer(db).execute(id, {
        userRoleId: user.roleId,
        userBranchId: user.branchId,
        userOrganizationId: user.organizationId,
        requestedBranchId: null,
      });
      return c.json(
        new ApiResponse({
          data: null,
          message: "Cliente eliminado",
          status: 200,
        }),
        200,
      );
    },
  );

  app.openapi(
    createRoute({
      method: "get",
      path: "/api/v1/customers/{id}/sales",
      tags: ["Customers"],
      summary: "Historial de compras del cliente",
      description:
        "Lista de ventas del cliente + resumen acumulado (totalSpent, purchaseCount, lastPurchaseAt, averageTicket). Cross-org/branch → 404. Restringido a Admin/Manager: incluye totales financieros del cliente.",
      middleware: [authMiddleware, roleGuard(["Admin", "Manager"])] as const,
      security: [{ cookieAuth: [] }],
      request: {
        params: customerIdParamSchema,
        query: customerSalesQuerySchema,
      },
      responses: {
        200: {
          description: "Historial del cliente",
          content: {
            "application/json": { schema: customerSalesResponseSchema },
          },
        },
        401: { description: "No autenticado" },
        404: { description: "Cliente no encontrado" },
      },
    }),
    async (c) => {
      const user = c.get("user");
      const db = c.get("db");
      const { id } = c.req.valid("param");
      const query = c.req.valid("query");
      const result = await new GetCustomerPurchaseHistory(db).execute({
        customerId: id,
        userRoleId: user.roleId,
        userBranchId: user.branchId,
        userOrganizationId: user.organizationId,
        page: query.page,
        limit: query.limit,
        includeCancelled: query.includeCancelled,
      });
      return c.json(
        new ApiResponse({
          data: result,
          message: "Historial del cliente",
          status: 200,
        }),
        200,
      );
    },
  );

  app.openapi(
    createRoute({
      method: "get",
      path: "/api/v1/customers/segments",
      tags: ["Customers"],
      summary: "Segmentación de clientes por comportamiento",
      description:
        "Clasifica customers según frecuencia, valor y recencia. Filtros: ?segment= ?branchId= ?page= ?limit=. Restringido a Admin/Manager: clasifica según valor monetario.",
      middleware: [authMiddleware, roleGuard(["Admin", "Manager"])] as const,
      security: [{ cookieAuth: [] }],
      request: { query: segmentsQuerySchema },
      responses: {
        200: {
          description: "Segmentos",
          content: {
            "application/json": { schema: segmentsResponseSchema },
          },
        },
        400: { description: "branchId inválido" },
        401: { description: "No autenticado" },
      },
    }),
    async (c) => {
      const user = c.get("user");
      const db = c.get("db");
      const query = c.req.valid("query");
      const result = await new GetCustomerSegments(db).execute({
        userRoleId: user.roleId,
        userBranchId: user.branchId,
        userOrganizationId: user.organizationId,
        requestedBranchId: query.branchId ?? null,
        segment: query.segment,
        page: query.page,
        limit: query.limit,
      });
      return c.json(
        new ApiResponse({
          data: result,
          message: "Segmentos de clientes",
          status: 200,
        }),
        200,
      );
    },
  );
}
